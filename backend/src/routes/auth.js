const express = require('express');
const {
  generateServiceProviderMetadata,
} = require('@node-saml/node-saml');
const { passport, strategy, samlStatus } = require('../auth/passport');
const { readConfig } = require('../config/saml');
const { ensureAuthenticated, sanitizeUser } = require('../auth/session');

const router = express.Router();

function requireSamlConfiguration(req, res, next) {
  if (samlStatus.configured) {
    return next();
  }

  return res.status(503).json({
    error: 'saml_not_configured',
    message: samlStatus.message,
  });
}

function buildAuth0LogoutUrl() {
  const config = readConfig();
  if (!config.auth0Domain) {
    return null;
  }

  const auth0Url = new URL(config.auth0Domain);
  if (auth0Url.protocol !== 'https:') {
    throw new Error('AUTH0_DOMAIN must use HTTPS.');
  }

  const logoutUrl = new URL('/v2/logout', auth0Url);
  logoutUrl.searchParams.set('returnTo', `${config.appBaseUrl}/?flow=logout`);
  if (config.auth0ClientId) {
    logoutUrl.searchParams.set('client_id', config.auth0ClientId);
  }
  return logoutUrl.toString();
}

router.get('/saml/login', requireSamlConfiguration, passport.authenticate('saml'));

router.post(
  ['/saml/acs', '/saml/callback'],
  requireSamlConfiguration,
  (req, res, next) => passport.authenticate('saml', (error, user) => {
    if (error) {
      console.error('SAML response validation failed:', error.message);
      return res.redirect('/?error=saml');
    }
    if (!user) {
      return res.redirect('/?error=saml');
    }

    return req.logIn(user, loginError => {
      if (loginError) {
        return next(loginError);
      }
      const flow = user.loginFlow.startsWith('SP-') ? 'sp' : 'idp';
      return res.redirect(`/?flow=${flow}`);
    });
  })(req, res, next)
);

router.get('/saml/metadata', (req, res) => {
  const config = readConfig();
  const metadata = strategy
    ? strategy.generateServiceProviderMetadata(null, null)
    : generateServiceProviderMetadata({
      issuer: config.issuer,
      callbackUrl: config.callbackUrl,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      wantAssertionsSigned: true,
    });

  return res.type('application/xml').send(metadata);
});

router.get('/me', ensureAuthenticated, (req, res) => {
  return res.json({
    authenticated: true,
    user: sanitizeUser(req.user),
    loginFlow: req.user.loginFlow,
  });
});

router.post('/logout', (req, res, next) => {
  req.logout(error => {
    if (error) {
      return next(error);
    }

    req.session.destroy(sessionError => {
      if (sessionError) {
        return next(sessionError);
      }

      res.clearCookie('paxafe.sid');
      try {
        const auth0LogoutUrl = buildAuth0LogoutUrl();
        return res.redirect(auth0LogoutUrl || '/?flow=logout');
      } catch (logoutError) {
        return next(logoutError);
      }
    });
  });
});

module.exports = router;

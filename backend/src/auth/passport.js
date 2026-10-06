const passport = require('passport');
const { Strategy } = require('@node-saml/passport-saml');
const {
  readConfig,
  ensureSamlConfiguration,
  createSamlOptions,
} = require('../config/saml');
const { ReplayCache } = require('../saml/replay-cache');
const { getAssertionId, hasExpectedRecipient } = require('../saml/profile');

const REPLAY_CACHE_TTL_MS = 10 * 60 * 1000;
const replayCache = new ReplayCache({
  ttlMs: REPLAY_CACHE_TTL_MS,
  maxEntries: 50000,
});

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      const stringValue = value.find(item => typeof item === 'string' && item.trim());
      if (stringValue) {
        return stringValue.trim();
      }
    }
  }
  return null;
}

function replayError(message) {
  const error = new Error(message);
  error.code = 'SAML_REPLAY';
  return error;
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

const config = readConfig();
const samlStatus = ensureSamlConfiguration(config);
let strategy = null;

if (samlStatus.configured) {
  strategy = new Strategy(
    { ...createSamlOptions(config), passReqToCallback: true },
    (req, profile, done) => {
      if (!profile) {
        return done(new Error('The SAML response did not contain an authenticated profile.'));
      }

      if (!hasExpectedRecipient(profile, config.callbackUrl)) {
        return done(new Error('The SAML assertion recipient does not match the configured ACS URL.'));
      }

      const assertionId = getAssertionId(profile);
      if (!assertionId) {
        return done(replayError('The validated SAML assertion did not contain an ID.'));
      }

      try {
        if (!replayCache.claim(assertionId)) {
          return done(replayError('Duplicate SAML assertion rejected.'));
        }
      } catch (error) {
        return done(error);
      }

      const nameId = firstString(profile.nameID);
      const email = firstString(profile.email, profile.mail, profile.nameID);
      if (!nameId || !email) {
        return done(new Error('The SAML assertion is missing a usable NameID or email address.'));
      }

      return done(null, {
        nameID: nameId,
        nameIDFormat: firstString(profile.nameIDFormat),
        issuer: firstString(profile.issuer),
        email,
        displayName: firstString(profile.displayName, profile.cn, profile.name, nameId),
        givenName: firstString(profile.givenName),
        surname: firstString(profile.sn),
        sessionIndex: firstString(profile.sessionIndex),
        loginFlow: profile.inResponseTo ? 'SP-initiated login' : 'IdP-initiated login',
      });
    }
  );
  passport.use('saml', strategy);
}

module.exports = {
  passport,
  strategy,
  samlStatus,
  replayCache,
};

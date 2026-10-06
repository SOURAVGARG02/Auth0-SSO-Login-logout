const { createPrivateKey, X509Certificate } = require('crypto');

const DEFAULT_ISSUER = 'urn:paxafe:saml-demo';

function appendConnection(url, connection) {
  if (!url || !connection) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection=${encodeURIComponent(connection)}`;
}

function readConfig() {
  const port = Number(process.env.PORT || 3000);
  const appBaseUrl = (process.env.APP_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  const connection = process.env.AUTH0_SAML_CONNECTION || '';
  const entryPoint = process.env.SAML_ENTRY_POINT || process.env.AUTH0_SAML_ENTRY_POINT || '';
  const idpInitiatedUrl = process.env.AUTH0_IDP_INITIATED_URL || '';
  const idpCert = (process.env.SAML_IDP_CERT || process.env.AUTH0_SAML_CERT || '')
    .replace(/\\n/g, '\n')
    .trim();
  const logoutUrl = (process.env.SAML_LOGOUT_URL || '').trim();
  const spPrivateKey = (process.env.SAML_SP_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')
    .trim();
  const spCert = (process.env.SAML_SP_CERT || '')
    .replace(/\\n/g, '\n')
    .trim();
  const issuer = process.env.SAML_ISSUER || DEFAULT_ISSUER;
  const callbackUrl = process.env.SAML_CALLBACK_URL || `${appBaseUrl}/auth/saml/acs`;

  return {
    port,
    appBaseUrl,
    issuer,
    callbackUrl,
    entryPoint: appendConnection(entryPoint, connection),
    idpInitiatedUrl: appendConnection(idpInitiatedUrl, connection),
    idpCert,
    logoutUrl,
    logoutCallbackUrl: `${appBaseUrl}/auth/saml/logout`,
    spPrivateKey,
    spCert,
    auth0Domain: (process.env.AUTH0_DOMAIN || '').replace(/\/+$/, ''),
    auth0ClientId: process.env.AUTH0_CLIENT_ID || '',
    sessionSecret: process.env.SESSION_SECRET || '',
  };
}

function ensureSamlConfiguration(config = readConfig()) {
  const missing = [];
  if (!config.entryPoint) missing.push('SAML_ENTRY_POINT');
  let validCertificate = false;
  if (config.idpCert && !/PASTE_|YOUR_/.test(config.idpCert)) {
    try {
      new X509Certificate(config.idpCert);
      validCertificate = true;
    } catch {
      validCertificate = false;
    }
  }
  if (!validCertificate) {
    missing.push('SAML_IDP_CERT');
  }

  if (missing.length > 0) {
    return {
      configured: false,
      message: `SAML is not configured. Set ${missing.join(' and ')} in .env.`,
    };
  }

  try {
    const entryPointUrl = new URL(config.entryPoint);
    const callbackUrl = new URL(config.callbackUrl);
    if (entryPointUrl.protocol !== 'https:' || !['http:', 'https:'].includes(callbackUrl.protocol)) {
      throw new Error('invalid protocol');
    }
  } catch {
    return {
      configured: false,
      message: 'SAML entry point and callback URL must be valid URLs; the IdP entry point must use HTTPS.',
    };
  }

  return { configured: true, message: 'SAML configuration is present.' };
}

function getSloStatus(config = readConfig()) {
  const hasAnySetting = Boolean(config.logoutUrl || config.spPrivateKey || config.spCert);
  if (!hasAnySetting) {
    return {
      configured: false,
      message: 'SAML Single Logout is not configured; local logout remains available.',
    };
  }

  if (!config.logoutUrl || !config.spPrivateKey || !config.spCert) {
    return {
      configured: false,
      message: 'SAML Single Logout requires SAML_LOGOUT_URL, SAML_SP_PRIVATE_KEY, and SAML_SP_CERT.',
    };
  }

  try {
    const logoutUrl = new URL(config.logoutUrl);
    const appUrl = new URL(config.appBaseUrl);
    const callbackUrl = new URL(config.logoutCallbackUrl);
    const privateKey = createPrivateKey(config.spPrivateKey);
    const certificate = new X509Certificate(config.spCert);

    if (logoutUrl.protocol !== 'https:' || appUrl.protocol !== 'https:' ||
        callbackUrl.protocol !== 'https:' || callbackUrl.origin !== appUrl.origin) {
      throw new Error('SAML Single Logout requires HTTPS IdP and same-origin SP callback URLs.');
    }
    if (!certificate.checkPrivateKey(privateKey)) {
      throw new Error('SAML_SP_CERT does not match SAML_SP_PRIVATE_KEY.');
    }
  } catch (error) {
    return {
      configured: false,
      message: `SAML Single Logout configuration is invalid: ${error.message}`,
    };
  }

  return {
    configured: true,
    message: 'SAML Single Logout is configured.',
  };
}

function createSamlOptions(config = readConfig()) {
  const status = ensureSamlConfiguration(config);
  if (!status.configured) {
    throw new Error(status.message);
  }

  return {
    entryPoint: config.entryPoint,
    issuer: config.issuer,
    callbackUrl: config.callbackUrl,
    audience: config.issuer,
    idpCert: config.idpCert,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    // Auth0 deployments may sign either the response or the assertion. Node-SAML
    // still rejects the response unless at least one trusted signature verifies.
    wantAssertionsSigned: false,
    wantAuthnResponseSigned: false,
    validateInResponseTo: 'ifPresent',
    requestIdExpirationPeriodMs: 5 * 60 * 1000,
    acceptedClockSkewMs: 2 * 60 * 1000,
    maxAssertionAgeMs: 5 * 60 * 1000,
    ...(getSloStatus(config).configured ? {
      logoutUrl: config.logoutUrl,
      logoutCallbackUrl: config.logoutCallbackUrl,
      privateKey: config.spPrivateKey,
      publicCert: config.spCert,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
    } : {}),
  };
}

module.exports = {
  DEFAULT_ISSUER,
  readConfig,
  ensureSamlConfiguration,
  getSloStatus,
  createSamlOptions,
};

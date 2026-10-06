const { X509Certificate } = require('crypto');

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
  };
}

module.exports = {
  DEFAULT_ISSUER,
  readConfig,
  ensureSamlConfiguration,
  createSamlOptions,
};

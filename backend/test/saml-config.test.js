const { describe, test, expect } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const {
  readConfig,
  ensureSamlConfiguration,
  getSloStatus,
  createSamlOptions,
} = require('../src/config/saml');

function samlConfig(overrides = {}) {
  return {
    entryPoint: 'https://tenant.example.test/samlp/app-id',
    callbackUrl: 'http://localhost:3000/auth/saml/acs',
    idpCert: 'invalid certificate',
    ...overrides,
  };
}

const fixturePath = file => fs.readFileSync(path.join(__dirname, 'fixtures', file), 'utf8');
const fixtureKey = fixturePath('slo-test-key.pem');
const fixtureCert = fixturePath('slo-test-cert.pem');

describe('SAML configuration', () => {
test('reads environment settings, applies defaults and normalizes PEM newlines', () => {
  const keys = ['PORT', 'APP_BASE_URL', 'AUTH0_SAML_CONNECTION', 'SAML_ENTRY_POINT',
    'AUTH0_SAML_ENTRY_POINT', 'AUTH0_IDP_INITIATED_URL', 'SAML_IDP_CERT',
    'SAML_LOGOUT_URL', 'SAML_SP_PRIVATE_KEY', 'SAML_SP_CERT', 'SAML_ISSUER',
    'SAML_CALLBACK_URL', 'AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'SESSION_SECRET'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  keys.forEach(key => delete process.env[key]);
  try {
    const defaults = readConfig();
    expect(defaults.port).toBe(3000);
    expect(defaults.issuer).toBe('urn:paxafe:saml-demo');
    expect(defaults.callbackUrl).toBe('http://localhost:3000/auth/saml/acs');
    expect(defaults.logoutCallbackUrl).toBe('http://localhost:3000/auth/saml/logout');
    expect(defaults.entryPoint).toBe('');

    Object.assign(process.env, {
      PORT: '4100', APP_BASE_URL: 'https://sp.example.test/',
      AUTH0_SAML_CONNECTION: 'my connection',
      AUTH0_SAML_ENTRY_POINT: 'https://idp.example.test/login?app=abc',
      AUTH0_IDP_INITIATED_URL: 'https://idp.example.test/launch',
      SAML_IDP_CERT: '  line1\\nline2  ', SAML_SP_PRIVATE_KEY: ' key\\nvalue ',
      SAML_SP_CERT: ' cert\\nvalue ', AUTH0_DOMAIN: 'https://tenant.example.test/',
      AUTH0_CLIENT_ID: 'client', SESSION_SECRET: 'secret',
    });
    const config = readConfig();
    expect(config.port).toBe(4100);
    expect(config.appBaseUrl).toBe('https://sp.example.test');
    expect(config.entryPoint).toBe('https://idp.example.test/login?app=abc&connection=my%20connection');
    expect(config.idpInitiatedUrl).toBe('https://idp.example.test/launch?connection=my%20connection');
    expect(config.idpCert).toBe('line1\nline2');
    expect(config.spPrivateKey).toBe('key\nvalue');
    expect(config.spCert).toBe('cert\nvalue');
    expect(config.auth0Domain).toBe('https://tenant.example.test');
    expect(config.auth0ClientId).toBe('client');
  } finally {
    keys.forEach(key => {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    });
  }
});

test('rejects placeholder certificates instead of attempting to parse them', () => {
  expect(ensureSamlConfiguration(samlConfig({ idpCert: 'YOUR_CERTIFICATE' })).message).toMatch(/SAML_IDP_CERT/);
});

test('requires both a usable IdP certificate and an HTTPS IdP entry point', () => {
  const status = ensureSamlConfiguration(samlConfig());

  expect(status.configured).toBe(false);
  expect(status.message).toMatch(/SAML_IDP_CERT/);
  expect(ensureSamlConfiguration(samlConfig({ entryPoint: 'http://tenant.example.test/samlp' })).configured).toBe(false);
});

test('accepts a valid HTTPS IdP configuration and creates expected strategy options', () => {
  const config = samlConfig({ idpCert: fixtureCert });
  expect(ensureSamlConfiguration(config).configured).toBe(true);
  const options = createSamlOptions(config);
  expect(options.audience).toBe(config.issuer);
  expect(options.wantAssertionsSigned).toBe(false);
  expect(options.validateInResponseTo).toBe('ifPresent');
});

test('rejects a malformed IdP entry point or ACS URL', () => {
  expect(ensureSamlConfiguration(samlConfig({ entryPoint: 'not-a-url' })).configured).toBe(false);
  expect(ensureSamlConfiguration(samlConfig({ callbackUrl: 'not-a-url' })).configured).toBe(false);
});

test('keeps SAML Single Logout optional when none of its settings are supplied', () => {
  const status = getSloStatus({
    appBaseUrl: 'http://localhost:3000',
    logoutUrl: '',
    logoutCallbackUrl: 'http://localhost:3000/auth/saml/logout',
    spPrivateKey: '',
    spCert: '',
  });

  expect(status.configured).toBe(false);
  expect(status.message).toMatch(/local logout remains available/);
});

test('reports incomplete SAML Single Logout configuration explicitly', () => {
  const status = getSloStatus({
    appBaseUrl: 'https://sp.example.test',
    logoutUrl: 'https://idp.example.test/slo',
    logoutCallbackUrl: 'https://sp.example.test/auth/saml/logout',
    spPrivateKey: '',
    spCert: '',
  });

  expect(status.configured).toBe(false);
  expect(status.message).toMatch(/SAML_SP_PRIVATE_KEY/);
});

test('reports invalid SLO URL and key material, and rejects an HTTP SLO endpoint', () => {
  for (const config of [
    { logoutUrl: 'not-a-url', spPrivateKey: 'bad', spCert: 'bad' },
    { logoutUrl: 'http://idp.example.test/slo', spPrivateKey: 'bad', spCert: 'bad' },
  ]) {
    const status = getSloStatus({ appBaseUrl: 'https://sp.example.test',
      logoutCallbackUrl: 'https://sp.example.test/auth/saml/logout', ...config });
    expect(status.configured).toBe(false);
    expect(status.message).toMatch(/invalid|requires HTTPS/i);
  }
});

test('validates SLO HTTPS origins and matching SP signing credentials', () => {
  const valid = {
    appBaseUrl: 'https://sp.example.test',
    logoutUrl: 'https://idp.example.test/slo',
    logoutCallbackUrl: 'https://sp.example.test/auth/saml/logout',
    spPrivateKey: fixtureKey,
    spCert: fixtureCert,
  };
  expect(getSloStatus(valid).configured).toBe(true);
  expect(createSamlOptions(samlConfig({ idpCert: fixtureCert, ...valid }))).toMatchObject({
    logoutUrl: valid.logoutUrl,
    logoutCallbackUrl: valid.logoutCallbackUrl,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
  });
  expect(getSloStatus({ ...valid, appBaseUrl: 'http://sp.example.test',
    logoutCallbackUrl: 'http://sp.example.test/auth/saml/logout' }).configured).toBe(false);
  expect(getSloStatus({ ...valid, logoutCallbackUrl: 'https://other.example.test/logout' }).message)
    .toMatch(/same-origin/);
  expect(getSloStatus({ ...valid, spPrivateKey: fixtureKey.replace('PRIVATE KEY', 'PUBLIC KEY') }).configured)
    .toBe(false);
});

test('throws rather than creating strategy options when SAML login is incomplete', () => {
  expect(() => createSamlOptions(samlConfig())).toThrow(/SAML_IDP_CERT/);
});
});

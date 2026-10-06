const { describe, test, expect } = require('@jest/globals');
const {
  ensureSamlConfiguration,
  getSloStatus,
} = require('../src/config/saml');

function samlConfig(overrides = {}) {
  return {
    entryPoint: 'https://tenant.example.test/samlp/app-id',
    callbackUrl: 'http://localhost:3000/auth/saml/acs',
    idpCert: 'invalid certificate',
    ...overrides,
  };
}

describe('SAML configuration', () => {
test('requires both a usable IdP certificate and an HTTPS IdP entry point', () => {
  const status = ensureSamlConfiguration(samlConfig());

  expect(status.configured).toBe(false);
  expect(status.message).toMatch(/SAML_IDP_CERT/);
  expect(ensureSamlConfiguration(samlConfig({ entryPoint: 'http://tenant.example.test/samlp' })).configured).toBe(false);
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
});

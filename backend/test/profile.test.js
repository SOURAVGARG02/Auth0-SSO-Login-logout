const { describe, test, expect } = require('@jest/globals');
const {
  getAssertionId,
  hasExpectedRecipient,
  matchesLogoutProfile,
} = require('../src/saml/profile');

function makeProfile(assertion) {
  return { getAssertion: () => ({ Assertion: assertion }) };
}

describe('SAML profile helpers', () => {
test('extracts the assertion ID from the parsed assertion', () => {
  const profile = makeProfile({ $: { ID: '_id-1' } });

  expect(getAssertionId(profile)).toBe('_id-1');
  expect(getAssertionId(makeProfile({}))).toBeNull();
});

test('accepts only an assertion addressed to the configured ACS', () => {
  const expectedUrl = 'https://sp.example.test/auth/saml/acs';
  const matchingProfile = makeProfile({
    Subject: [{
      SubjectConfirmation: [{
        SubjectConfirmationData: [{ $: { Recipient: expectedUrl } }],
      }],
    }],
  });
  const wrongRecipientProfile = makeProfile({
    Subject: [{
      SubjectConfirmation: [{
        SubjectConfirmationData: [{ $: { Recipient: 'https://attacker.example.test/acs' } }],
      }],
    }],
  });

  expect(hasExpectedRecipient(matchingProfile, expectedUrl)).toBe(true);
  expect(hasExpectedRecipient(wrongRecipientProfile, expectedUrl)).toBe(false);
  expect(hasExpectedRecipient(makeProfile({}), expectedUrl)).toBe(false);
});

test('rejects an assertion if any subject confirmation targets another ACS', () => {
  const expectedUrl = 'https://sp.example.test/auth/saml/acs';
  const profile = makeProfile({
    Subject: [{
      SubjectConfirmation: [
        { SubjectConfirmationData: [{ $: { Recipient: expectedUrl } }] },
        { SubjectConfirmationData: [{ $: { Recipient: 'https://attacker.example.test/acs' } }] },
      ],
    }],
  });

  expect(hasExpectedRecipient(profile, expectedUrl)).toBe(false);
});

test('classifies login as SP initiated only when the validated response has InResponseTo', () => {
  const { loginFlowFor } = require('../src/saml/profile');

  expect(loginFlowFor({ inResponseTo: '_request-1' })).toBe('SP-initiated login');
  expect(loginFlowFor({})).toBe('IdP-initiated login');
});

test('matches a SAML logout request to the authenticated identity and session', () => {
  const user = {
    nameID: 'reviewer@example.test',
    nameIDFormat: 'email',
    issuer: 'https://tenant.example.test/',
    sessionIndex: '_session-1',
  };

  expect(matchesLogoutProfile(user, {
    nameID: 'reviewer@example.test',
    nameIDFormat: 'email',
    issuer: 'https://tenant.example.test/',
    sessionIndex: '_session-1',
  })).toBe(true);
  expect(matchesLogoutProfile(user, {
    nameID: 'other@example.test',
    issuer: 'https://tenant.example.test/',
  })).toBe(false);
  expect(matchesLogoutProfile(user, {
    nameID: 'reviewer@example.test',
    issuer: 'https://other.example.test/',
  })).toBe(false);
  expect(matchesLogoutProfile(user, {
    nameID: 'reviewer@example.test',
    sessionIndex: '_different',
  })).toBe(false);
});
});

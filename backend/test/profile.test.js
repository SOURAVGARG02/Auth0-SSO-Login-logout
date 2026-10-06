const test = require('node:test');
const assert = require('node:assert/strict');
const { getAssertionId, hasExpectedRecipient } = require('../src/saml/profile');

function makeProfile(assertion) {
  return { getAssertion: () => ({ Assertion: assertion }) };
}

test('extracts the assertion ID from the parsed assertion', () => {
  const profile = makeProfile({ $: { ID: '_id-1' } });

  assert.equal(getAssertionId(profile), '_id-1');
  assert.equal(getAssertionId(makeProfile({})), null);
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

  assert.equal(hasExpectedRecipient(matchingProfile, expectedUrl), true);
  assert.equal(hasExpectedRecipient(wrongRecipientProfile, expectedUrl), false);
  assert.equal(hasExpectedRecipient(makeProfile({}), expectedUrl), false);
});

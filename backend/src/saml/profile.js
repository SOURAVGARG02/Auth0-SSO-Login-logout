function getAssertion(profile) {
  return profile?.getAssertion?.()?.Assertion || null;
}

function getAssertionId(profile) {
  const id = getAssertion(profile)?.$?.ID;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function loginFlowFor(profile) {
  return profile?.inResponseTo ? 'SP-initiated login' : 'IdP-initiated login';
}

function hasExpectedRecipient(profile, callbackUrl) {
  const subjects = getAssertion(profile)?.Subject;
  if (!Array.isArray(subjects) || subjects.length === 0) {
    return false;
  }

  const confirmationData = subjects.flatMap(subject =>
    (subject.SubjectConfirmation || []).flatMap(confirmation =>
      confirmation.SubjectConfirmationData || []
    )
  );

  return confirmationData.length > 0 &&
    confirmationData.every(data => data?.$?.Recipient === callbackUrl);
}

function matchesLogoutProfile(user, profile) {
  if (!user || !profile || typeof profile.nameID !== 'string' ||
      profile.nameID !== user.nameID) {
    return false;
  }

  if (profile.issuer && profile.issuer !== user.issuer) {
    return false;
  }
  if (profile.nameIDFormat && user.nameIDFormat &&
      profile.nameIDFormat !== user.nameIDFormat) {
    return false;
  }
  if (profile.sessionIndex && user.sessionIndex &&
      profile.sessionIndex !== user.sessionIndex) {
    return false;
  }

  return true;
}

module.exports = {
  getAssertionId,
  loginFlowFor,
  hasExpectedRecipient,
  matchesLogoutProfile,
};

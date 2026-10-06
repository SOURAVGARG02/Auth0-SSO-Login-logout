function getAssertion(profile) {
  return profile?.getAssertion?.()?.Assertion || null;
}

function getAssertionId(profile) {
  const id = getAssertion(profile)?.$?.ID;
  return typeof id === 'string' && id.length > 0 ? id : null;
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

module.exports = {
  getAssertionId,
  hasExpectedRecipient,
};

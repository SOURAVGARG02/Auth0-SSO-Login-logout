function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({
    authenticated: false,
    error: 'unauthorized',
    message: 'You must be logged in to access this endpoint.',
  });
}

function sanitizeUser(user = {}) {
  return {
    nameID: user.nameID || null,
    nameIDFormat: user.nameIDFormat || null,
    issuer: user.issuer || null,
    email: user.email || null,
    displayName: user.displayName || null,
    givenName: user.givenName || null,
    surname: user.surname || null,
    sessionIndex: user.sessionIndex || null,
  };
}

module.exports = {
  ensureAuthenticated,
  sanitizeUser,
};

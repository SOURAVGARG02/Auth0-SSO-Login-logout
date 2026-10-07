const { describe, test, expect } = require('@jest/globals');
const { ensureAuthenticated, sanitizeUser } = require('../src/auth/session');

describe('authentication session helpers', () => {
  test('returns an unauthorized response for anonymous requests', () => {
    const req = { isAuthenticated: () => false };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    ensureAuthenticated(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ authenticated: false }));
    expect(next).not.toHaveBeenCalled();
  });

  test('allows an authenticated request through', () => {
    const next = jest.fn();
    ensureAuthenticated({ isAuthenticated: () => true }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns only the supported identity fields and supplies null defaults', () => {
    expect(sanitizeUser({ email: 'a@example.test', sessionIndex: '_s', secret: 'hidden' })).toEqual({
      nameID: null, nameIDFormat: null, issuer: null, email: 'a@example.test',
      displayName: null, givenName: null, surname: null, sessionIndex: '_s',
    });
    expect(sanitizeUser()).toEqual({
      nameID: null, nameIDFormat: null, issuer: null, email: null,
      displayName: null, givenName: null, surname: null, sessionIndex: null,
    });
  });
});

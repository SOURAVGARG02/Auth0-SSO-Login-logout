const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

const originalEnv = { ...process.env };
let router;
let mockPassport;

function loadRoutes({ configured = false, logoutConfigured = false, strategy = null,
  authenticate } = {}) {
  jest.resetModules();
  mockPassport = { authenticate: jest.fn((name, callback) => {
    if (authenticate) return authenticate(name, callback);
    return (req, res) => res.status(302).end();
  }) };
  jest.doMock('../src/auth/passport', () => ({
    passport: mockPassport,
    strategy,
    samlStatus: { configured, message: 'SAML unavailable for test.' },
    samlLogoutStatus: { configured: logoutConfigured, message: 'SLO unavailable for test.' },
  }));
  router = require('../src/routes/auth');
}

function findRoute(method, path) {
  const layer = router.stack.find(item => {
    const routePath = item.route?.path;
    const matchesPath = routePath === path || (Array.isArray(routePath) && routePath.includes(path));
    return matchesPath && (item.route.methods[method] || (method === 'all' && item.route.methods._all));
  });
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not registered`);
  return layer.route.stack.map(item => item.handle);
}

function responseDouble() {
  const res = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; this.__resolve?.(); return this; },
    send(value) { this.body = value; this.__resolve?.(); return this; },
    type(value) { this.headers.type = value; return this; },
    redirect(value) { this.redirectTo = value; this.__resolve?.(); return this; },
    clearCookie(value) { this.clearedCookie = value; return this; },
    end() { this.ended = true; this.__resolve?.(); return this; },
  };
  return res;
}

function requestDouble(overrides = {}) {
  return {
    query: {}, body: {},
    logout: callback => callback(),
    session: { destroy: callback => callback() },
    ...overrides,
  };
}

function invoke(handlers, req, res) {
  let index = 0;
  return new Promise((resolve, reject) => {
    res.__resolve = resolve;
    const next = error => {
      if (error) return reject(error);
      const handler = handlers[index++];
      if (!handler) return resolve();
      try {
        const result = handler(req, res, next);
        if (result && typeof result.then === 'function') result.then(resolve, reject);
      } catch (errorCaught) {
        reject(errorCaught);
      }
    };
    next();
  });
}

describe('authentication routes', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    loadRoutes();
  });
  afterEach(() => {
    jest.dontMock('../src/auth/passport');
    process.env = { ...originalEnv };
  });

  test.each([
    ['get', '/saml/login'], ['post', '/saml/acs'], ['post', '/saml/callback'], ['all', '/saml/logout'],
  ])('blocks %s %s when SAML configuration is missing', async (method, path) => {
    const res = responseDouble();
    await invoke(findRoute(method, path), requestDouble(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.message).toBe('SAML unavailable for test.');
  });

  test.each([
    [{ loginFlow: 'SP-initiated login' }, '/?flow=sp'],
    [{ loginFlow: 'IdP-initiated login' }, '/?flow=idp'],
  ])('logs in a validated SAML profile and redirects to the right flow', async (user, redirect) => {
    loadRoutes({ configured: true, authenticate: (name, callback) =>
      (req, res, next) => callback(null, user)(req, res, next) });
    const req = requestDouble({ logIn: (profile, callback) => callback() });
    const res = responseDouble();
    await invoke(findRoute('post', '/saml/acs'), req, res);
    expect(res.redirectTo).toBe(redirect);
  });

  test('redirects to the error page when SAML rejects a response or returns no user', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    for (const result of [[new Error('invalid response'), null], [null, null]]) {
      loadRoutes({ configured: true, authenticate: (name, callback) =>
        (req, res, next) => callback(...result)(req, res, next) });
      const res = responseDouble();
      await invoke(findRoute('post', '/saml/acs'), requestDouble(), res);
      expect(res.redirectTo).toBe('/?error=saml');
    }
    errorLog.mockRestore();
  });

  test('forwards session login failures to the error handler', async () => {
    loadRoutes({ configured: true, authenticate: (name, callback) =>
      (req, res, next) => callback(null, { loginFlow: 'SP-initiated login' })(req, res, next) });
    await expect(invoke(findRoute('post', '/saml/acs'), requestDouble({
      logIn: (user, callback) => callback(new Error('session failed')),
    }), responseDouble())).rejects.toThrow('session failed');
  });

  test('serves fallback metadata when no SAML strategy is configured', async () => {
    const res = responseDouble();
    await invoke(findRoute('get', '/saml/metadata'), requestDouble(), res);
    expect(res.headers.type).toBe('application/xml');
    expect(res.body).toContain('urn:paxafe:saml-demo');
  });

  test('protects the current-user endpoint and returns sanitized identity when signed in', async () => {
    const anonymousResponse = responseDouble();
    await invoke(findRoute('get', '/me'), { ...requestDouble(), isAuthenticated: () => false }, anonymousResponse);
    expect(anonymousResponse.statusCode).toBe(401);

    const signedInResponse = responseDouble();
    await invoke(findRoute('get', '/me'), {
      ...requestDouble(), isAuthenticated: () => true,
      user: { email: 'person@example.test', secret: 'not exposed', loginFlow: 'SP-initiated login' },
    }, signedInResponse);
    expect(signedInResponse.body.user.email).toBe('person@example.test');
    expect(signedInResponse.body.user.secret).toBeUndefined();
  });

  test('falls back to local logout and clears the session cookie', async () => {
    const res = responseDouble();
    await invoke(findRoute('post', '/logout'), requestDouble(), res);
    expect(res.redirectTo).toBe('/?flow=logout');
    expect(res.clearedCookie).toBe('paxafe.sid');
  });

  test('handles a missing session object and rejects logout when SLO is unavailable', async () => {
    const noSession = responseDouble();
    await invoke(findRoute('post', '/logout'), requestDouble({ session: null }), noSession);
    expect(noSession.clearedCookie).toBe('paxafe.sid');

    loadRoutes({ configured: true, logoutConfigured: false });
    const noSlo = responseDouble();
    await invoke(findRoute('all', '/saml/logout'), requestDouble(), noSlo);
    expect(noSlo.statusCode).toBe(503);
    expect(noSlo.body).toBe('SLO unavailable for test.');
  });

  test('builds an Auth0 logout redirect with a client ID', async () => {
    process.env.AUTH0_DOMAIN = 'https://tenant.example.test/';
    process.env.AUTH0_CLIENT_ID = 'client-123';
    const res = responseDouble();
    await invoke(findRoute('post', '/logout'), requestDouble(), res);
    const target = new URL(res.redirectTo);
    expect(target.pathname).toBe('/v2/logout');
    expect(target.searchParams.get('client_id')).toBe('client-123');
  });

  test('uses configured SAML Single Logout for an authenticated user', async () => {
    const strategy = { logout: (req, callback) => callback(null, 'https://idp.example.test/logout') };
    loadRoutes({ configured: true, logoutConfigured: true, strategy });
    const res = responseDouble();
    await invoke(findRoute('post', '/logout'), requestDouble({ user: { nameID: 'user@example.test' } }), res);
    expect(res.redirectTo).toBe('https://idp.example.test/logout');
    expect(res.clearedCookie).toBe('paxafe.sid');
  });

  test('forwards SAML logout errors and missing IdP redirect URLs', async () => {
    for (const logout of [
      (req, callback) => callback(new Error('SLO failed')),
      (req, callback) => callback(null, null),
    ]) {
      loadRoutes({ configured: true, logoutConfigured: true, strategy: { logout } });
      await expect(invoke(findRoute('post', '/logout'), requestDouble({ user: {} }), responseDouble()))
        .rejects.toThrow();
    }
  });

  test('rejects an insecure Auth0 logout domain through Express error handling', async () => {
    process.env.AUTH0_DOMAIN = 'http://tenant.example.test';
    await expect(invoke(findRoute('post', '/logout'), requestDouble(), responseDouble()))
      .rejects.toThrow(/AUTH0_DOMAIN must use HTTPS/);
  });

  test('validates required SAML logout message and HTTP-Redirect signature', async () => {
    loadRoutes({ configured: true, logoutConfigured: true });
    const missing = responseDouble();
    await invoke(findRoute('all', '/saml/logout'), requestDouble(), missing);
    expect(missing.statusCode).toBe(400);
    expect(missing.body).toMatch(/LogoutRequest or LogoutResponse/);

    const unsigned = responseDouble();
    await invoke(findRoute('all', '/saml/logout'), requestDouble({ query: { SAMLRequest: 'payload' } }), unsigned);
    expect(unsigned.statusCode).toBe(400);
    expect(unsigned.body).toMatch(/must be signed/);
  });

  test('accepts a SAML response logout callback and clears the local session', async () => {
    loadRoutes({ configured: true, logoutConfigured: true,
      authenticate: () => (req, res, next) => next() });
    const res = responseDouble();
    await invoke(findRoute('all', '/saml/logout'), requestDouble({ body: { SAMLResponse: 'response' } }), res);
    expect(res.redirectTo).toBe('/?flow=logout');
    expect(res.clearedCookie).toBe('paxafe.sid');
  });

  test('rejects a validly signed logout request when it is not a LogoutResponse', async () => {
    loadRoutes({ configured: true, logoutConfigured: true,
      authenticate: () => (req, res, next) => next() });
    const res = responseDouble();
    await invoke(findRoute('all', '/saml/logout'), requestDouble({
      query: { SAMLRequest: 'request', Signature: 'signature' },
    }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatch(/was not a LogoutResponse/);
  });

  test('forwards logout and session destruction errors', async () => {
    await expect(invoke(findRoute('post', '/logout'), requestDouble({
      logout: callback => callback(new Error('passport logout failed')),
    }), responseDouble())).rejects.toThrow('passport logout failed');
    await expect(invoke(findRoute('post', '/logout'), requestDouble({
      session: { destroy: callback => callback(new Error('session destroy failed')) },
    }), responseDouble())).rejects.toThrow('session destroy failed');
  });
});

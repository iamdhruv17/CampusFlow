const assert = require('node:assert/strict');
const { describe, it, beforeEach, afterEach } = require('node:test');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth.middleware');
const { requireCsrfToken } = require('../middleware/csrf.middleware');
const { login, register, logout, getMe } = require('../controllers/auth.controller');

const secret = 'campusflow-security-test-secret';
let originalFindById;
let originalFindOne;
let originalCreate;
let originalNotificationCreate;

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  cookies: [],
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  cookie(name, value, options) {
    this.cookies.push({ name, value, options });
    return this;
  },
  clearCookie(name, options) {
    this.cookies.push({ name, value: undefined, options });
    return this;
  },
});

const makeUserQuery = (user) => ({
  select: async () => user,
});

const runProtect = async (token, user) => {
  User.findById = () => makeUserQuery(user);
  const req = { cookies: { token }, headers: {} };
  const res = makeResponse();
  let called = false;
  await protect(req, res, () => {
    called = true;
  });
  return { req, res, called };
};

describe('security middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    originalFindById = User.findById;
    originalFindOne = User.findOne;
    originalCreate = User.create;
    originalNotificationCreate = Notification.create;
    Notification.create = async () => ({});
  });

  afterEach(() => {
    User.findById = originalFindById;
    User.findOne = originalFindOne;
    User.create = originalCreate;
    Notification.create = originalNotificationCreate;
    delete process.env.JWT_SECRET;
  });

  it('rejects invalid and expired JWTs', async () => {
    const invalid = await runProtect('not-a-jwt', { isActive: true, tokenVersion: 0 });
    assert.equal(invalid.res.statusCode, 401);
    assert.equal(invalid.res.body.message, 'Invalid token.');

    const expiredToken = jwt.sign({ id: 'user', tokenVersion: 0 }, secret, { expiresIn: -1 });
    const expired = await runProtect(expiredToken, { isActive: true, tokenVersion: 0 });
    assert.equal(expired.res.statusCode, 401);
    assert.equal(expired.res.body.message, 'Token expired. Please log in again.');
  });

  it('rejects deactivated users and tokens from before a password change', async () => {
    const token = jwt.sign({ id: 'user', tokenVersion: 0 }, secret);
    const deactivated = await runProtect(token, { isActive: false, tokenVersion: 0 });
    assert.equal(deactivated.res.statusCode, 403);

    const revoked = await runProtect(token, { isActive: true, tokenVersion: 1 });
    assert.equal(revoked.res.statusCode, 401);
    assert.equal(revoked.res.body.message, 'Session expired. Please log in again.');
  });

  it('rejects an older JWT after each repeated password version change', async () => {
    const oldToken = jwt.sign({ id: 'user', tokenVersion: 0 }, secret);
    const afterFirstChange = await runProtect(oldToken, { isActive: true, tokenVersion: 1 });
    assert.equal(afterFirstChange.res.statusCode, 401);

    const afterSecondChange = await runProtect(oldToken, { isActive: true, tokenVersion: 2 });
    assert.equal(afterSecondChange.res.statusCode, 401);
  });

  it('requires a matching CSRF token for cookie-authenticated writes', () => {
    const missing = makeResponse();
    requireCsrfToken(
      { method: 'POST', cookies: { token: 'jwt' }, get: () => undefined },
      missing,
      () => assert.fail('missing CSRF token should be rejected')
    );
    assert.equal(missing.statusCode, 403);

    const valid = makeResponse();
    requireCsrfToken(
      {
        method: 'POST',
        cookies: { token: 'jwt', csrfToken: 'csrf-value' },
        get: () => 'csrf-value',
      },
      valid,
      () => {
        valid.statusCode = 204;
      }
    );
    assert.equal(valid.statusCode, 204);
  });

  it('clears both authentication cookies on logout', () => {
    const res = makeResponse();
    logout({}, res);
    assert.deepEqual(
      res.cookies.map((cookie) => cookie.name),
      ['token', 'csrfToken']
    );
  });

  it('does not expose tokenVersion or passwordHash in auth responses', async () => {
    const createAuthUser = () => {
      const authUser = User.hydrate({
        _id: 'auth-user',
        name: 'Auth User',
        email: 'auth@example.invalid',
        role: 'student',
        isActive: true,
        tokenVersion: 3,
        passwordHash: 'stored-hash',
      });
      authUser.comparePassword = async () => true;
      return authUser;
    };
    const responseFor = () => {
      const response = makeResponse();
      response.status = function status(code) {
        this.statusCode = code;
        return this;
      };
      return response;
    };

    const loginUser = createAuthUser();
    User.findOne = () => ({ select: async () => loginUser });
    const loginResponse = responseFor();
    await login({ body: { email: loginUser.email, password: 'password' } }, loginResponse, assert.fail);
    assert.equal(loginResponse.body.user.tokenVersion, undefined);
    assert.equal(loginResponse.body.user.passwordHash, undefined);

    User.findOne = async () => null;
    User.create = async () => createAuthUser();
    const registerResponse = responseFor();
    await register(
      {
        body: {
          name: 'New User',
          email: 'new@example.invalid',
          password: 'password',
          branch: 'Engineering',
        },
      },
      registerResponse,
      assert.fail
    );
    assert.equal(registerResponse.body.user.tokenVersion, undefined);
    assert.equal(registerResponse.body.user.passwordHash, undefined);

    const meResponse = responseFor();
    await getMe({ user: createAuthUser() }, meResponse, assert.fail);
    assert.equal(meResponse.body.user.tokenVersion, undefined);
    assert.equal(meResponse.body.user.passwordHash, undefined);
  });
});

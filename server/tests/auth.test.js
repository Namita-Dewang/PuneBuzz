const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const { errorHandler } = require('../src/middleware/errorHandler');
const { pool, resetDb } = require('./helpers/db');

const alice = { name: 'Alice', email: 'alice@example.com', password: 'correct-horse' };

function register(body = alice) {
  return request(app).post('/api/v1/auth/register').send(body);
}

function login(body) {
  return request(app).post('/api/v1/auth/login').send(body);
}

function me(token) {
  const req = request(app).get('/api/v1/auth/me');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

function expectNoPasswordHash(res) {
  expect(JSON.stringify(res.body)).not.toMatch(/password/i);
}

beforeEach(resetDb);
afterAll(() => pool.end());

describe('POST /api/v1/auth/register', () => {
  it('creates a user and returns a token', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({
      id: expect.any(Number),
      name: 'Alice',
      email: 'alice@example.com',
      role: 'user',
      createdAt: expect.any(String),
    });
    expect(res.body.token).toEqual(expect.any(String));
    expectNoPasswordHash(res);
  });

  it('stores a bcrypt hash, not the plain password', async () => {
    await register();
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [alice.email]);

    expect(rows[0].password_hash).not.toBe(alice.password);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('issues a JWT that expires in 7 days', async () => {
    const res = await register();
    const { sub, iat, exp } = jwt.decode(res.body.token);

    expect(sub).toBe(String(res.body.user.id));
    expect(exp - iat).toBe(7 * 24 * 60 * 60);
  });

  it('normalises the email to trimmed lowercase', async () => {
    const res = await register({ ...alice, email: '  Alice@Example.COM ' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('creates a regular user when no account type is given', async () => {
    const res = await register();

    expect(res.body.user.role).toBe('user');
  });

  it('lets people sign up as an organizer', async () => {
    const res = await register({ ...alice, role: 'organizer' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('organizer');
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.user.role).toBe('organizer');
  });

  it.each(['admin', 'superuser', 'ADMIN', ''])('refuses role %p at sign-up and creates no account', async (role) => {
    const res = await register({ ...alice, role });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ path: 'body.role' })]);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    expect(rows[0].n).toBe(0);
  });

  it('a new organizer can create events straight away', async () => {
    const { body } = await register({ ...alice, role: 'organizer' });

    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${body.token}`)
      .send({ title: 'First event', category: 'tech', startsAt: new Date(Date.now() + 86400000).toISOString(), capacity: 10 });

    expect(res.status).toBe(201);
  });

  it('a regular user still cannot create events', async () => {
    const { body } = await register();

    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${body.token}`)
      .send({ title: 'Sneaky event', category: 'tech', startsAt: new Date(Date.now() + 86400000).toISOString(), capacity: 10 });

    expect(res.status).toBe(403);
  });

  it('rejects a duplicate email with 409, case-insensitively', async () => {
    await register();
    const res = await register({ ...alice, email: 'ALICE@example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'EMAIL_TAKEN', message: expect.any(String) },
    });
  });

  it.each([
    ['missing name', { email: alice.email, password: alice.password }, 'body.name'],
    ['blank name', { ...alice, name: '   ' }, 'body.name'],
    ['invalid email', { ...alice, email: 'not-an-email' }, 'body.email'],
    ['short password', { ...alice, password: 'short' }, 'body.password'],
    ['password over 72 bytes', { ...alice, password: 'é'.repeat(37) }, 'body.password'],
  ])('rejects %s with 400', async (_label, body, path) => {
    const res = await register(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })])
    );
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => register());

  it('returns the user and a token for correct credentials', async () => {
    const res = await login({ email: 'ALICE@example.com', password: alice.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(alice.email);
    expect(res.body.token).toEqual(expect.any(String));
    expectNoPasswordHash(res);
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await login({ email: alice.email, password: 'wrong-password' });
    const unknownEmail = await login({ email: 'nobody@example.com', password: alice.password });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }
  });

  it('rejects a missing password with 400', async () => {
    const res = await login({ email: alice.email });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const { body } = await register();
    const res = await me(body.token);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(body.user);
    expectNoPasswordHash(res);
  });

  it('returns 401 AUTH_REQUIRED without a token', async () => {
    const res = await me();

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('returns 401 AUTH_REQUIRED for a non-Bearer header', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Basic abc');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('returns 401 INVALID_TOKEN for a garbage token', async () => {
    const res = await me('not.a.jwt');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 INVALID_TOKEN for a token signed with another secret', async () => {
    const { body } = await register();
    const forged = jwt.sign({ sub: String(body.user.id) }, 'some-other-secret-at-least-32-chars!!');
    const res = await me(forged);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 INVALID_TOKEN for an unsigned (alg: none) token', async () => {
    const { body } = await register();
    const unsigned = jwt.sign({ sub: String(body.user.id) }, null, { algorithm: 'none' });
    const res = await me(unsigned);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 TOKEN_EXPIRED for an expired token', async () => {
    const { body } = await register();
    const expired = jwt.sign(
      { sub: String(body.user.id), exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET
    );
    const res = await me(expired);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 401 INVALID_TOKEN once the user no longer exists', async () => {
    const { body } = await register();
    await pool.query('DELETE FROM users WHERE id = $1', [body.user.id]);
    const res = await me(body.token);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('requireRole middleware', () => {
  // No real route uses requireRole yet, so mount a throwaway one.
  const roleApp = express();
  roleApp.get('/organizer-only', auth, requireRole('organizer', 'admin'), (req, res) => {
    res.json({ ok: true, role: req.user.role });
  });
  roleApp.use(errorHandler);

  function hitWith(token) {
    return request(roleApp).get('/organizer-only').set('Authorization', `Bearer ${token}`);
  }

  it('returns 403 FORBIDDEN for a plain user', async () => {
    const { body } = await register();
    const res = await hitWith(body.token);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows an organizer, using the role from the database rather than the token', async () => {
    const { body } = await register();
    // Promote after the token was issued; the same token should now pass.
    await pool.query("UPDATE users SET role = 'organizer' WHERE id = $1", [body.user.id]);
    const res = await hitWith(body.token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, role: 'organizer' });
  });

  it('returns 401 when used without auth in front of it', async () => {
    const bare = express();
    bare.get('/x', requireRole('organizer'), (req, res) => res.json({ ok: true }));
    bare.use(errorHandler);
    const res = await request(bare).get('/x');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });
});

// Low limits, set before the app loads. Jest gives each test file its own
// module registry, so config/env.js is parsed fresh with these values.
process.env.AUTH_LOGIN_MAX = '3';
process.env.AUTH_REGISTER_MAX = '2';
process.env.RSVP_MAX = '3';
// Trust one proxy so each test can act as a distinct client via X-Forwarded-For.
process.env.TRUST_PROXY = '1';

const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb } = require('./helpers/db');

const password = 'correct-horse';
let nextIp = 1;

// A fresh client IP per test keeps the in-memory counters independent.
function client() {
  const ip = `203.0.113.${nextIp++}`;
  return {
    register: (email) =>
      request(app)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', ip)
        .send({ name: 'Test', email, password }),
    login: (email, pw) =>
      request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email, password: pw }),
  };
}

beforeEach(resetDb);
afterAll(() => pool.end());

describe('login rate limit', () => {
  it('blocks after AUTH_LOGIN_MAX failed attempts with 429 RATE_LIMITED', async () => {
    const c = client();
    await c.register('a@example.com');

    for (let i = 0; i < 3; i++) {
      expect((await c.login('a@example.com', 'wrong-password')).status).toBe(401);
    }
    const blocked = await c.login('a@example.com', 'wrong-password');

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
    });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('also blocks the correct password once the limit is hit', async () => {
    const c = client();
    await c.register('b@example.com');

    for (let i = 0; i < 3; i++) await c.login('b@example.com', 'wrong-password');
    const res = await c.login('b@example.com', password);

    expect(res.status).toBe(429);
  });

  it('does not count successful logins', async () => {
    const c = client();
    await c.register('c@example.com');

    for (let i = 0; i < 5; i++) {
      expect((await c.login('c@example.com', password)).status).toBe(200);
    }
  });

  it('counts malformed requests, which are rejected before validation', async () => {
    const c = client();

    for (let i = 0; i < 3; i++) expect((await c.login('not-an-email', '')).status).toBe(400);
    expect((await c.login('not-an-email', '')).status).toBe(429);
  });

  it('limits each client IP separately', async () => {
    const attacker = client();
    const bystander = client();
    await bystander.register('d@example.com');

    for (let i = 0; i < 4; i++) await attacker.login('d@example.com', 'wrong-password');

    expect((await attacker.login('d@example.com', password)).status).toBe(429);
    expect((await bystander.login('d@example.com', password)).status).toBe(200);
  });

  it('sends standard RateLimit headers', async () => {
    const res = await client().login('e@example.com', 'wrong-password');

    expect(res.headers['ratelimit-policy']).toMatch(/q=3/);
    expect(res.headers.ratelimit).toMatch(/r=2/);
  });
});

describe('RSVP rate limit', () => {
  const { createEvent } = require('./helpers/factories');

  // This file's sign-up limit is 2 per IP, so each user registers from its own IP.
  async function userWithOwnIp(role = 'user') {
    const ip = `198.51.100.${nextIp++}`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', ip)
      .send({ name: 'Test', email: `rsvp-${ip}@example.com`, password });
    if (role !== 'user') await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, res.body.user.id]);
    return { ...res.body.user, token: res.body.token };
  }

  it('allows RSVP_MAX RSVP/cancel actions per user, then 429, without affecting others', async () => {
    const org = await userWithOwnIp('organizer');
    const event = await createEvent(org, { capacity: 5 });
    const [busy, other] = [await userWithOwnIp(), await userWithOwnIp()];
    const act = (u, method) =>
      request(app)[method](`/api/v1/events/${event.id}/rsvp`).set('Authorization', `Bearer ${u.token}`);

    expect((await act(busy, 'post')).status).toBe(201);
    expect((await act(busy, 'delete')).status).toBe(200);
    expect((await act(busy, 'post')).status).toBe(201);
    const blocked = await act(busy, 'delete');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect((await act(other, 'post')).status).toBe(201);
  });

  it('runs after auth: an anonymous request gets 401, not a rate-limit count', async () => {
    const res = await request(app).post('/api/v1/events/1/rsvp');

    expect(res.status).toBe(401);
  });
});

describe('register rate limit', () => {
  it('blocks after AUTH_REGISTER_MAX sign-ups per IP, successful or not', async () => {
    const c = client();

    expect((await c.register('f1@example.com')).status).toBe(201);
    expect((await c.register('f1@example.com')).status).toBe(409);
    const blocked = await c.register('f2@example.com');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

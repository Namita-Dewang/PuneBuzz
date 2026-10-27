const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb } = require('./helpers/db');
const { createUser, createVenue, bearer } = require('./helpers/factories');

const api = request(app);

beforeEach(resetDb);
afterAll(() => pool.end());

describe('GET /api/v1/venues', () => {
  it('lists all venues publicly, ordered by area then name', async () => {
    await createVenue({ name: 'Zeta Hall', area: 'Baner' });
    await createVenue({ name: 'Alpha Hall', area: 'Kothrud' });
    await createVenue({ name: 'Alpha Hall', area: 'Baner', lat: 18.559, lng: 73.7868 });

    const res = await api.get('/api/v1/venues');

    expect(res.status).toBe(200);
    expect(res.body.data.map((v) => `${v.area}/${v.name}`)).toEqual([
      'Baner/Alpha Hall', 'Baner/Zeta Hall', 'Kothrud/Alpha Hall',
    ]);
    expect(res.body.data[0]).toEqual({
      id: expect.any(Number), name: 'Alpha Hall', area: 'Baner', address: null, lat: 18.559, lng: 73.7868,
    });
  });
});

describe('POST /api/v1/venues', () => {
  const valid = { name: 'Riverside Studio', area: 'Kalyani Nagar', address: 'Kalyani Nagar, Pune', lat: 18.5463, lng: 73.9033 };

  it('lets an organizer add a venue', async () => {
    const org = await createUser({ role: 'organizer' });

    const res = await api.post('/api/v1/venues').set(bearer(org)).send(valid);

    expect(res.status).toBe(201);
    expect(res.body.venue).toEqual({ id: expect.any(Number), ...valid });
  });

  it('allows a venue without coordinates or address', async () => {
    const org = await createUser({ role: 'organizer' });

    const res = await api.post('/api/v1/venues').set(bearer(org)).send({ name: 'Pop-up', area: 'Camp' });

    expect(res.status).toBe(201);
    expect(res.body.venue).toMatchObject({ address: null, lat: null, lng: null });
  });

  it('requires the organizer role', async () => {
    const user = await createUser();

    expect((await api.post('/api/v1/venues').send(valid)).status).toBe(401);
    expect((await api.post('/api/v1/venues').set(bearer(user)).send(valid)).status).toBe(403);
  });

  it.each([
    ['lat without lng', { lng: undefined }, 'body.lng'],
    ['out-of-range lat', { lat: 91 }, 'body.lat'],
    ['missing area', { area: undefined }, 'body.area'],
  ])('rejects %s with 400', async (_label, override, path) => {
    const org = await createUser({ role: 'organizer' });

    const res = await api.post('/api/v1/venues').set(bearer(org)).send({ ...valid, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
  });
});

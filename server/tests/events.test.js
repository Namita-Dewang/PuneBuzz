const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb } = require('./helpers/db');
const {
  HOUR, DAY, createUser, createVenue, createEvent, addRsvp, addToWaitlist, bearer,
} = require('./helpers/factories');

const api = request(app);

beforeEach(resetDb);
afterAll(() => pool.end());

function futureIso(ms) {
  return new Date(Date.now() + ms).toISOString();
}

function titles(res) {
  return res.body.data.map((e) => e.title);
}

// ---------------------------------------------------------------------------
// GET /events
// ---------------------------------------------------------------------------

describe('GET /api/v1/events', () => {
  let org;
  beforeEach(async () => {
    org = await createUser({ role: 'organizer', name: 'Org One' });
  });

  it('returns only published, upcoming events by default, soonest first', async () => {
    await createEvent(org, { title: 'Later', startsIn: 5 * DAY });
    await createEvent(org, { title: 'Sooner', startsIn: 1 * DAY });
    await createEvent(org, { title: 'Past', startsIn: -1 * DAY });
    await createEvent(org, { title: 'Draft', status: 'draft' });
    await createEvent(org, { title: 'Cancelled', status: 'cancelled' });

    const res = await api.get('/api/v1/events');

    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Sooner', 'Later']);
    expect(res.body).toMatchObject({ page: 1, limit: 20, total: 2 });
  });

  it('returns the documented event shape', async () => {
    const venue = await createVenue({ name: 'Hall', area: 'Kothrud', lat: 18.5074, lng: 73.8077 });
    await createEvent(org, { title: 'Shaped', venueId: venue.id, capacity: 10, seatsTaken: 4, price: 250.5 });

    const res = await api.get('/api/v1/events');

    expect(res.body.data[0]).toEqual({
      id: expect.any(Number),
      title: 'Shaped',
      description: 'A test event',
      category: 'tech',
      startsAt: expect.any(String),
      endsAt: null,
      capacity: 10,
      seatsTaken: 4,
      seatsLeft: 6,
      price: 250.5,
      isFree: false,
      status: 'published',
      createdAt: expect.any(String),
      organizer: { id: org.id, name: 'Org One' },
      venue: { id: venue.id, name: 'Hall', area: 'Kothrud', address: null, lat: 18.5074, lng: 73.8077 },
    });
  });

  it('filters by category', async () => {
    await createEvent(org, { title: 'Gig', category: 'music' });
    await createEvent(org, { title: 'Meetup', category: 'tech' });

    expect(titles(await api.get('/api/v1/events?category=music'))).toEqual(['Gig']);
  });

  it('filters by venue area, case-insensitively', async () => {
    const baner = await createVenue({ area: 'Baner' });
    const kp = await createVenue({ area: 'Koregaon Park' });
    await createEvent(org, { title: 'In Baner', venueId: baner.id });
    await createEvent(org, { title: 'In KP', venueId: kp.id });
    await createEvent(org, { title: 'No venue' });

    expect(titles(await api.get('/api/v1/events?area=koregaon%20park'))).toEqual(['In KP']);
  });

  it('filters free=true and free=false', async () => {
    await createEvent(org, { title: 'Free', price: 0 });
    await createEvent(org, { title: 'Paid', price: 100 });

    expect(titles(await api.get('/api/v1/events?free=true'))).toEqual(['Free']);
    expect(titles(await api.get('/api/v1/events?free=false'))).toEqual(['Paid']);
  });

  it('searches title and description with q, case-insensitively', async () => {
    await createEvent(org, { title: 'Node.js Night', description: 'talks', startsIn: 1 * DAY });
    await createEvent(org, { title: 'Jam', description: 'Bring your NODE projects', startsIn: 2 * DAY });
    await createEvent(org, { title: 'Pottery', description: 'clay', startsIn: 3 * DAY });

    expect(titles(await api.get('/api/v1/events?q=node'))).toEqual(['Node.js Night', 'Jam']);
  });

  it('treats % and _ in q literally', async () => {
    await createEvent(org, { title: '100% Jazz' });
    await createEvent(org, { title: '1000 Jazz fans' });
    await createEvent(org, { title: 'snake_case talk' });
    await createEvent(org, { title: 'snakeXcase talk' });

    expect(titles(await api.get('/api/v1/events?q=100%25'))).toEqual(['100% Jazz']);
    expect(titles(await api.get('/api/v1/events?q=snake_case'))).toEqual(['snake_case talk']);
  });

  it('filters by from/to datetimes', async () => {
    await createEvent(org, { title: 'Day 2', startsIn: 2 * DAY });
    await createEvent(org, { title: 'Day 5', startsIn: 5 * DAY });
    await createEvent(org, { title: 'Day 9', startsIn: 9 * DAY });

    const res = await api.get('/api/v1/events').query({ from: futureIso(3 * DAY), to: futureIso(6 * DAY) });

    expect(titles(res)).toEqual(['Day 5']);
  });

  it('treats a date-only `to` as the whole of that day in Pune time', async () => {
    // 23:30 IST on 2030-01-15 is 18:00 UTC; 00:30 IST on the 16th is 19:00 UTC on the 15th.
    const lateOn15th = await createEvent(org, { title: 'Late on 15th' });
    const earlyOn16th = await createEvent(org, { title: 'Early on 16th' });
    await pool.query("UPDATE events SET starts_at = '2030-01-15T23:30:00+05:30' WHERE id = $1", [lateOn15th.id]);
    await pool.query("UPDATE events SET starts_at = '2030-01-16T00:30:00+05:30' WHERE id = $1", [earlyOn16th.id]);

    expect(titles(await api.get('/api/v1/events?from=2030-01-15&to=2030-01-15'))).toEqual(['Late on 15th']);
    expect(titles(await api.get('/api/v1/events?from=2030-01-16&to=2030-01-16'))).toEqual(['Early on 16th']);
  });

  it('includes past events when `from` is explicitly in the past', async () => {
    await createEvent(org, { title: 'Yesterday', startsIn: -1 * DAY });

    const res = await api.get('/api/v1/events').query({ from: futureIso(-2 * DAY) });

    expect(titles(res)).toEqual(['Yesterday']);
  });

  it('combines filters', async () => {
    const baner = await createVenue({ area: 'Baner' });
    await createEvent(org, { title: 'Free tech in Baner', category: 'tech', venueId: baner.id, price: 0 });
    await createEvent(org, { title: 'Paid tech in Baner', category: 'tech', venueId: baner.id, price: 99 });
    await createEvent(org, { title: 'Free music in Baner', category: 'music', venueId: baner.id, price: 0 });

    const res = await api.get('/api/v1/events?category=tech&area=Baner&free=true');

    expect(titles(res)).toEqual(['Free tech in Baner']);
    expect(res.body.total).toBe(1);
  });

  it('paginates with page and limit, reporting the filtered total', async () => {
    for (let i = 1; i <= 5; i++) await createEvent(org, { title: `E${i}`, startsIn: i * HOUR });

    const page2 = await api.get('/api/v1/events?page=2&limit=2');
    const beyond = await api.get('/api/v1/events?page=9&limit=2');

    expect(titles(page2)).toEqual(['E3', 'E4']);
    expect(page2.body).toMatchObject({ page: 2, limit: 2, total: 5 });
    expect(beyond.body).toMatchObject({ data: [], page: 9, total: 5 });
  });

  it.each([
    ['unknown category', 'category=poetry', 'query.category'],
    ['limit over 100', 'limit=101', 'query.limit'],
    ['page 0', 'page=0', 'query.page'],
    ['non-numeric page', 'page=abc', 'query.page'],
    ['free=yes', 'free=yes', 'query.free'],
    ['bad date', 'from=2026-02-30', 'query.from'],
    ['datetime without zone', 'from=2026-11-01T10:00:00', 'query.from'],
    ['from after to', 'from=2030-02-01&to=2030-01-01', 'query.to'],
  ])('rejects %s with 400', async (_label, qs, path) => {
    const res = await api.get(`/api/v1/events?${qs}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
  });

  it('is not vulnerable to SQL injection through filters', async () => {
    await createEvent(org, { title: 'Safe' });

    const res = await api.get('/api/v1/events').query({ q: "'; DROP TABLE events; --", area: "x' OR '1'='1" });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM events')).rows[0].n).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /events/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/events/:id', () => {
  let org;
  beforeEach(async () => {
    org = await createUser({ role: 'organizer' });
  });

  it('returns seatsLeft, waitlistCount and myStatus null when anonymous', async () => {
    const event = await createEvent(org, { capacity: 5, seatsTaken: 3 });

    const res = await api.get(`/api/v1/events/${event.id}`);

    expect(res.status).toBe(200);
    expect(res.body.event).toMatchObject({ id: event.id, capacity: 5, seatsLeft: 2, waitlistCount: 0, myStatus: null });
  });

  it('returns myStatus none for a logged-in user who has not joined', async () => {
    const event = await createEvent(org);
    const user = await createUser();

    const res = await api.get(`/api/v1/events/${event.id}`).set(bearer(user));

    expect(res.body.event.myStatus).toEqual({ status: 'none' });
  });

  it('returns myStatus confirmed for a user with an RSVP', async () => {
    const event = await createEvent(org);
    const user = await createUser();
    await addRsvp(event.id, user.id);

    const res = await api.get(`/api/v1/events/${event.id}`).set(bearer(user));

    expect(res.body.event.myStatus).toEqual({ status: 'confirmed' });
    expect(res.body.event.seatsLeft).toBe(9);
  });

  it('returns myStatus waitlisted with the 1-based queue position', async () => {
    const event = await createEvent(org, { capacity: 1 });
    const [a, b, c] = [await createUser(), await createUser(), await createUser()];
    await addToWaitlist(event.id, a.id, 30);
    await addToWaitlist(event.id, b.id, 20);
    await addToWaitlist(event.id, c.id, 10);

    const forB = await api.get(`/api/v1/events/${event.id}`).set(bearer(b));
    const forC = await api.get(`/api/v1/events/${event.id}`).set(bearer(c));

    expect(forB.body.event.myStatus).toEqual({ status: 'waitlisted', position: 2 });
    expect(forC.body.event.myStatus).toEqual({ status: 'waitlisted', position: 3 });
    expect(forB.body.event.waitlistCount).toBe(3);
  });

  it('treats an invalid token as anonymous instead of failing', async () => {
    const event = await createEvent(org);

    const res = await api.get(`/api/v1/events/${event.id}`).set('Authorization', 'Bearer garbage');

    expect(res.status).toBe(200);
    expect(res.body.event.myStatus).toBeNull();
  });

  it('shows cancelled events (attendees need to see that)', async () => {
    const event = await createEvent(org, { status: 'cancelled' });

    const res = await api.get(`/api/v1/events/${event.id}`);

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('cancelled');
  });

  it('hides drafts from everyone except the organizer and admins', async () => {
    const event = await createEvent(org, { status: 'draft' });
    const stranger = await createUser({ role: 'organizer' });
    const admin = await createUser({ role: 'admin' });

    expect((await api.get(`/api/v1/events/${event.id}`)).status).toBe(404);
    expect((await api.get(`/api/v1/events/${event.id}`).set(bearer(stranger))).status).toBe(404);
    expect((await api.get(`/api/v1/events/${event.id}`).set(bearer(org))).status).toBe(200);
    expect((await api.get(`/api/v1/events/${event.id}`).set(bearer(admin))).status).toBe(200);
  });

  it('returns 404 for a missing event and 400 for a bad id', async () => {
    expect((await api.get('/api/v1/events/999999')).body.error.code).toBe('EVENT_NOT_FOUND');
    expect((await api.get('/api/v1/events/abc')).status).toBe(400);
    expect((await api.get('/api/v1/events/99999999999')).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /events
// ---------------------------------------------------------------------------

describe('POST /api/v1/events', () => {
  const valid = () => ({
    title: 'New Meetup',
    category: 'tech',
    startsAt: futureIso(3 * DAY),
    capacity: 50,
  });

  it('requires a token and the organizer role', async () => {
    const user = await createUser();

    expect((await api.post('/api/v1/events').send(valid())).status).toBe(401);
    const res = await api.post('/api/v1/events').set(bearer(user)).send(valid());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('creates an event owned by the caller, with defaults', async () => {
    const org = await createUser({ role: 'organizer' });

    const res = await api.post('/api/v1/events').set(bearer(org)).send(valid());

    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({
      title: 'New Meetup',
      capacity: 50,
      seatsTaken: 0,
      seatsLeft: 50,
      price: 0,
      isFree: true,
      status: 'published',
      organizer: { id: org.id },
      venue: null,
    });
  });

  it('accepts all optional fields', async () => {
    const org = await createUser({ role: 'organizer' });
    const venue = await createVenue({ area: 'Wakad' });
    const startsAt = futureIso(3 * DAY);

    const res = await api.post('/api/v1/events').set(bearer(org)).send({
      ...valid(),
      startsAt,
      description: 'Details',
      venueId: venue.id,
      endsAt: futureIso(3 * DAY + 2 * HOUR),
      price: 19.99,
      status: 'draft',
    });

    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({
      description: 'Details', price: 19.99, status: 'draft', venue: { id: venue.id, area: 'Wakad' },
    });
    expect(new Date(res.body.event.startsAt).toISOString()).toBe(startsAt);
  });

  it('ignores fields the client must not set (organizer, seatsTaken)', async () => {
    const org = await createUser({ role: 'organizer' });
    const other = await createUser({ role: 'organizer' });

    const res = await api.post('/api/v1/events').set(bearer(org))
      .send({ ...valid(), organizerId: other.id, organizer_id: other.id, seatsTaken: 49 });

    expect(res.status).toBe(201);
    expect(res.body.event.organizer.id).toBe(org.id);
    expect(res.body.event.seatsTaken).toBe(0);
  });

  it('returns 400 INVALID_VENUE for a venue that does not exist', async () => {
    const org = await createUser({ role: 'organizer' });

    const res = await api.post('/api/v1/events').set(bearer(org)).send({ ...valid(), venueId: 424242 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_VENUE');
  });

  it.each([
    ['missing title', { title: undefined }, 'body.title'],
    ['unknown category', { category: 'poetry' }, 'body.category'],
    ['start in the past', { startsAt: futureIso(-HOUR) }, 'body.startsAt'],
    ['start without zone', { startsAt: '2030-01-01T10:00:00' }, 'body.startsAt'],
    ['end before start', { endsAt: futureIso(2 * DAY) }, 'body.endsAt'],
    ['zero capacity', { capacity: 0 }, 'body.capacity'],
    ['fractional capacity', { capacity: 2.5 }, 'body.capacity'],
    ['negative price', { price: -1 }, 'body.price'],
    ['price with 3 decimals', { price: 1.234 }, 'body.price'],
    ['cancelled status', { status: 'cancelled' }, 'body.status'],
  ])('rejects %s with 400', async (_label, override, path) => {
    const org = await createUser({ role: 'organizer' });

    const res = await api.post('/api/v1/events').set(bearer(org)).send({ ...valid(), ...override });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
  });
});

// ---------------------------------------------------------------------------
// PATCH /events/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/events/:id', () => {
  let org;
  beforeEach(async () => {
    org = await createUser({ role: 'organizer' });
  });

  function patch(event, user, body) {
    return api.patch(`/api/v1/events/${event.id}`).set(bearer(user)).send(body);
  }

  it('lets the owner update fields', async () => {
    const event = await createEvent(org);

    const res = await patch(event, org, { title: 'Renamed', price: 150, description: null });

    expect(res.status).toBe(200);
    expect(res.body.event).toMatchObject({ title: 'Renamed', price: 150, description: null });
  });

  it('returns 403 for another organizer and 401 without a token', async () => {
    const event = await createEvent(org);
    const other = await createUser({ role: 'organizer' });

    const res = await patch(event, other, { title: 'Hijacked' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await api.patch(`/api/v1/events/${event.id}`).send({ title: 'x' })).status).toBe(401);

    const { rows } = await pool.query('SELECT title FROM events WHERE id = $1', [event.id]);
    expect(rows[0].title).toBe('Test Event');
  });

  it("returns 404 for someone else's draft", async () => {
    const event = await createEvent(org, { status: 'draft' });
    const other = await createUser({ role: 'organizer' });

    expect((await patch(event, other, { title: 'Valid title' })).status).toBe(404);
  });

  it('lets an admin update any event', async () => {
    const event = await createEvent(org);
    const admin = await createUser({ role: 'admin' });

    expect((await patch(event, admin, { title: 'Moderated' })).status).toBe(200);
  });

  it('rejects capacity below seats_taken with 409', async () => {
    const event = await createEvent(org, { capacity: 10, seatsTaken: 6 });

    const res = await patch(event, org, { capacity: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAPACITY_BELOW_SEATS_TAKEN');
  });

  it('allows capacity equal to seats_taken', async () => {
    const event = await createEvent(org, { capacity: 10, seatsTaken: 6 });

    const res = await patch(event, org, { capacity: 6 });

    expect(res.status).toBe(200);
    expect(res.body.event.seatsLeft).toBe(0);
  });

  it('promotes waitlisted users, oldest first, when capacity goes up', async () => {
    const event = await createEvent(org, { capacity: 1 });
    const [confirmed, first, second, third] = [
      await createUser(), await createUser(), await createUser(), await createUser(),
    ];
    await addRsvp(event.id, confirmed.id);
    await addToWaitlist(event.id, first.id, 30);
    await addToWaitlist(event.id, second.id, 20);
    await addToWaitlist(event.id, third.id, 10);

    const res = await patch(event, org, { capacity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.event).toMatchObject({ capacity: 3, seatsTaken: 3, seatsLeft: 0 });
    const rsvps = await pool.query('SELECT user_id FROM rsvps WHERE event_id = $1 ORDER BY user_id', [event.id]);
    expect(rsvps.rows.map((r) => r.user_id)).toEqual([confirmed.id, first.id, second.id]);
    const waitlist = await pool.query('SELECT user_id FROM waitlist WHERE event_id = $1', [event.id]);
    expect(waitlist.rows.map((r) => r.user_id)).toEqual([third.id]);
  });

  it('checks endsAt against the stored startsAt', async () => {
    const event = await createEvent(org, { startsIn: 5 * DAY });

    const res = await patch(event, org, { endsAt: futureIso(4 * DAY) });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ path: 'body.endsAt' })]);
  });

  it('refuses to unpublish an event people have joined', async () => {
    const event = await createEvent(org);
    await addRsvp(event.id, (await createUser()).id);

    const res = await patch(event, org, { status: 'draft' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_HAS_ATTENDEES');
  });

  it('returns 409 for a cancelled event', async () => {
    const event = await createEvent(org, { status: 'cancelled' });

    const res = await patch(event, org, { title: 'Back from the dead' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_CANCELLED');
  });

  it.each([
    ['an empty body', {}],
    ['status cancelled', { status: 'cancelled' }],
    ['only unknown fields', { seatsTaken: 0 }],
    ['venueId that does not exist', { venueId: 424242 }],
  ])('rejects %s with 400', async (_label, body) => {
    const event = await createEvent(org);

    expect((await patch(event, org, body)).status).toBe(400);
  });

  it('returns 404 for a missing event', async () => {
    expect((await patch({ id: 999999 }, org, { title: 'Valid title' })).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /events/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/events/:id', () => {
  let org;
  beforeEach(async () => {
    org = await createUser({ role: 'organizer' });
  });

  it('cancels the event, keeps its RSVPs, and drops it from the list', async () => {
    const event = await createEvent(org);
    const user = await createUser();
    await addRsvp(event.id, user.id);

    const res = await api.delete(`/api/v1/events/${event.id}`).set(bearer(org));

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('cancelled');
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM rsvps WHERE event_id = $1', [event.id]);
    expect(rows[0].n).toBe(1);
    expect((await api.get('/api/v1/events')).body.total).toBe(0);
  });

  it('returns 403 for a non-owner and leaves the event published', async () => {
    const event = await createEvent(org);
    const user = await createUser();

    const res = await api.delete(`/api/v1/events/${event.id}`).set(bearer(user));

    expect(res.status).toBe(403);
    const { rows } = await pool.query('SELECT status FROM events WHERE id = $1', [event.id]);
    expect(rows[0].status).toBe('published');
  });

  it('returns 409 when the event is already cancelled', async () => {
    const event = await createEvent(org);
    await api.delete(`/api/v1/events/${event.id}`).set(bearer(org));

    const res = await api.delete(`/api/v1/events/${event.id}`).set(bearer(org));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_CANCELLED');
  });

  it('returns 404 for a missing event', async () => {
    expect((await api.delete('/api/v1/events/999999').set(bearer(org))).status).toBe(404);
  });
});

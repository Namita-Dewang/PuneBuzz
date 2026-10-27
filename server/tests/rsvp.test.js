const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb } = require('./helpers/db');
const {
  DAY, createUser, createEvent, addRsvp, addToWaitlist, bearer,
} = require('./helpers/factories');

const api = request(app);

beforeEach(resetDb);
afterAll(() => pool.end());

function rsvp(eventId, user) {
  return api.post(`/api/v1/events/${eventId}/rsvp`).set(bearer(user));
}

function cancel(eventId, user) {
  return api.delete(`/api/v1/events/${eventId}/rsvp`).set(bearer(user));
}

async function seatsTaken(eventId) {
  const { rows } = await pool.query('SELECT seats_taken FROM events WHERE id = $1', [eventId]);
  return rows[0].seats_taken;
}

let org;
beforeEach(async () => {
  org = await createUser({ role: 'organizer', name: 'Organizer' });
});

// ---------------------------------------------------------------------------
// POST /events/:id/rsvp
// ---------------------------------------------------------------------------

describe('POST /api/v1/events/:id/rsvp', () => {
  it('confirms while seats are free, then waitlists with increasing positions', async () => {
    const event = await createEvent(org, { capacity: 2 });
    const [a, b, c, d] = [await createUser(), await createUser(), await createUser(), await createUser()];

    expect((await rsvp(event.id, a)).body).toEqual({ status: 'confirmed' });
    expect((await rsvp(event.id, b)).body).toEqual({ status: 'confirmed' });
    const third = await rsvp(event.id, c);
    expect(third.status).toBe(201);
    expect(third.body).toEqual({ status: 'waitlisted', position: 1 });
    expect((await rsvp(event.id, d)).body).toEqual({ status: 'waitlisted', position: 2 });
    expect(await seatsTaken(event.id)).toBe(2);
  });

  it('returns 409 ALREADY_JOINED for a second RSVP, whether confirmed or waitlisted', async () => {
    const event = await createEvent(org, { capacity: 1 });
    const [a, b] = [await createUser(), await createUser()];
    await rsvp(event.id, a);
    await rsvp(event.id, b);

    for (const user of [a, b]) {
      const res = await rsvp(event.id, user);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_JOINED');
    }
  });

  it.each([
    ['cancelled', { status: 'cancelled' }],
    ['draft', { status: 'draft' }],
    ['already started', { startsIn: -1 * DAY }],
  ])('returns 409 EVENT_CLOSED for a %s event', async (_label, overrides) => {
    const event = await createEvent(org, overrides);

    const res = await rsvp(event.id, await createUser());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_CLOSED');
  });

  it('returns 404 for a missing event, 400 for a bad id, 401 without a token', async () => {
    const user = await createUser();

    expect((await rsvp(999999, user)).body.error.code).toBe('EVENT_NOT_FOUND');
    expect((await rsvp('abc', user)).status).toBe(400);
    expect((await api.post('/api/v1/events/1/rsvp')).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /events/:id/rsvp
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/events/:id/rsvp', () => {
  it('frees the seat when nobody is waiting', async () => {
    const event = await createEvent(org, { capacity: 3 });
    const user = await createUser();
    await rsvp(event.id, user);

    const res = await cancel(event.id, user);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'cancelled' });
    expect(await seatsTaken(event.id)).toBe(0);
  });

  it('hands the seat to the oldest waitlisted user', async () => {
    const event = await createEvent(org, { capacity: 1 });
    const [holder, first, second] = [await createUser(), await createUser(), await createUser()];
    await addRsvp(event.id, holder.id);
    await addToWaitlist(event.id, second.id, 10);
    await addToWaitlist(event.id, first.id, 20); // joined earlier, so first in line

    await cancel(event.id, holder);

    const { rows } = await pool.query('SELECT user_id FROM rsvps WHERE event_id = $1', [event.id]);
    expect(rows.map((r) => r.user_id)).toEqual([first.id]);
    expect(await seatsTaken(event.id)).toBe(1);
  });

  it('leaves the waitlist without touching seats', async () => {
    const event = await createEvent(org, { capacity: 1 });
    const [holder, waiting] = [await createUser(), await createUser()];
    await rsvp(event.id, holder);
    await rsvp(event.id, waiting);

    const res = await cancel(event.id, waiting);

    expect(res.body).toEqual({ status: 'left_waitlist' });
    expect(await seatsTaken(event.id)).toBe(1);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM waitlist WHERE event_id = $1', [event.id]);
    expect(rows[0].n).toBe(0);
  });

  it('moves everyone behind a leaver up one place', async () => {
    const event = await createEvent(org, { capacity: 1 });
    const [holder, a, b, c] = [await createUser(), await createUser(), await createUser(), await createUser()];
    for (const u of [holder, a, b, c]) await rsvp(event.id, u);

    await cancel(event.id, a);

    const status = async (u) => (await api.get(`/api/v1/events/${event.id}`).set(bearer(u))).body.event.myStatus;
    expect(await status(b)).toEqual({ status: 'waitlisted', position: 1 });
    expect(await status(c)).toEqual({ status: 'waitlisted', position: 2 });
  });

  it('returns 404 NOT_JOINED when there is nothing to cancel, and 404 for a missing event', async () => {
    const event = await createEvent(org);
    const user = await createUser();

    expect((await cancel(event.id, user)).body.error.code).toBe('NOT_JOINED');
    expect((await cancel(999999, user)).body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('can RSVP again after cancelling', async () => {
    const event = await createEvent(org);
    const user = await createUser();
    await rsvp(event.id, user);
    await cancel(event.id, user);

    expect((await rsvp(event.id, user)).body).toEqual({ status: 'confirmed' });
  });
});

// ---------------------------------------------------------------------------
// GET /events/:id/attendees
// ---------------------------------------------------------------------------

describe('GET /api/v1/events/:id/attendees', () => {
  it('returns confirmed attendees and the waitlist in queue order to the organizer', async () => {
    const event = await createEvent(org, { capacity: 1 });
    const [a, b, c] = [
      await createUser({ name: 'Asha' }), await createUser({ name: 'Bilal' }), await createUser({ name: 'Chetan' }),
    ];
    for (const u of [a, b, c]) await rsvp(event.id, u);

    const res = await api.get(`/api/v1/events/${event.id}/attendees`).set(bearer(org));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      confirmed: [{ id: a.id, name: 'Asha', email: a.email, rsvpAt: expect.any(String) }],
      waitlist: [
        { position: 1, id: b.id, name: 'Bilal', email: b.email, joinedAt: expect.any(String) },
        { position: 2, id: c.id, name: 'Chetan', email: c.email, joinedAt: expect.any(String) },
      ],
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('is forbidden to attendees and other organizers, allowed for admins', async () => {
    const event = await createEvent(org);
    const attendee = await createUser();
    await rsvp(event.id, attendee);
    const otherOrg = await createUser({ role: 'organizer' });
    const admin = await createUser({ role: 'admin' });
    const get = (u) => api.get(`/api/v1/events/${event.id}/attendees`).set(bearer(u));

    expect((await get(attendee)).status).toBe(403);
    expect((await get(otherOrg)).status).toBe(403);
    expect((await get(admin)).status).toBe(200);
    expect((await api.get(`/api/v1/events/${event.id}/attendees`)).status).toBe(401);
  });

  it('returns 404 for a missing event', async () => {
    expect((await api.get('/api/v1/events/999999/attendees').set(bearer(org))).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /me/events
// ---------------------------------------------------------------------------

describe('GET /api/v1/me/events', () => {
  it('groups events into attending, waitlisted (with position) and organizing', async () => {
    const user = await createUser({ role: 'organizer' });
    const someone = await createUser();
    const going = await createEvent(org, { title: 'Going', startsIn: 2 * DAY });
    const full = await createEvent(org, { title: 'Full', capacity: 1, startsIn: 3 * DAY });
    const mine = await createEvent(user, { title: 'Mine', status: 'draft' });
    await createEvent(org, { title: 'Unrelated' });

    await rsvp(going.id, user);
    await rsvp(full.id, someone);
    await rsvp(full.id, (await createUser()));
    await rsvp(full.id, user); // second in the queue

    const res = await api.get('/api/v1/me/events').set(bearer(user));

    expect(res.status).toBe(200);
    expect(res.body.attending.map((e) => e.title)).toEqual(['Going']);
    expect(res.body.waitlisted.map((e) => [e.title, e.position])).toEqual([['Full', 2]]);
    expect(res.body.organizing.map((e) => [e.title, e.status])).toEqual([['Mine', 'draft']]);
    expect(res.body.attending[0]).toMatchObject({ seatsLeft: 9, organizer: { name: 'Organizer' } });
  });

  it('returns empty lists for a new user and 401 without a token', async () => {
    const user = await createUser();

    expect((await api.get('/api/v1/me/events').set(bearer(user))).body)
      .toEqual({ attending: [], waitlisted: [], organizing: [] });
    expect((await api.get('/api/v1/me/events')).status).toBe(401);
  });
});

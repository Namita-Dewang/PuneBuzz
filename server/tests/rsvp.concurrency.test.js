// Proves the event-row lock (SELECT ... FOR UPDATE) in rsvp.service keeps seat
// allocation correct when many requests hit the same event at once. Remove
// FOR UPDATE from rsvp() and the first test fails: requests read a stale
// seats_taken, too many get confirmed, and the CHECK constraint starts
// rejecting them with 500s.
const http = require('http');
const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb } = require('./helpers/db');
const { createUser, createEvent, bearer } = require('./helpers/factories');

const CAPACITY = 5;
const USERS = 20;

// One real listening server, so all requests are genuinely in flight together.
let server;
beforeAll((done) => {
  server = http.createServer(app).listen(0, done);
});
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});
beforeEach(resetDb);

async function setup() {
  const organizer = await createUser({ role: 'organizer' });
  const event = await createEvent(organizer, { capacity: CAPACITY });
  const users = [];
  for (let i = 0; i < USERS; i++) users.push(await createUser());
  return { event, users };
}

function rsvp(event, user) {
  return request(server).post(`/api/v1/events/${event.id}/rsvp`).set(bearer(user));
}

function cancel(event, user) {
  return request(server).delete(`/api/v1/events/${event.id}/rsvp`).set(bearer(user));
}

async function dbState(eventId) {
  const { rows } = await pool.query(
    `SELECT e.seats_taken,
            (SELECT COUNT(*)::int FROM rsvps WHERE event_id = e.id) AS rsvps,
            (SELECT COUNT(*)::int FROM waitlist WHERE event_id = e.id) AS waitlist
       FROM events e WHERE e.id = $1`,
    [eventId]
  );
  return rows[0];
}

// Fires one RSVP per user, all at once; returns each user with their response.
async function rsvpAllAtOnce(event, users) {
  const responses = await Promise.all(users.map((u) => rsvp(event, u)));
  return users.map((user, i) => ({ user, res: responses[i] }));
}

function byPosition(results) {
  return results
    .filter((r) => r.res.body.status === 'waitlisted')
    .sort((a, b) => a.res.body.position - b.res.body.position);
}

describe('RSVP concurrency', () => {
  it(`gives exactly ${CAPACITY} of ${USERS} simultaneous RSVPs a seat and waitlists the rest`, async () => {
    const { event, users } = await setup();

    const results = await rsvpAllAtOnce(event, users);

    const statuses = results.map((r) => r.res.status);
    expect(statuses).toEqual(Array(USERS).fill(201));

    const confirmed = results.filter((r) => r.res.body.status === 'confirmed');
    const waitlisted = results.filter((r) => r.res.body.status === 'waitlisted');
    expect(confirmed).toHaveLength(5);
    expect(waitlisted).toHaveLength(15);

    // Every waitlisted user got a distinct place in line: 1..15.
    const positions = waitlisted.map((r) => r.res.body.position).sort((a, b) => a - b);
    expect(positions).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));

    expect(await dbState(event.id)).toEqual({ seats_taken: 5, rsvps: 5, waitlist: 15 });
  });

  it('cancelling a confirmed RSVP promotes waitlist #1 and keeps seats_taken at capacity', async () => {
    const { event, users } = await setup();
    const results = await rsvpAllAtOnce(event, users);
    const leaving = results.find((r) => r.res.body.status === 'confirmed').user;
    const queue = byPosition(results);
    const [first, second] = [queue[0].user, queue[1].user];

    const res = await cancel(event, leaving);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'cancelled' });
    expect(await dbState(event.id)).toEqual({ seats_taken: 5, rsvps: 5, waitlist: 14 });

    const seen = (u) => request(server).get(`/api/v1/events/${event.id}`).set(bearer(u));
    expect((await seen(first)).body.event.myStatus).toEqual({ status: 'confirmed' });
    expect((await seen(second)).body.event.myStatus).toEqual({ status: 'waitlisted', position: 1 });
    expect((await seen(leaving)).body.event.myStatus).toEqual({ status: 'none' });
  });

  it('promotes the 5 oldest waitlisted users, in order, when all 5 confirmed cancel at once', async () => {
    const { event, users } = await setup();
    const results = await rsvpAllAtOnce(event, users);
    const confirmed = results.filter((r) => r.res.body.status === 'confirmed').map((r) => r.user);
    const queue = byPosition(results).map((r) => r.user);

    const responses = await Promise.all(confirmed.map((u) => cancel(event, u)));

    expect(responses.map((r) => r.status)).toEqual(Array(5).fill(200));
    expect(await dbState(event.id)).toEqual({ seats_taken: 5, rsvps: 5, waitlist: 10 });

    const { rows } = await pool.query('SELECT user_id FROM rsvps WHERE event_id = $1', [event.id]);
    expect(rows.map((r) => r.user_id).sort((a, b) => a - b))
      .toEqual(queue.slice(0, 5).map((u) => u.id).sort((a, b) => a - b));
  });

  it('lets a double-clicked RSVP from the same user through only once', async () => {
    const { event, users } = await setup();
    const [user] = users;

    const responses = await Promise.all([rsvp(event, user), rsvp(event, user), rsvp(event, user)]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(responses.filter((r) => r.status === 409).map((r) => r.body.error.code))
      .toEqual(['ALREADY_JOINED', 'ALREADY_JOINED']);
    expect(await dbState(event.id)).toEqual({ seats_taken: 1, rsvps: 1, waitlist: 0 });
  });

  it('keeps seats_taken equal to the number of RSVPs under mixed RSVPs and cancels', async () => {
    const { event, users } = await setup();
    const early = users.slice(0, 10);
    const late = users.slice(10);
    await rsvpAllAtOnce(event, early); // 5 confirmed, 5 waitlisted

    // Everyone from the first wave cancels while the second wave joins.
    const responses = await Promise.all([
      ...early.map((u) => cancel(event, u)),
      ...late.map((u) => rsvp(event, u)),
    ]);

    expect(responses.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    const state = await dbState(event.id);
    expect(state.seats_taken).toBe(state.rsvps);
    expect(state.seats_taken).toBeLessThanOrEqual(CAPACITY);
    // Only the 10 late users remain, so all 5 seats are filled and 5 wait.
    expect(state).toEqual({ seats_taken: 5, rsvps: 5, waitlist: 5 });
  });
});

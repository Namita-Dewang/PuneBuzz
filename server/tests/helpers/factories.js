// Test data builders. Users go through the real register endpoint (so tokens
// are real); venues, events, RSVPs and waitlist rows are inserted directly so
// tests can set up states the API wouldn't allow, like past events.
const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('./db');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let counter = 0;

async function createUser({ role = 'user', name } = {}) {
  counter += 1;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: name || `User ${counter}`, email: `user${counter}@example.com`, password: 'password123' });
  if (res.status !== 201) throw new Error(`createUser failed: ${JSON.stringify(res.body)}`);
  if (role !== 'user') {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, res.body.user.id]);
  }
  return { ...res.body.user, role, token: res.body.token };
}

async function createVenue(overrides = {}) {
  const v = { name: 'Test Venue', area: 'Baner', address: null, lat: null, lng: null, ...overrides };
  const { rows } = await pool.query(
    `INSERT INTO venues (name, area, address, lat, lng) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [v.name, v.area, v.address, v.lat, v.lng]
  );
  return { ...v, id: rows[0].id };
}

// startsIn is milliseconds from now (negative for past events).
async function createEvent(organizer, overrides = {}) {
  const e = {
    title: 'Test Event',
    description: 'A test event',
    category: 'tech',
    venueId: null,
    startsIn: 7 * DAY,
    capacity: 10,
    seatsTaken: 0,
    price: 0,
    status: 'published',
    ...overrides,
  };
  const { rows } = await pool.query(
    `INSERT INTO events (organizer_id, venue_id, title, description, category,
                         starts_at, capacity, seats_taken, price, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [organizer.id, e.venueId, e.title, e.description, e.category,
      new Date(Date.now() + e.startsIn), e.capacity, e.seatsTaken, e.price, e.status]
  );
  return { ...e, id: rows[0].id };
}

// Confirms a seat the way the RSVP service will: insert + bump seats_taken.
async function addRsvp(eventId, userId) {
  await pool.query('INSERT INTO rsvps (event_id, user_id) VALUES ($1, $2)', [eventId, userId]);
  await pool.query('UPDATE events SET seats_taken = seats_taken + 1 WHERE id = $1', [eventId]);
}

// secondsAgo controls queue order (larger = earlier in line).
async function addToWaitlist(eventId, userId, secondsAgo = 0) {
  await pool.query(
    `INSERT INTO waitlist (event_id, user_id, created_at)
     VALUES ($1, $2, now() - make_interval(secs => $3))`,
    [eventId, userId, secondsAgo]
  );
}

async function createRole(eventId, overrides = {}) {
  const r = { title: 'Registration desk', description: 'Welcome people at the door', spots: 2, spotsFilled: 0, ...overrides };
  const { rows } = await pool.query(
    `INSERT INTO volunteer_roles (event_id, title, description, spots, spots_filled)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [eventId, r.title, r.description, r.spots, r.spotsFilled]
  );
  return { ...r, id: rows[0].id };
}

const ANSWERS = {
  motivation: 'I love live music and want to help the evening run smoothly.',
  volunteeredBefore: true,
  pastExperience: 'Helped at two college fests.',
  skills: 'Crowd management, first aid',
  availability: 'full',
  phone: '+91 98765 43210',
};

// Inserts an application directly. Pass status 'accepted' with care: it
// doesn't touch spots_filled (set that on the role yourself).
async function addApplication(roleId, userId, status = 'pending', answers = ANSWERS) {
  const { rows } = await pool.query(
    `INSERT INTO volunteer_applications
       (role_id, user_id, status, motivation, volunteered_before, past_experience, skills, availability, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [roleId, userId, status, answers.motivation, answers.volunteeredBefore, answers.pastExperience, answers.skills, answers.availability, answers.phone]
  );
  return rows[0].id;
}

function bearer(user) {
  return { Authorization: `Bearer ${user.token}` };
}

module.exports = {
  HOUR, DAY, ANSWERS, createUser, createVenue, createEvent, addRsvp, addToWaitlist, createRole, addApplication, bearer,
};

const http = require('http');
const ExcelJS = require('exceljs');
const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb } = require('./helpers/db');
const {
  DAY, ANSWERS, createUser, createVenue, createEvent, createRole, addApplication, bearer,
} = require('./helpers/factories');

const api = request(app);

beforeEach(resetDb);
afterAll(() => pool.end());

const opportunities = (qs = '', user) => {
  const req = api.get(`/api/v1/volunteer-opportunities${qs}`);
  return user ? req.set(bearer(user)) : req;
};
const titles = (res) => res.body.data.map((e) => e.title);

async function roleState(roleId) {
  const { rows } = await pool.query('SELECT spots, spots_filled FROM volunteer_roles WHERE id = $1', [roleId]);
  return rows[0];
}

// ---------------------------------------------------------------------------
// GET /volunteer-opportunities
// ---------------------------------------------------------------------------

describe('GET /api/v1/volunteer-opportunities', () => {
  let org;
  beforeEach(async () => {
    org = await createUser({ role: 'organizer', name: 'Org' });
  });

  it('lists published upcoming events that have a role with spots left, with event basics and open roles', async () => {
    const venue = await createVenue({ name: 'Riverside Studio', area: 'Kalyani Nagar' });
    const event = await createEvent(org, { title: 'Jazz Night', category: 'music', venueId: venue.id, startsIn: 2 * DAY });
    const role = await createRole(event.id, { title: 'Ushers', spots: 3, spotsFilled: 1 });

    const res = await opportunities();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 20, total: 1 });
    expect(res.body.data[0]).toEqual({
      id: event.id,
      title: 'Jazz Night',
      startsAt: expect.any(String),
      category: 'music',
      venue: { name: 'Riverside Studio', area: 'Kalyani Nagar' },
      roles: [{ id: role.id, title: 'Ushers', description: 'Welcome people at the door', spots: 3, spotsLeft: 2 }],
    });
    expect(new Date(res.body.data[0].startsAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('excludes events with no roles, only full roles, or that are draft, cancelled or past', async () => {
    await createEvent(org, { title: 'No roles' });
    const full = await createEvent(org, { title: 'All full' });
    await createRole(full.id, { spots: 2, spotsFilled: 2 });
    for (const [title, overrides] of [['Draft', { status: 'draft' }], ['Cancelled', { status: 'cancelled' }], ['Past', { startsIn: -DAY }]]) {
      const e = await createEvent(org, { title, ...overrides });
      await createRole(e.id);
    }
    const open = await createEvent(org, { title: 'Open' });
    await createRole(open.id);

    expect(titles(await opportunities())).toEqual(['Open']);
  });

  it('lists only the open roles of an event', async () => {
    const event = await createEvent(org);
    await createRole(event.id, { title: 'Full role', spots: 1, spotsFilled: 1 });
    await createRole(event.id, { title: 'Open role', spots: 2 });

    const res = await opportunities();

    expect(res.body.data[0].roles.map((r) => r.title)).toEqual(['Open role']);
  });

  it("includes the caller's status per role when logged in (and a full role they applied to)", async () => {
    const event = await createEvent(org);
    const open = await createRole(event.id, { title: 'Open', spots: 3 });
    const full = await createRole(event.id, { title: 'Full but mine', spots: 1, spotsFilled: 1 });
    const other = await createRole(event.id, { title: 'Untouched', spots: 2 });
    const me = await createUser();
    await addApplication(open.id, me.id, 'pending');
    await addApplication(full.id, me.id, 'accepted');

    const mine = await opportunities('', me);
    const anon = await opportunities();

    const byTitle = Object.fromEntries(mine.body.data[0].roles.map((r) => [r.title, r]));
    expect(byTitle.Open.myStatus).toBe('pending');
    expect(byTitle['Full but mine']).toMatchObject({ myStatus: 'accepted', spotsLeft: 0 });
    expect(byTitle.Untouched.myStatus).toBeNull();
    expect(anon.body.data[0].roles.map((r) => r.title)).toEqual(['Open', 'Untouched']);
    expect(anon.body.data[0].roles.every((r) => !('myStatus' in r))).toBe(true);
    expect(other.id).toBeDefined();
  });

  it('excludes events the caller organizes', async () => {
    const other = await createUser({ role: 'organizer' });
    await createRole((await createEvent(org, { title: 'Mine' })).id);
    await createRole((await createEvent(other, { title: 'Theirs' })).id);

    expect(titles(await opportunities('', org))).toEqual(['Theirs']);
    expect(titles(await opportunities()).sort()).toEqual(['Mine', 'Theirs']);
  });

  it('supports category, area, q, from/to and pagination like /events', async () => {
    const baner = await createVenue({ area: 'Baner' });
    const camp = await createVenue({ area: 'Camp' });
    const specs = [
      ['Tech in Baner', 'tech', baner.id, 1], ['Music in Camp', 'music', camp.id, 2],
      ['Tech in Camp', 'tech', camp.id, 3], ['100% Fun Run', 'sports', baner.id, 40],
    ];
    for (const [title, category, venueId, days] of specs) {
      await createRole((await createEvent(org, { title, category, venueId, startsIn: days * DAY })).id);
    }

    expect(titles(await opportunities('?category=tech'))).toEqual(['Tech in Baner', 'Tech in Camp']);
    expect(titles(await opportunities('?area=camp'))).toEqual(['Music in Camp', 'Tech in Camp']);
    expect(titles(await opportunities('?q=100%25'))).toEqual(['100% Fun Run']);
    const to = new Date(Date.now() + 10 * DAY).toISOString();
    expect(titles(await opportunities(`?to=${encodeURIComponent(to)}`))).toHaveLength(3);

    const page2 = await opportunities('?limit=3&page=2');
    expect(page2.body).toMatchObject({ page: 2, limit: 3, total: 4 });
    expect(titles(page2)).toEqual(['100% Fun Run']);
    const beyond = await opportunities('?limit=3&page=5');
    expect(beyond.body).toMatchObject({ data: [], total: 4 });
  });

  it('rejects invalid filters with 400', async () => {
    for (const qs of ['?category=poetry', '?limit=101', '?from=2030-02-01&to=2030-01-01']) {
      expect((await opportunities(qs)).status).toBe(400);
    }
  });

  it('runs as a single SQL query, however many events and roles match', async () => {
    for (let i = 0; i < 5; i++) {
      const e = await createEvent(org, { startsIn: (i + 1) * DAY });
      await createRole(e.id);
      await createRole(e.id, { title: 'Second role' });
    }
    const spy = jest.spyOn(pool, 'query');

    const res = await opportunities();

    expect(res.body.data).toHaveLength(5);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Event roles + applying
// ---------------------------------------------------------------------------

describe('volunteer roles and applications', () => {
  let org;
  let event;
  let role;
  beforeEach(async () => {
    org = await createUser({ role: 'organizer' });
    event = await createEvent(org);
    role = await createRole(event.id, { spots: 2 });
  });

  const applyTo = (roleId, user, body = ANSWERS) => api.post(`/api/v1/volunteer-roles/${roleId}/applications`).set(bearer(user)).send(body);

  it('GET /events/:id/volunteer-roles is public; includes myStatus with a token', async () => {
    const me = await createUser();
    await addApplication(role.id, me.id);

    const anon = await api.get(`/api/v1/events/${event.id}/volunteer-roles`);
    const mine = await api.get(`/api/v1/events/${event.id}/volunteer-roles`).set(bearer(me));

    expect(anon.body.roles).toEqual([{ id: role.id, title: role.title, description: role.description, spots: 2, spotsFilled: 0, spotsLeft: 2 }]);
    expect(mine.body.roles[0].myStatus).toBe('pending');
  });

  it("hides a draft event's roles from everyone but its organizer", async () => {
    const draft = await createEvent(org, { status: 'draft' });
    await createRole(draft.id);

    expect((await api.get(`/api/v1/events/${draft.id}/volunteer-roles`)).status).toBe(404);
    expect((await api.get(`/api/v1/events/${draft.id}/volunteer-roles`).set(bearer(org))).status).toBe(200);
  });

  it('applies with the five answers -> 201 pending, and stores them', async () => {
    const me = await createUser();

    const res = await applyTo(role.id, me);

    expect(res.status).toBe(201);
    expect(res.body.application).toMatchObject({ roleId: role.id, status: 'pending' });
    const { rows } = await pool.query('SELECT motivation, volunteered_before, availability, phone FROM volunteer_applications');
    expect(rows[0]).toEqual({ motivation: ANSWERS.motivation, volunteered_before: true, availability: 'full', phone: '+91 98765 43210' });
    expect(await roleState(role.id)).toEqual({ spots: 2, spots_filled: 0 }); // applying alone takes no spot
  });

  it.each([
    ['short motivation', { motivation: 'Sounds fun' }, 'body.motivation'],
    ['missing yes/no', { volunteeredBefore: undefined }, 'body.volunteeredBefore'],
    ['bad availability', { availability: 'weekends' }, 'body.availability'],
    ['bad phone', { phone: 'call me' }, 'body.phone'],
  ])('rejects %s with 400', async (_l, override, path) => {
    const res = await applyTo(role.id, await createUser(), { ...ANSWERS, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
  });

  it('rejects duplicates, own events, full roles, closed events and anonymous callers', async () => {
    const me = await createUser();
    await applyTo(role.id, me);
    expect((await applyTo(role.id, me)).body.error.code).toBe('ALREADY_APPLIED');

    expect((await applyTo(role.id, org)).status).toBe(403);

    const full = await createRole(event.id, { spots: 1, spotsFilled: 1 });
    expect((await applyTo(full.id, me)).body.error.code).toBe('ROLE_FULL');

    const past = await createEvent(org, { startsIn: -DAY });
    const pastRole = await createRole(past.id);
    expect((await applyTo(pastRole.id, me)).body.error.code).toBe('EVENT_CLOSED');

    expect((await api.post(`/api/v1/volunteer-roles/${role.id}/applications`).send(ANSWERS)).status).toBe(401);
  });

  it('withdrawing an accepted application frees its spot', async () => {
    const me = await createUser();
    await addApplication(role.id, me.id, 'accepted');
    await pool.query('UPDATE volunteer_roles SET spots_filled = 1 WHERE id = $1', [role.id]);

    const res = await api.delete(`/api/v1/volunteer-roles/${role.id}/applications/me`).set(bearer(me));

    expect(res.status).toBe(204);
    expect(await roleState(role.id)).toEqual({ spots: 2, spots_filled: 0 });
    expect((await api.delete(`/api/v1/volunteer-roles/${role.id}/applications/me`).set(bearer(me))).body.error.code).toBe('NOT_APPLIED');
  });
});

// ---------------------------------------------------------------------------
// Organizer: roles, review, export
// ---------------------------------------------------------------------------

describe('organizer volunteer management', () => {
  let org;
  let event;
  beforeEach(async () => {
    org = await createUser({ role: 'organizer', name: 'Org' });
    event = await createEvent(org, { title: 'Pune JS Meetup' });
  });

  it('creates, edits and deletes roles; others get 403', async () => {
    const other = await createUser({ role: 'organizer' });
    const created = await api.post(`/api/v1/events/${event.id}/volunteer-roles`).set(bearer(org)).send({ title: 'Stage crew', spots: 4 });
    expect(created.status).toBe(201);
    expect(created.body.role).toMatchObject({ title: 'Stage crew', spots: 4, spotsLeft: 4, description: null });
    const id = created.body.role.id;

    expect((await api.post(`/api/v1/events/${event.id}/volunteer-roles`).set(bearer(other)).send({ title: 'Nope', spots: 1 })).status).toBe(403);
    expect((await api.post(`/api/v1/events/${event.id}/volunteer-roles`).set(bearer(org)).send({ title: 'X', spots: 0 })).status).toBe(400);

    const edited = await api.patch(`/api/v1/volunteer-roles/${id}`).set(bearer(org)).send({ spots: 6, description: 'Lights and sound' });
    expect(edited.body.role).toMatchObject({ spots: 6, description: 'Lights and sound' });
    expect((await api.patch(`/api/v1/volunteer-roles/${id}`).set(bearer(other)).send({ spots: 1 })).status).toBe(403);

    expect((await api.delete(`/api/v1/volunteer-roles/${id}`).set(bearer(org))).status).toBe(204);
  });

  it("won't drop spots below accepted volunteers or delete a role with applications", async () => {
    const role = await createRole(event.id, { spots: 3, spotsFilled: 2 });
    await addApplication(role.id, (await createUser()).id, 'accepted');

    const lower = await api.patch(`/api/v1/volunteer-roles/${role.id}`).set(bearer(org)).send({ spots: 1 });
    const del = await api.delete(`/api/v1/volunteer-roles/${role.id}`).set(bearer(org));

    expect(lower.body.error.code).toBe('SPOTS_BELOW_ACCEPTED');
    expect(del.body.error.code).toBe('ROLE_HAS_APPLICATIONS');
  });

  it('lists roles with applications and answers; organizer only', async () => {
    const role = await createRole(event.id);
    const v = await createUser({ name: 'Asha' });
    await addApplication(role.id, v.id);

    const res = await api.get(`/api/v1/events/${event.id}/volunteer-applications`).set(bearer(org));

    expect(res.status).toBe(200);
    expect(res.body.roles[0].applications[0]).toMatchObject({
      status: 'pending',
      user: { id: v.id, name: 'Asha', email: v.email },
      answers: { motivation: ANSWERS.motivation, volunteeredBefore: true, availability: 'full', phone: '+91 98765 43210' },
    });
    expect((await api.get(`/api/v1/events/${event.id}/volunteer-applications`).set(bearer(v))).status).toBe(403);
  });

  it('accepting takes a spot, declining an accepted volunteer frees it, and a full role refuses more', async () => {
    const role = await createRole(event.id, { spots: 1 });
    const [a, b] = [await createUser(), await createUser()];
    const appA = await addApplication(role.id, a.id);
    const appB = await addApplication(role.id, b.id);
    const set = (id, status) => api.patch(`/api/v1/volunteer-applications/${id}`).set(bearer(org)).send({ status });

    expect((await set(appA, 'accepted')).body.application.status).toBe('accepted');
    expect(await roleState(role.id)).toEqual({ spots: 1, spots_filled: 1 });
    expect((await set(appB, 'accepted')).body.error.code).toBe('ROLE_FULL');

    await set(appA, 'declined');
    expect(await roleState(role.id)).toEqual({ spots: 1, spots_filled: 0 });
    expect((await set(appB, 'accepted')).status).toBe(200);
    expect((await api.patch(`/api/v1/volunteer-applications/${appB}`).set(bearer(a)).send({ status: 'declined' })).status).toBe(403);
  });

  it('two simultaneous accepts for the last spot: exactly one wins', async () => {
    const role = await createRole(event.id, { spots: 1 });
    const apps = [];
    for (let i = 0; i < 20; i++) apps.push(await addApplication(role.id, (await createUser()).id));
    const server = http.createServer(app).listen(0);
    try {
      const results = await Promise.all(apps.map((id) =>
        request(server).patch(`/api/v1/volunteer-applications/${id}`).set(bearer(org)).send({ status: 'accepted' })));
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(19);
      expect(await roleState(role.id)).toEqual({ spots: 1, spots_filled: 1 });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('exports an Excel file with every application and all five answers; formulas stay text', async () => {
    const role = await createRole(event.id, { title: 'Registration desk' });
    const v = await createUser({ name: 'Bilal' });
    await addApplication(role.id, v.id, 'pending', { ...ANSWERS, skills: '=HYPERLINK("http://evil","click")', volunteeredBefore: false, pastExperience: null });

    const res = await api
      .get(`/api/v1/events/${event.id}/volunteer-applications/export`)
      .set(bearer(org))
      .buffer(true)
      .parse((r, cb) => { const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toBe('attachment; filename="volunteers-pune-js-meetup.xlsx"');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const sheet = wb.worksheets[0];
    const header = sheet.getRow(1).values.slice(1);
    const row = sheet.getRow(2).values.slice(1);
    expect(header).toEqual(['Role', 'Status', 'Name', 'Email', 'Phone', 'Applied (IST)', 'Why are you excited to volunteer?',
      'Volunteered before?', 'Past volunteering', 'Skills they bring', 'Availability']);
    expect(row.slice(0, 5)).toEqual(['Registration desk', 'Pending', 'Bilal', v.email, '+91 98765 43210']);
    expect(row[6]).toBe(ANSWERS.motivation);
    expect(row[7]).toBe('No');
    expect(row[9]).toBe('=HYPERLINK("http://evil","click")'); // a plain string, not a formula object
    expect(row[10]).toBe('The whole event');

    const other = await createUser({ role: 'organizer' });
    expect((await api.get(`/api/v1/events/${event.id}/volunteer-applications/export`).set(bearer(other))).status).toBe(403);
  });
});

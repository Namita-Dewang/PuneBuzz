// Volunteer roles and applications.
//
// Spots are used up only when the organizer ACCEPTS an application.
// volunteer_roles.spots_filled is that accepted count; every change to it
// happens in a transaction holding the role row lock (FOR UPDATE), and a
// CHECK constraint refuses to overfill, the same pattern as RSVP seats.
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const AppError = require('../utils/AppError');
const { canManage, likePattern, withTransaction } = require('./events.service');

const ROLE_COLUMNS = 'r.id, r.event_id, r.title, r.description, r.spots, r.spots_filled, r.created_at';

function toRole(row, myStatus) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    spots: row.spots,
    spotsFilled: row.spots_filled,
    spotsLeft: row.spots - row.spots_filled,
    ...(myStatus !== undefined && { myStatus }),
  };
}

// ---------------------------------------------------------------------------
// Browsing
// ---------------------------------------------------------------------------

// GET /volunteer-opportunities. One statement: events joined to their roles
// (and the caller's applications), aggregated per event with json_agg.
// Only published, upcoming events with at least one role that still has
// spots left; never the caller's own events. Each event lists its open
// roles, plus any role the caller has applied to (so they can see their
// status even once it's full).
async function listOpportunities({ category, area, from, to, q, page, limit }, viewer) {
  const values = [viewer?.id ?? null];
  const param = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  const where = ["e.status = 'published'", '($1::int IS NULL OR e.organizer_id <> $1)'];
  where.push(from ? `e.starts_at >= ${param(from.at)}` : 'e.starts_at >= now()');
  if (to) where.push(`e.starts_at ${to.inclusive ? '<=' : '<'} ${param(to.at)}`);
  if (category) where.push(`e.category = ${param(category)}`);
  if (area) where.push(`lower(v.area) = lower(${param(area)})`);
  if (q) {
    const pattern = param(likePattern(q));
    where.push(`(e.title ILIKE ${pattern} ESCAPE '\\' OR e.description ILIKE ${pattern} ESCAPE '\\')`);
  }
  const limitParam = param(limit);
  const offsetParam = param((page - 1) * limit);

  const { rows } = await pool.query(
    `WITH matches AS (
       SELECT e.id, e.title, e.starts_at, e.category,
              v.name AS venue_name, v.area AS venue_area,
              json_agg(
                json_build_object(
                  'id', r.id,
                  'title', r.title,
                  'description', r.description,
                  'spots', r.spots,
                  'spotsLeft', r.spots - r.spots_filled,
                  'myStatus', a.status
                ) ORDER BY r.created_at, r.id
              ) FILTER (WHERE r.spots_filled < r.spots OR a.id IS NOT NULL) AS roles
         FROM events e
         JOIN volunteer_roles r ON r.event_id = e.id
         LEFT JOIN venues v ON v.id = e.venue_id
         LEFT JOIN volunteer_applications a ON a.role_id = r.id AND a.user_id = $1
        WHERE ${where.join(' AND ')}
        GROUP BY e.id, v.id
       HAVING bool_or(r.spots_filled < r.spots)
     )
     SELECT (SELECT COUNT(*)::int FROM matches) AS total,
            COALESCE((
              SELECT json_agg(
                       json_build_object(
                         'id', m.id,
                         'title', m.title,
                         'startsAt', m.starts_at,
                         'category', m.category,
                         'venue', CASE WHEN m.venue_name IS NULL THEN NULL
                                       ELSE json_build_object('name', m.venue_name, 'area', m.venue_area) END,
                         'roles', m.roles
                       ) ORDER BY m.starts_at, m.id)
                FROM (SELECT * FROM matches ORDER BY starts_at, id LIMIT ${limitParam} OFFSET ${offsetParam}) m
            ), '[]'::json) AS data`,
    values
  );

  // Logged-out callers get no myStatus key at all.
  const data = viewer ? rows[0].data : rows[0].data.map((e) => ({ ...e, roles: e.roles.map(({ myStatus, ...r }) => r) }));
  return { data, page, limit, total: rows[0].total };
}

// Event visibility for volunteer data follows GET /events/:id: published and
// cancelled events are public, drafts only for the organizer/admin.
async function loadVisibleEvent(eventId, viewer) {
  const { rows } = await pool.query('SELECT id, organizer_id, status, starts_at FROM events WHERE id = $1', [eventId]);
  const event = rows[0];
  if (!event || (event.status === 'draft' && !(viewer && canManage(viewer, event.organizer_id)))) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }
  return event;
}

// GET /events/:id/volunteer-roles: all roles on one event, with the
// caller's status per role when logged in.
async function getEventRoles(eventId, viewer) {
  await loadVisibleEvent(eventId, viewer);
  const { rows } = await pool.query(
    `SELECT ${ROLE_COLUMNS}, a.status AS my_status
       FROM volunteer_roles r
       LEFT JOIN volunteer_applications a ON a.role_id = r.id AND a.user_id = $2
      WHERE r.event_id = $1
      ORDER BY r.created_at, r.id`,
    [eventId, viewer?.id ?? null]
  );
  return rows.map((row) => toRole(row, viewer ? row.my_status : undefined));
}

// ---------------------------------------------------------------------------
// Organizer: roles
// ---------------------------------------------------------------------------

async function requireManageableEvent(db, eventId, user) {
  const { rows } = await db.query('SELECT id, organizer_id, status FROM events WHERE id = $1', [eventId]);
  const event = rows[0];
  const allowed = event && canManage(user, event.organizer_id);
  if (!event || (!allowed && event.status === 'draft')) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  if (!allowed) throw new AppError(403, 'FORBIDDEN', 'Only the organizer can manage volunteers');
  return event;
}

// Locks the role row and checks the caller organizes its event.
async function lockManageableRole(client, roleId, user) {
  const { rows } = await client.query(
    `SELECT ${ROLE_COLUMNS}, e.organizer_id, e.status AS event_status
       FROM volunteer_roles r JOIN events e ON e.id = r.event_id
      WHERE r.id = $1
      FOR UPDATE OF r`,
    [roleId]
  );
  const role = rows[0];
  if (!role) throw new AppError(404, 'ROLE_NOT_FOUND', 'Volunteer role not found');
  if (!canManage(user, role.organizer_id)) throw new AppError(403, 'FORBIDDEN', 'Only the organizer can manage volunteers');
  return role;
}

async function createRole(eventId, user, { title, description = null, spots }) {
  const event = await requireManageableEvent(pool, eventId, user);
  if (event.status === 'cancelled') throw new AppError(409, 'EVENT_CANCELLED', 'Event has been cancelled');
  const { rows } = await pool.query(
    `INSERT INTO volunteer_roles (event_id, title, description, spots)
     VALUES ($1, $2, $3, $4)
     RETURNING id, event_id, title, description, spots, spots_filled, created_at`,
    [eventId, title, description, spots]
  );
  return toRole(rows[0]);
}

const ROLE_WRITABLE = { title: 'title', description: 'description', spots: 'spots' };

async function updateRole(roleId, user, changes) {
  return withTransaction(async (client) => {
    const role = await lockManageableRole(client, roleId, user);
    if (changes.spots !== undefined && changes.spots < role.spots_filled) {
      throw new AppError(
        409,
        'SPOTS_BELOW_ACCEPTED',
        `This role already has ${role.spots_filled} accepted ${role.spots_filled === 1 ? 'volunteer' : 'volunteers'}`
      );
    }
    const fields = Object.keys(ROLE_WRITABLE).filter((f) => changes[f] !== undefined);
    const { rows } = await client.query(
      `UPDATE volunteer_roles SET ${fields.map((f, i) => `${ROLE_WRITABLE[f]} = $${i + 1}`).join(', ')}
        WHERE id = $${fields.length + 1}
        RETURNING id, event_id, title, description, spots, spots_filled, created_at`,
      [...fields.map((f) => changes[f]), roleId]
    );
    return toRole(rows[0]);
  });
}

// Refused once anyone has applied, so applications (and their answers) are never silently deleted.
async function deleteRole(roleId, user) {
  await withTransaction(async (client) => {
    await lockManageableRole(client, roleId, user);
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM volunteer_applications WHERE role_id = $1', [roleId]);
    if (rows[0].n > 0) {
      throw new AppError(409, 'ROLE_HAS_APPLICATIONS', "People have applied to this role, so it can't be deleted. Edit it instead.");
    }
    await client.query('DELETE FROM volunteer_roles WHERE id = $1', [roleId]);
  });
}

// ---------------------------------------------------------------------------
// Volunteers: apply / withdraw
// ---------------------------------------------------------------------------

async function apply(roleId, user, answers) {
  try {
    return await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT ${ROLE_COLUMNS}, e.organizer_id, e.status AS event_status, e.starts_at
           FROM volunteer_roles r JOIN events e ON e.id = r.event_id
          WHERE r.id = $1
          FOR UPDATE OF r`,
        [roleId]
      );
      const role = rows[0];
      if (!role || role.event_status === 'draft') throw new AppError(404, 'ROLE_NOT_FOUND', 'Volunteer role not found');
      if (role.organizer_id === user.id) throw new AppError(403, 'FORBIDDEN', "You can't volunteer at your own event");
      if (role.event_status !== 'published' || new Date(role.starts_at) <= new Date()) {
        throw new AppError(409, 'EVENT_CLOSED', 'This event is no longer taking volunteers');
      }
      if (role.spots_filled >= role.spots) throw new AppError(409, 'ROLE_FULL', 'This role is already full');

      const inserted = await client.query(
        `INSERT INTO volunteer_applications
           (role_id, user_id, motivation, volunteered_before, past_experience, skills, availability, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, status, created_at`,
        [roleId, user.id, answers.motivation, answers.volunteeredBefore, answers.pastExperience ?? null,
          answers.skills ?? null, answers.availability, answers.phone]
      );
      return { id: inserted.rows[0].id, roleId: role.id, status: inserted.rows[0].status, createdAt: inserted.rows[0].created_at };
    });
  } catch (err) {
    if (err.code === '23505') throw new AppError(409, 'ALREADY_APPLIED', "You've already applied for this role");
    throw err;
  }
}

// Withdrawing an accepted application frees its spot.
async function withdraw(roleId, user) {
  await withTransaction(async (client) => {
    await client.query('SELECT id FROM volunteer_roles WHERE id = $1 FOR UPDATE', [roleId]);
    const { rows } = await client.query(
      'DELETE FROM volunteer_applications WHERE role_id = $1 AND user_id = $2 RETURNING status',
      [roleId, user.id]
    );
    if (!rows[0]) throw new AppError(404, 'NOT_APPLIED', "You haven't applied for this role");
    if (rows[0].status === 'accepted') {
      await client.query('UPDATE volunteer_roles SET spots_filled = spots_filled - 1 WHERE id = $1', [roleId]);
    }
  });
}

// ---------------------------------------------------------------------------
// Organizer: review + export
// ---------------------------------------------------------------------------

function toApplication(row) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    user: { id: row.user_id, name: row.user_name, email: row.user_email },
    answers: {
      motivation: row.motivation,
      volunteeredBefore: row.volunteered_before,
      pastExperience: row.past_experience,
      skills: row.skills,
      availability: row.availability,
      phone: row.phone,
    },
  };
}

async function fetchApplicationRows(eventId) {
  const { rows } = await pool.query(
    `SELECT a.id, a.role_id, a.status, a.created_at, a.decided_at, a.motivation, a.volunteered_before,
            a.past_experience, a.skills, a.availability, a.phone,
            u.id AS user_id, u.name AS user_name, u.email AS user_email
       FROM volunteer_applications a
       JOIN volunteer_roles r ON r.id = a.role_id
       JOIN users u ON u.id = a.user_id
      WHERE r.event_id = $1
      ORDER BY r.created_at, r.id, a.created_at, a.id`,
    [eventId]
  );
  return rows;
}

// GET /events/:id/volunteer-applications: every role, each with its applications.
async function listApplications(eventId, user) {
  await requireManageableEvent(pool, eventId, user);
  const roles = await pool.query(
    `SELECT ${ROLE_COLUMNS} FROM volunteer_roles r WHERE r.event_id = $1 ORDER BY r.created_at, r.id`,
    [eventId]
  );
  const apps = await fetchApplicationRows(eventId);
  return roles.rows.map((role) => ({
    ...toRole(role),
    applications: apps.filter((a) => a.role_id === role.id).map(toApplication),
  }));
}

// PATCH /volunteer-applications/:id. Accepting takes a spot; moving an
// accepted application to pending or declined frees it.
async function setApplicationStatus(applicationId, user, status) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT a.id, a.status, a.role_id, r.spots, r.spots_filled, e.organizer_id
         FROM volunteer_applications a
         JOIN volunteer_roles r ON r.id = a.role_id
         JOIN events e ON e.id = r.event_id
        WHERE a.id = $1
        FOR UPDATE OF a, r`,
      [applicationId]
    );
    const app = rows[0];
    if (!app) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
    if (!canManage(user, app.organizer_id)) throw new AppError(403, 'FORBIDDEN', 'Only the organizer can review volunteers');

    if (app.status !== status) {
      const delta = (status === 'accepted' ? 1 : 0) - (app.status === 'accepted' ? 1 : 0);
      if (delta > 0 && app.spots_filled >= app.spots) {
        throw new AppError(409, 'ROLE_FULL', 'All spots for this role are filled. Increase the spots or decline someone first.');
      }
      if (delta !== 0) {
        await client.query('UPDATE volunteer_roles SET spots_filled = spots_filled + $1 WHERE id = $2', [delta, app.role_id]);
      }
      await client.query(
        `UPDATE volunteer_applications
            SET status = $1::varchar, decided_at = CASE WHEN $1::varchar = 'pending' THEN NULL ELSE clock_timestamp() END
          WHERE id = $2`,
        [status, applicationId]
      );
    }
    const updated = await client.query(
      `SELECT a.id, a.role_id, a.status, a.created_at, a.decided_at, a.motivation, a.volunteered_before,
              a.past_experience, a.skills, a.availability, a.phone,
              u.id AS user_id, u.name AS user_name, u.email AS user_email
         FROM volunteer_applications a JOIN users u ON u.id = a.user_id
        WHERE a.id = $1`,
      [applicationId]
    );
    return toApplication(updated.rows[0]);
  });
}

const STATUS_LABELS = { pending: 'Pending', accepted: 'Volunteering', declined: 'Not selected' };
const AVAILABILITY_LABELS = { full: 'The whole event', partial: 'Part of it', setup: 'Setup and pack-up only' };
const istStamp = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// GET /events/:id/volunteer-applications/export: one .xlsx with every
// application and all five answers. Values are written as plain strings,
// so an answer like "=SUM(...)" can't run as a formula in Excel.
async function exportApplications(eventId, user) {
  await requireManageableEvent(pool, eventId, user);
  const { rows: eventRows } = await pool.query('SELECT title FROM events WHERE id = $1', [eventId]);
  const { rows: roleRows } = await pool.query('SELECT id, title FROM volunteer_roles WHERE event_id = $1', [eventId]);
  const roleTitle = Object.fromEntries(roleRows.map((r) => [r.id, r.title]));
  const apps = await fetchApplicationRows(eventId);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pune Buzz';
  const sheet = workbook.addWorksheet('Volunteer applications', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Role', key: 'role', width: 24 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Applied (IST)', key: 'applied', width: 20 },
    { header: 'Why are you excited to volunteer?', key: 'motivation', width: 50 },
    { header: 'Volunteered before?', key: 'before', width: 12 },
    { header: 'Past volunteering', key: 'past', width: 40 },
    { header: 'Skills they bring', key: 'skills', width: 40 },
    { header: 'Availability', key: 'availability', width: 22 },
  ];
  for (const a of apps) {
    sheet.addRow({
      role: roleTitle[a.role_id],
      status: STATUS_LABELS[a.status],
      name: a.user_name,
      email: a.user_email,
      phone: a.phone,
      applied: istStamp.format(a.created_at),
      motivation: a.motivation,
      before: a.volunteered_before ? 'Yes' : 'No',
      past: a.past_experience ?? '',
      skills: a.skills ?? '',
      availability: AVAILABILITY_LABELS[a.availability],
    });
  }
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: 'A1', to: 'K1' };
  sheet.eachRow((row, n) => {
    if (n > 1) row.alignment = { vertical: 'top', wrapText: true };
  });

  const slug = eventRows[0].title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'event';
  return { filename: `volunteers-${slug}.xlsx`, buffer: await workbook.xlsx.writeBuffer() };
}

module.exports = {
  listOpportunities,
  getEventRoles,
  createRole,
  updateRole,
  deleteRole,
  apply,
  withdraw,
  listApplications,
  setApplicationStatus,
  exportApplications,
};

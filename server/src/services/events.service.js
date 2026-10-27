const pool = require('../db/pool');
const AppError = require('../utils/AppError');

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.category, e.starts_at, e.ends_at,
         e.capacity, e.seats_taken, e.price, e.status, e.created_at,
         e.organizer_id, u.name AS organizer_name,
         e.venue_id, v.name AS venue_name, v.area AS venue_area,
         v.address AS venue_address, v.lat AS venue_lat, v.lng AS venue_lng
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    LEFT JOIN venues v ON v.id = e.venue_id`;

// pg returns NUMERIC as strings to avoid precision loss; prices and
// coordinates fit comfortably in a JS number.
const toNumber = (v) => (v === null ? null : Number(v));

function toEvent(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    seatsTaken: row.seats_taken,
    seatsLeft: row.capacity - row.seats_taken,
    price: toNumber(row.price),
    isFree: Number(row.price) === 0,
    status: row.status,
    createdAt: row.created_at,
    organizer: { id: row.organizer_id, name: row.organizer_name },
    venue: row.venue_id
      ? {
          id: row.venue_id,
          name: row.venue_name,
          area: row.venue_area,
          address: row.venue_address,
          lat: toNumber(row.venue_lat),
          lng: toNumber(row.venue_lng),
        }
      : null,
  };
}

// API field -> column, for building INSERT/UPDATE statements. Only these
// columns can ever be written from request data.
const WRITABLE_COLUMNS = {
  title: 'title',
  description: 'description',
  category: 'category',
  venueId: 'venue_id',
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  capacity: 'capacity',
  price: 'price',
  status: 'status',
};

function canManage(user, organizerId) {
  return user.role === 'admin' || user.id === organizerId;
}

function translateWriteError(err) {
  if (err.code === '23503' && err.constraint === 'events_venue_id_fkey') {
    return new AppError(400, 'INVALID_VENUE', 'Venue does not exist');
  }
  return err;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Locks the event row for the rest of the transaction and checks the caller
// may manage it. Drafts you don't own look missing, matching GET /events/:id.
async function lockManageableEvent(client, eventId, user) {
  const { rows } = await client.query(
    `SELECT id, organizer_id, status, starts_at, ends_at, capacity, seats_taken
       FROM events WHERE id = $1 FOR UPDATE`,
    [eventId]
  );
  const event = rows[0];
  const allowed = event && canManage(user, event.organizer_id);
  if (!event || (!allowed && event.status === 'draft')) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }
  if (!allowed) throw new AppError(403, 'FORBIDDEN', 'Only the organizer can change this event');
  if (event.status === 'cancelled') {
    throw new AppError(409, 'EVENT_CANCELLED', 'Event has been cancelled');
  }
  return event;
}

async function findEvent(db, eventId) {
  const { rows } = await db.query(`${EVENT_SELECT} WHERE e.id = $1`, [eventId]);
  return rows[0] ? toEvent(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Escapes LIKE wildcards so a search for "100%" matches literally.
function likePattern(text) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

async function listEvents({ category, area, from, to, q, free, page, limit }) {
  const values = [];
  const param = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  const where = ["e.status = 'published'"];
  // Upcoming only, unless the caller explicitly asks for an earlier start.
  where.push(from ? `e.starts_at >= ${param(from.at)}` : 'e.starts_at >= now()');
  if (to) where.push(`e.starts_at ${to.inclusive ? '<=' : '<'} ${param(to.at)}`);
  if (category) where.push(`e.category = ${param(category)}`);
  if (area) where.push(`lower(v.area) = lower(${param(area)})`);
  if (free !== undefined) where.push(free ? 'e.price = 0' : 'e.price > 0');
  if (q) {
    const pattern = param(likePattern(q));
    where.push(`(e.title ILIKE ${pattern} ESCAPE '\\' OR e.description ILIKE ${pattern} ESCAPE '\\')`);
  }

  const whereSql = where.join(' AND ');
  const filterValues = [...values];

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM events e LEFT JOIN venues v ON v.id = e.venue_id
      WHERE ${whereSql}`,
    filterValues
  );

  const { rows } = await pool.query(
    `${EVENT_SELECT}
      WHERE ${whereSql}
      ORDER BY e.starts_at, e.id
      LIMIT ${param(limit)} OFFSET ${param((page - 1) * limit)}`,
    values
  );

  return { data: rows.map(toEvent), page, limit, total: countResult.rows[0].total };
}

// The viewer's relationship to the event. Waitlist position is 1-based and
// ordered by (created_at, id), the same order promotion uses.
async function findViewerStatus(eventId, userId) {
  const { rows } = await pool.query(
    `SELECT 'confirmed' AS status, NULL::int AS position
       FROM rsvps WHERE event_id = $1 AND user_id = $2
     UNION ALL
     SELECT 'waitlisted', (
              SELECT COUNT(*)::int FROM waitlist w2
               WHERE w2.event_id = w.event_id
                 AND (w2.created_at, w2.id) <= (w.created_at, w.id))
       FROM waitlist w WHERE w.event_id = $1 AND w.user_id = $2
     LIMIT 1`,
    [eventId, userId]
  );
  if (!rows[0]) return { status: 'none' };
  return rows[0].status === 'confirmed'
    ? { status: 'confirmed' }
    : { status: 'waitlisted', position: rows[0].position };
}

// viewer is req.user or undefined. Published and cancelled events are public
// (attendees need to see a cancellation); drafts only to the organizer/admin.
async function getEvent(eventId, viewer) {
  const event = await findEvent(pool, eventId);
  if (!event || (event.status === 'draft' && !(viewer && canManage(viewer, event.organizer.id)))) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM waitlist WHERE event_id = $1', [eventId]);
  event.waitlistCount = rows[0].n;
  event.myStatus = viewer ? await findViewerStatus(eventId, viewer.id) : null;
  return event;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function createEvent(organizerId, data) {
  const fields = Object.keys(WRITABLE_COLUMNS).filter((f) => data[f] !== undefined);
  const columns = ['organizer_id', ...fields.map((f) => WRITABLE_COLUMNS[f])];
  const values = [organizerId, ...fields.map((f) => data[f])];
  const placeholders = values.map((_, i) => `$${i + 1}`);

  try {
    const { rows } = await pool.query(
      `INSERT INTO events (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
      values
    );
    return findEvent(pool, rows[0].id);
  } catch (err) {
    throw translateWriteError(err);
  }
}

async function updateEvent(eventId, user, changes) {
  try {
    await withTransaction(async (client) => {
      const current = await lockManageableEvent(client, eventId, user);

      // The schema checks endsAt > startsAt when both are sent; here we check
      // the combination with whatever is already stored.
      const startsAt = changes.startsAt ?? current.starts_at;
      const endsAt = changes.endsAt !== undefined ? changes.endsAt : current.ends_at;
      if (endsAt && endsAt <= startsAt) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', [
          { path: 'body.endsAt', message: '`endsAt` must be after `startsAt`' },
        ]);
      }

      // Checked under the row lock, so a concurrent RSVP can't slip in between.
      if (changes.capacity !== undefined && changes.capacity < current.seats_taken) {
        throw new AppError(
          409,
          'CAPACITY_BELOW_SEATS_TAKEN',
          `Capacity can't be lower than the ${current.seats_taken} seats already taken`
        );
      }

      if (changes.status === 'draft' && current.status === 'published') {
        const { rows } = await client.query(
          `SELECT EXISTS (SELECT 1 FROM rsvps WHERE event_id = $1)
               OR EXISTS (SELECT 1 FROM waitlist WHERE event_id = $1) AS has_people`,
          [eventId]
        );
        if (rows[0].has_people) {
          throw new AppError(409, 'EVENT_HAS_ATTENDEES', "Can't unpublish an event that people have joined");
        }
      }

      const fields = Object.keys(WRITABLE_COLUMNS).filter((f) => changes[f] !== undefined);
      const values = fields.map((f) => changes[f]);
      const assignments = fields.map((f, i) => `${WRITABLE_COLUMNS[f]} = $${i + 1}`);
      await client.query(
        `UPDATE events SET ${assignments.join(', ')} WHERE id = $${values.length + 1}`,
        [...values, eventId]
      );

      // Raising capacity frees seats; give them to the waitlist in order.
      const freed = (changes.capacity ?? current.capacity) - current.seats_taken;
      if (changes.capacity !== undefined && freed > 0) {
        const promoted = await client.query(
          `WITH next_in_line AS (
             DELETE FROM waitlist
              WHERE id IN (SELECT id FROM waitlist WHERE event_id = $1
                            ORDER BY created_at, id LIMIT $2)
             RETURNING user_id, created_at, id
           )
           INSERT INTO rsvps (event_id, user_id)
           SELECT $1, user_id FROM next_in_line ORDER BY created_at, id
           RETURNING user_id`,
          [eventId, freed]
        );
        if (promoted.rowCount) {
          await client.query('UPDATE events SET seats_taken = seats_taken + $1 WHERE id = $2', [
            promoted.rowCount,
            eventId,
          ]);
        }
      }
    });
  } catch (err) {
    throw translateWriteError(err);
  }
  return findEvent(pool, eventId);
}

// Soft delete: the event, its RSVPs and waitlist are kept as history.
async function cancelEvent(eventId, user) {
  await withTransaction(async (client) => {
    await lockManageableEvent(client, eventId, user);
    await client.query("UPDATE events SET status = 'cancelled' WHERE id = $1", [eventId]);
  });
  return findEvent(pool, eventId);
}

module.exports = {
  listEvents, getEvent, createEvent, updateEvent, cancelEvent,
  // Shared with rsvp.service, me.service and volunteer.service.
  EVENT_SELECT, toEvent, canManage, likePattern, withTransaction,
};

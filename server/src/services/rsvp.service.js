// RSVP and cancel, per docs/SPEC.md "RSVP and waitlist logic". Every call is
// one transaction that starts by locking the event row with FOR UPDATE, so
// all seat changes for an event happen one at a time. That lock is what keeps
// seats_taken correct under concurrent requests; tests/rsvp.concurrency.test.js
// fails without it.
const pool = require('../db/pool');
const AppError = require('../utils/AppError');
const { canManage } = require('./events.service');

const ALREADY_JOINED_MESSAGE = "You've already booked a seat or joined the waitlist for this event";

async function rsvp(eventId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, capacity, seats_taken, status, starts_at
         FROM events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );
    const event = rows[0];
    if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    if (event.status !== 'published' || new Date(event.starts_at) < new Date()) {
      throw new AppError(409, 'EVENT_CLOSED', 'This event is no longer taking bookings');
    }

    const existing = await client.query(
      `SELECT 1 FROM rsvps WHERE event_id = $1 AND user_id = $2
       UNION ALL
       SELECT 1 FROM waitlist WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );
    if (existing.rowCount) throw new AppError(409, 'ALREADY_JOINED', ALREADY_JOINED_MESSAGE);

    let result;
    if (event.seats_taken < event.capacity) {
      await client.query('INSERT INTO rsvps (event_id, user_id) VALUES ($1, $2)', [eventId, userId]);
      await client.query('UPDATE events SET seats_taken = seats_taken + 1 WHERE id = $1', [eventId]);
      result = { status: 'confirmed' };
    } else {
      await client.query('INSERT INTO waitlist (event_id, user_id) VALUES ($1, $2)', [eventId, userId]);
      // Under the lock nobody can join behind us yet, so the queue length is our position.
      const pos = await client.query('SELECT COUNT(*)::int AS n FROM waitlist WHERE event_id = $1', [eventId]);
      result = { status: 'waitlisted', position: pos.rows[0].n };
    }

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    // Backstop for the check above; the UNIQUE constraints make a duplicate impossible.
    if (err.code === '23505') throw new AppError(409, 'ALREADY_JOINED', ALREADY_JOINED_MESSAGE);
    throw err;
  } finally {
    client.release();
  }
}

async function cancel(eventId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query('SELECT id FROM events WHERE id = $1 FOR UPDATE', [eventId]);
    // Not in the spec's sample: without this a missing event reports NOT_JOINED.
    if (!locked.rowCount) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');

    const left = await client.query(
      'DELETE FROM waitlist WHERE event_id = $1 AND user_id = $2', [eventId, userId]
    );
    if (left.rowCount) {
      await client.query('COMMIT');
      return { status: 'left_waitlist' };
    }

    const removed = await client.query(
      'DELETE FROM rsvps WHERE event_id = $1 AND user_id = $2', [eventId, userId]
    );
    if (!removed.rowCount) throw new AppError(404, 'NOT_JOINED', "You don't have a booking for this event");

    // Oldest first; id breaks ties between rows created in the same instant.
    const next = await client.query(
      `DELETE FROM waitlist
        WHERE id = (SELECT id FROM waitlist WHERE event_id = $1
                    ORDER BY created_at, id LIMIT 1)
        RETURNING user_id`,
      [eventId]
    );
    if (next.rowCount) {
      // The freed seat passes straight to them, so seats_taken is unchanged.
      await client.query('INSERT INTO rsvps (event_id, user_id) VALUES ($1, $2)',
        [eventId, next.rows[0].user_id]);
    } else {
      await client.query('UPDATE events SET seats_taken = seats_taken - 1 WHERE id = $1', [eventId]);
    }

    await client.query('COMMIT');
    return { status: 'cancelled', promotedUserId: next.rows[0]?.user_id ?? null };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Confirmed list + waitlist in queue order, for the event's organizer or an admin.
async function listAttendees(eventId, user) {
  const { rows } = await pool.query('SELECT organizer_id, status FROM events WHERE id = $1', [eventId]);
  const event = rows[0];
  const allowed = event && canManage(user, event.organizer_id);
  // Drafts you don't own look missing, matching GET /events/:id.
  if (!event || (!allowed && event.status === 'draft')) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }
  if (!allowed) throw new AppError(403, 'FORBIDDEN', 'Only the organizer can see attendees');

  const confirmed = await pool.query(
    `SELECT u.id, u.name, u.email, r.created_at
       FROM rsvps r JOIN users u ON u.id = r.user_id
      WHERE r.event_id = $1
      ORDER BY r.created_at, r.id`,
    [eventId]
  );
  const waitlist = await pool.query(
    `SELECT u.id, u.name, u.email, w.created_at
       FROM waitlist w JOIN users u ON u.id = w.user_id
      WHERE w.event_id = $1
      ORDER BY w.created_at, w.id`,
    [eventId]
  );

  return {
    confirmed: confirmed.rows.map((r) => ({ id: r.id, name: r.name, email: r.email, rsvpAt: r.created_at })),
    waitlist: waitlist.rows.map((r, i) => ({
      position: i + 1, id: r.id, name: r.name, email: r.email, joinedAt: r.created_at,
    })),
  };
}

module.exports = { rsvp, cancel, listAttendees };

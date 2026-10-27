const pool = require('../db/pool');
const { EVENT_SELECT, toEvent } = require('./events.service');

// The "My events" page: every event the user is attending, waitlisted for, or
// organizing, soonest first. Past and cancelled events are included (status
// and startsAt tell the client how to show them). Unpaginated for the MVP.
async function getMyEvents(userId) {
  const attending = await pool.query(
    `${EVENT_SELECT}
      WHERE e.id IN (SELECT event_id FROM rsvps WHERE user_id = $1)
      ORDER BY e.starts_at, e.id`,
    [userId]
  );

  // Position within each event's queue, ordered the same way promotion is.
  const waitlisted = await pool.query(
    `WITH queue AS (
       SELECT event_id, user_id,
              ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at, id)::int AS position
         FROM waitlist
        WHERE event_id IN (SELECT event_id FROM waitlist WHERE user_id = $1)
     )
     SELECT ev.*, q.position
       FROM (${EVENT_SELECT}) ev
       JOIN queue q ON q.event_id = ev.id AND q.user_id = $1
      ORDER BY ev.starts_at, ev.id`,
    [userId]
  );

  // Includes drafts: they're the organizer's own.
  const organizing = await pool.query(
    `${EVENT_SELECT}
      WHERE e.organizer_id = $1
      ORDER BY e.starts_at, e.id`,
    [userId]
  );

  return {
    attending: attending.rows.map(toEvent),
    waitlisted: waitlisted.rows.map((row) => ({ ...toEvent(row), position: row.position })),
    organizing: organizing.rows.map(toEvent),
  };
}

module.exports = { getMyEvents };

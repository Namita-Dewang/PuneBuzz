const pool = require('../../src/db/pool');

async function resetDb() {
  await pool.query('TRUNCATE rsvps, waitlist, events, venues, users RESTART IDENTITY CASCADE');
}

module.exports = { pool, resetDb };

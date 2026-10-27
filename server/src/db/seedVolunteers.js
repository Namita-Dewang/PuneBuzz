// npm run seed:volunteers: adds the sample volunteer roles to existing
// events (matched by title). Additive and safe to re-run: events that
// already have roles are skipped, and nothing is deleted. Unlike `npm run
// seed`, this keeps your users, events and bookings.
const env = require('../config/env');
const pool = require('./pool');
const ROLES = require('./volunteerSeedData');

async function main() {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed: NODE_ENV is production');

  let added = 0;
  let skipped = 0;
  let missing = 0;
  for (const [title, roles] of Object.entries(ROLES)) {
    const { rows } = await pool.query(
      `SELECT e.id, (SELECT COUNT(*)::int FROM volunteer_roles r WHERE r.event_id = e.id) AS existing
         FROM events e WHERE e.title = $1 ORDER BY e.id LIMIT 1`,
      [title]
    );
    if (!rows[0]) {
      missing += 1;
      continue;
    }
    if (rows[0].existing > 0) {
      skipped += 1;
      continue;
    }
    for (const role of roles) {
      await pool.query(
        'INSERT INTO volunteer_roles (event_id, title, description, spots) VALUES ($1, $2, $3, $4)',
        [rows[0].id, role.title, role.description, role.spots]
      );
      added += 1;
    }
  }
  console.log(`Added ${added} volunteer roles. Skipped ${skipped} events that already had roles; ${missing} sample events not found.`);
}

main()
  .catch((err) => {
    const reason = err.message || err.errors?.map((e) => e.message).join('; ') || err.code;
    console.error(`Seeding volunteers failed: ${err.code === '42P01' ? 'tables are missing. Run `npm run migrate` first.' : reason}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

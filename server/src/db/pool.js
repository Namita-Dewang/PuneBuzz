const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Fail fast instead of hanging requests when Postgres is unreachable.
  connectionTimeoutMillis: 5000,
});

// An idle client erroring (e.g. Postgres restarted) must not crash the process.
pool.on('error', (err) => {
  console.error(`Unexpected error on idle pg client: ${err.code ?? ''} ${err.message}`);
});

module.exports = pool;

const pool = require('../db/pool');

async function checkDatabase() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('Health check: database unreachable', err.message);
    return false;
  }
}

module.exports = { checkDatabase };

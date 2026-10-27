// Runs once before the whole test run: creates the test database if it's
// missing and applies all migrations to it.
const { Client } = require('pg');
const { TEST_DATABASE_URL, dbName } = require('./testEnv');
const { migrate } = require('../src/db/migrator');

module.exports = async function globalSetup() {
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(dbName)}`);
  } finally {
    await admin.end();
  }

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await migrate(client, () => {});
  } finally {
    await client.end();
  }
};

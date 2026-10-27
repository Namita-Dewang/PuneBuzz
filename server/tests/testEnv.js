// Points the app at the test database. Loaded by Jest's globalSetup and
// setupFiles before any app module, so config/env.js sees these values
// (dotenv never overrides variables that are already set).
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://pune:pune@localhost:5432/pune_events_test';

// Tests truncate every table, so refuse to run against anything that
// doesn't look like a throwaway test database.
const dbName = decodeURIComponent(new URL(TEST_DATABASE_URL).pathname.slice(1));
if (!dbName.endsWith('_test')) {
  throw new Error(`Refusing to run tests: TEST_DATABASE_URL database "${dbName}" must end in _test`);
}

function apply() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.BCRYPT_ROUNDS = '4'; // fast hashing; production default is 12
  // Every test request comes from one IP; keep limits out of the way.
  // rateLimit.test.js lowers them for its own module registry.
  process.env.TRUST_PROXY = '0';
  process.env.AUTH_LOGIN_MAX = '1000';
  process.env.AUTH_REGISTER_MAX = '1000';
  process.env.RSVP_MAX = '1000';
}

module.exports = { TEST_DATABASE_URL, dbName, apply };

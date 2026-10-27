const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const JWT_ALGORITHM = 'HS256';

// Compared against when the email doesn't exist, so a login for an unknown
// email takes about as long as a wrong password and doesn't reveal which it was.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', env.BCRYPT_ROUNDS);

// Public user columns. password_hash is deliberately absent; only
// findCredentialsByEmail selects it, and it never leaves this file.
const USER_COLUMNS = 'id, name, email, role, created_at';

function toUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// role is 'user' or 'organizer' (the validator rejects anything else, so
// nobody can sign themselves up as an admin).
async function register({ name, email, password, role = 'user' }) {
  if (role !== 'user' && role !== 'organizer') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid account type'); // defence in depth
  }
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${USER_COLUMNS}`,
      [name, email, passwordHash, role]
    );
    const user = toUser(rows[0]);
    return { user, token: signToken(user) };
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }
}

async function login({ email, password }) {
  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [email]
  );
  const row = rows[0];
  const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const user = toUser(row);
  return { user, token: signToken(user) };
}

// Returns the user for a valid token, or throws 401.
async function authenticateToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    throw new AppError(
      401,
      expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      expired ? 'Token has expired' : 'Invalid token'
    );
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) throw new AppError(401, 'INVALID_TOKEN', 'Invalid token');

  // Load the user on every request so a deleted account or changed role
  // takes effect immediately instead of when the 7-day token expires.
  const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
  if (!rows[0]) throw new AppError(401, 'INVALID_TOKEN', 'Invalid token');
  return toUser(rows[0]);
}

module.exports = { register, login, authenticateToken };

// Rate limits: per IP for the auth endpoints (slows password guessing and
// mass sign-ups), per user for RSVP/cancel (stops a script hammering the
// seat-locking transaction). Counts live in process memory, so they reset on
// restart and aren't shared between instances; switch to a shared store
// (e.g. Redis) before running more than one API instance.
const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const TEN_MINUTES = 10 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

function createLimiter({ windowMs, limit, skipSuccessfulRequests = false, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    ...(keyGenerator && { keyGenerator }),
    standardHeaders: 'draft-8', // RateLimit / RateLimit-Policy headers, plus Retry-After when blocked
    legacyHeaders: false,
    // Hand off to errorHandler so 429s use the standard error shape.
    handler: (req, res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many attempts, please try again later'));
    },
  });
}

// Only failed logins count, so a user who keeps logging in successfully is
// never locked out; a guesser gets AUTH_LOGIN_MAX tries per 15 minutes.
const loginLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: env.AUTH_LOGIN_MAX,
  skipSuccessfulRequests: true,
});

const registerLimiter = createLimiter({
  windowMs: ONE_HOUR,
  limit: env.AUTH_REGISTER_MAX,
});

// RSVP and cancel share one budget per logged-in user (must run after auth).
// Keyed by user id, not IP, so people on shared Wi-Fi don't block each other.
const rsvpLimiter = createLimiter({
  windowMs: TEN_MINUTES,
  limit: env.RSVP_MAX,
  keyGenerator: (req) => `user:${req.user.id}`,
});

module.exports = { loginLimiter, registerLimiter, rsvpLimiter };

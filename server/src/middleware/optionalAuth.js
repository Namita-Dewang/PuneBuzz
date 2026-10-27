// For public routes that show extra info to logged-in users (e.g. your RSVP
// status on GET /events/:id). Sets req.user when a valid Bearer token is
// sent, and otherwise leaves it undefined. A missing, malformed or expired
// token is treated as anonymous rather than a 401, so a stale token in the
// browser never breaks a public page.
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');

async function optionalAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      req.user = await authService.authenticateToken(token);
    } catch (err) {
      // Only token problems mean "anonymous"; a DB outage should still be a 500.
      if (!(err instanceof AppError && err.status === 401)) throw err;
    }
  }
  next();
}

module.exports = optionalAuth;

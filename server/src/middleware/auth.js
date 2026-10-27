// Requires a valid "Authorization: Bearer <jwt>" header and attaches the
// current user ({ id, name, email, role, createdAt }) as req.user.
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');

async function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  }
  req.user = await authService.authenticateToken(token);
  next();
}

module.exports = auth;

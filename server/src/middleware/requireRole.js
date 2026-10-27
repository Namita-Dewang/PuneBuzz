// Use after auth: router.post('/', auth, requireRole('organizer', 'admin'), ...)
const AppError = require('../utils/AppError');

function requireRole(...roles) {
  if (!roles.length) throw new Error('requireRole needs at least one role');

  return function checkRole(req, res, next) {
    if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do this');
    }
    next();
  };
}

module.exports = requireRole;

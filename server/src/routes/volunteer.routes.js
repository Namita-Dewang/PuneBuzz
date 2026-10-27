// Volunteer routers. Event-scoped volunteer routes (/events/:id/volunteer-*)
// live in events.routes.js; these cover the rest.
const { Router } = require('express');
const volunteerController = require('../controllers/volunteer.controller');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { rsvpLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const schemas = require('../validators/volunteer.schemas');

// /volunteer-opportunities
const opportunities = Router();
opportunities.get('/', optionalAuth, validate(schemas.opportunities), volunteerController.opportunities);

// /volunteer-roles/:id ...
const roles = Router();
roles.patch('/:id', auth, validate(schemas.updateRole), volunteerController.updateRole);
roles.delete('/:id', auth, validate(schemas.deleteRole), volunteerController.deleteRole);
// Applying and withdrawing share the per-user RSVP rate limit.
roles.post('/:id/applications', auth, rsvpLimiter, validate(schemas.apply), volunteerController.apply);
roles.delete('/:id/applications/me', auth, rsvpLimiter, validate(schemas.withdraw), volunteerController.withdraw);

// /volunteer-applications/:id
const applications = Router();
applications.patch('/:id', auth, validate(schemas.setStatus), volunteerController.setStatus);

module.exports = { opportunities, roles, applications };

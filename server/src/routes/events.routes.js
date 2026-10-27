const { Router } = require('express');
const eventsController = require('../controllers/events.controller');
const rsvpController = require('../controllers/rsvp.controller');
const volunteerController = require('../controllers/volunteer.controller');
const volunteerSchemas = require('../validators/volunteer.schemas');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { rsvpLimiter } = require('../middleware/rateLimit');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const schemas = require('../validators/events.schemas');

const router = Router();

router.get('/', validate(schemas.list), eventsController.list);
router.get('/:id', optionalAuth, validate(schemas.getById), eventsController.getById);
router.post('/', auth, requireRole('organizer', 'admin'), validate(schemas.create), eventsController.create);
// Ownership is checked in the service, under the row lock.
router.patch('/:id', auth, validate(schemas.update), eventsController.update);
router.delete('/:id', auth, validate(schemas.remove), eventsController.remove);

router.post('/:id/rsvp', auth, rsvpLimiter, validate(schemas.getById), rsvpController.create);
router.delete('/:id/rsvp', auth, rsvpLimiter, validate(schemas.getById), rsvpController.remove);
router.get('/:id/attendees', auth, validate(schemas.getById), rsvpController.attendees);

// Volunteers on one event: public role list; the organizer adds roles,
// reviews applications and downloads them as Excel.
router.get('/:id/volunteer-roles', optionalAuth, validate(volunteerSchemas.eventRoles), volunteerController.eventRoles);
router.post('/:id/volunteer-roles', auth, validate(volunteerSchemas.createRole), volunteerController.createRole);
router.get('/:id/volunteer-applications', auth, validate(volunteerSchemas.applications), volunteerController.applications);
router.get('/:id/volunteer-applications/export', auth, validate(volunteerSchemas.applications), volunteerController.exportApplications);

module.exports = router;

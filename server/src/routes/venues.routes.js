const { Router } = require('express');
const venuesController = require('../controllers/venues.controller');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const schemas = require('../validators/venues.schemas');

const router = Router();

router.get('/', venuesController.list);
router.post('/', auth, requireRole('organizer', 'admin'), validate(schemas.create), venuesController.create);

module.exports = router;

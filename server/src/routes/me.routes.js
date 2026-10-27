const { Router } = require('express');
const meController = require('../controllers/me.controller');
const auth = require('../middleware/auth');

const router = Router();

router.get('/events', auth, meController.events);

module.exports = router;

const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');
const schemas = require('../validators/auth.schemas');

const router = Router();

// Limiters run before validation so malformed requests count too.
router.post('/register', registerLimiter, validate(schemas.register), authController.register);
router.post('/login', loginLimiter, validate(schemas.login), authController.login);
router.get('/me', auth, authController.me);

module.exports = router;

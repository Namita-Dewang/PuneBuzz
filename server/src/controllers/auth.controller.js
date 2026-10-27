const authService = require('../services/auth.service');

async function register(req, res) {
  const { user, token } = await authService.register(req.body);
  res.status(201).json({ user, token });
}

async function login(req, res) {
  const { user, token } = await authService.login(req.body);
  res.json({ user, token });
}

// auth middleware has already loaded the user.
function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, me };

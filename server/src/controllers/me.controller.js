const meService = require('../services/me.service');

async function events(req, res) {
  res.json(await meService.getMyEvents(req.user.id));
}

module.exports = { events };

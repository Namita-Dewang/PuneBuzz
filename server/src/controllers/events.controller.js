const eventsService = require('../services/events.service');

async function list(req, res) {
  res.json(await eventsService.listEvents(req.query));
}

async function getById(req, res) {
  res.json({ event: await eventsService.getEvent(req.params.id, req.user) });
}

async function create(req, res) {
  const event = await eventsService.createEvent(req.user.id, req.body);
  res.status(201).json({ event });
}

async function update(req, res) {
  res.json({ event: await eventsService.updateEvent(req.params.id, req.user, req.body) });
}

async function remove(req, res) {
  res.json({ event: await eventsService.cancelEvent(req.params.id, req.user) });
}

module.exports = { list, getById, create, update, remove };

const venuesService = require('../services/venues.service');

async function list(req, res) {
  res.json({ data: await venuesService.listVenues() });
}

async function create(req, res) {
  const venue = await venuesService.createVenue(req.body);
  res.status(201).json({ venue });
}

module.exports = { list, create };

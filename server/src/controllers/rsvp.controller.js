const rsvpService = require('../services/rsvp.service');

// 201 { status: 'confirmed' } or 201 { status: 'waitlisted', position }
async function create(req, res) {
  res.status(201).json(await rsvpService.rsvp(req.params.id, req.user.id));
}

// 200 { status: 'cancelled' } or 200 { status: 'left_waitlist' }.
// promotedUserId stays server-side: it's another user's id.
async function remove(req, res) {
  const { status } = await rsvpService.cancel(req.params.id, req.user.id);
  res.json({ status });
}

async function attendees(req, res) {
  res.json(await rsvpService.listAttendees(req.params.id, req.user));
}

module.exports = { create, remove, attendees };

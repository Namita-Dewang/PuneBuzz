const volunteerService = require('../services/volunteer.service');

async function opportunities(req, res) {
  res.json(await volunteerService.listOpportunities(req.query, req.user));
}

async function eventRoles(req, res) {
  res.json({ roles: await volunteerService.getEventRoles(req.params.id, req.user) });
}

async function createRole(req, res) {
  res.status(201).json({ role: await volunteerService.createRole(req.params.id, req.user, req.body) });
}

async function updateRole(req, res) {
  res.json({ role: await volunteerService.updateRole(req.params.id, req.user, req.body) });
}

async function deleteRole(req, res) {
  await volunteerService.deleteRole(req.params.id, req.user);
  res.status(204).end();
}

async function apply(req, res) {
  res.status(201).json({ application: await volunteerService.apply(req.params.id, req.user, req.body) });
}

async function withdraw(req, res) {
  await volunteerService.withdraw(req.params.id, req.user);
  res.status(204).end();
}

async function applications(req, res) {
  res.json({ roles: await volunteerService.listApplications(req.params.id, req.user) });
}

async function setStatus(req, res) {
  res.json({ application: await volunteerService.setApplicationStatus(req.params.id, req.user, req.body.status) });
}

async function exportApplications(req, res) {
  const { filename, buffer } = await volunteerService.exportApplications(req.params.id, req.user);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}

module.exports = {
  opportunities, eventRoles, createRole, updateRole, deleteRole, apply, withdraw, applications, setStatus, exportApplications,
};

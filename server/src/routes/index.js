// Every router and where it's mounted under /api/v1. app.js mounts from this
// list, and tests/docs.test.js uses it to check that every route appears in
// the OpenAPI spec (Express 5 doesn't expose mount paths after the fact).
const volunteer = require('./volunteer.routes');

module.exports = [
  { path: '/health', router: require('./health.routes') },
  { path: '/auth', router: require('./auth.routes') },
  { path: '/events', router: require('./events.routes') },
  { path: '/venues', router: require('./venues.routes') },
  { path: '/me', router: require('./me.routes') },
  { path: '/volunteer-opportunities', router: volunteer.opportunities },
  { path: '/volunteer-roles', router: volunteer.roles },
  { path: '/volunteer-applications', router: volunteer.applications },
];

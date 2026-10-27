const healthService = require('../services/health.service');
const AppError = require('../utils/AppError');

// clientIp is the caller's own address as the API sees it. After deploying,
// compare it with your real public IP: if it shows the host's proxy instead,
// TRUST_PROXY is wrong and every user would share one rate-limit bucket.
async function getHealth(req, res) {
  const dbOk = await healthService.checkDatabase();
  if (!dbOk) throw new AppError(503, 'DB_UNAVAILABLE', 'Database is unreachable');
  res.json({ status: 'ok', db: 'ok', clientIp: req.ip });
}

module.exports = { getHealth };

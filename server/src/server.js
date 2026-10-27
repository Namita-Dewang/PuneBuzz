const app = require('./app');
const env = require('./config/env');
const pool = require('./db/pool');

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  // Don't hang forever on open keep-alive connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

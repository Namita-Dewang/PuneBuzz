// CLI entry point: npm run migrate
const pool = require('./pool');
const { migrate } = require('./migrator');

async function main() {
  const client = await pool.connect();
  try {
    await migrate(client);
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    // Connection failures are AggregateErrors with an empty message.
    const reason = err.message || err.errors?.map((e) => e.message).join('; ') || err.code;
    console.error(`Migration failed: ${reason}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

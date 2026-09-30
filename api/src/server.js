'use strict';

const { config } = require('./config');
const { createRepository } = require('./repository');
const { createApp } = require('./app');

async function main() {
  const repository = createRepository();

  // Start listening immediately so CF health checks pass and the app stays
  // up even if HANA is briefly unavailable (on trial the DB hibernates and
  // may not accept connections at boot). The repository initializes in the
  // background with retries and the app becomes fully functional once ready.
  const app = createApp(repository);
  const server = app.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`);
  });

  // Background init with retry/backoff.
  (async function initWithRetry() {
    let attempt = 0;
    // Keep trying; each failure waits a bit and retries so the app recovers
    // automatically when the HANA instance finishes starting.
    while (true) {
      try {
        await repository.init();
        console.log('Repository initialized');
        return;
      } catch (err) {
        attempt += 1;
        const waitMs = Math.min(30000, 2000 * attempt);
        console.error(
          `Repository init attempt ${attempt} failed: ${err.message}. Retrying in ${waitMs}ms`
        );
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  })();

  const shutdown = async () => {
    console.log('Shutting down API...');
    server.close();
    try {
      await repository.close();
    } catch (_) {
      // ignore
    }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('API failed to start:', err);
  process.exit(1);
});

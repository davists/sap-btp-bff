'use strict';

const { config } = require('./config');
const { createRepository } = require('./repository');
const { createApp } = require('./app');

async function main() {
  const repository = createRepository();
  await repository.init();

  const app = createApp(repository);
  const server = app.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`);
  });

  const shutdown = async () => {
    console.log('Shutting down API...');
    server.close();
    await repository.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('API failed to start:', err);
  process.exit(1);
});

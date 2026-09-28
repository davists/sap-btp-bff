'use strict';

const { config } = require('./config');
const { createBff } = require('./bff');
const { createAuthMiddleware } = require('./auth');

/**
 * Starts the BFF Express app on bffPort.
 *
 * Authentication is enabled when AUTH_ENABLED !== 'false' AND XSUAA
 * credentials are available (bound service). Otherwise the BFF runs
 * unprotected, which is only intended for local development.
 */
function startBff() {
  let authMiddleware;
  if (config.authEnabled) {
    authMiddleware = createAuthMiddleware();
    if (authMiddleware) {
      console.log('XSUAA authentication enabled');
    } else {
      console.warn('AUTH_ENABLED but no XSUAA credentials found - running WITHOUT auth');
    }
  } else {
    console.warn('AUTH_ENABLED=false - running WITHOUT auth (local dev only)');
  }

  const app = createBff({
    apiUrl: config.apiUrl,
    apiTimeoutMs: config.apiTimeoutMs,
    authMiddleware,
    apiSecret: config.apiSecret,
  });
  return app.listen(config.bffPort, () => {
    console.log(`BFF listening on port ${config.bffPort} -> API ${config.apiUrl}`);
  });
}

module.exports = { startBff };

// Allow running the BFF standalone (local dev without the App Router).
if (require.main === module) {
  startBff();
}

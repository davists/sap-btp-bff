'use strict';

const config = {
  // Port of the BFF Express app. When embedded behind the App Router,
  // the approuter listens on PORT and forwards to this destination.
  bffPort: Number(process.env.BFF_PORT || 5001),

  // Public port of the App Router (the only public entry point on CF).
  port: Number(process.env.PORT || 5000),

  // URL of the internal API service. On CF this is the api app's
  // internal/app route; locally it defaults to the api dev port.
  apiUrl: process.env.API_URL || 'http://127.0.0.1:4001',

  // Upstream request timeout in milliseconds.
  apiTimeoutMs: Number(process.env.API_TIMEOUT_MS || 10000),

  // Toggle XSUAA auth. Disabled locally when there is no bound service.
  authEnabled: process.env.AUTH_ENABLED !== 'false',

  // Shared secret sent to the API so it accepts calls only from this BFF.
  apiSecret: process.env.API_SHARED_SECRET,
};

module.exports = { config };

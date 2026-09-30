'use strict';

const approuter = require('@sap/approuter');
const { config } = require('./config');
const { startBff } = require('./bffServer');

/**
 * Web monolith entry point.
 *
 * Runs two things in one CF app:
 *   1. The BFF Express app on BFF_PORT (internal, localhost only).
 *   2. The App Router on PORT (public). It performs the OAuth2/OIDC login
 *      against XSUAA (which trusts Cloud Identity Services), serves the
 *      static frontend from ./public, and forwards /api/** to the BFF with
 *      the user's JWT injected as the Authorization header.
 *
 * The browser only ever talks to the App Router and never sees the token.
 */
function main() {
  // 1) Start the internal BFF.
  startBff();

  // 2) Point the App Router's "bff" destination at the local in-process BFF.
  //    We ALWAYS overwrite `destinations` here: a stale value left over from
  //    a previous deploy (cf push does not remove old env vars) would
  //    otherwise make the App Router forward to a dead host and return 502.
  process.env.destinations = JSON.stringify([
    {
      name: 'bff',
      url: `http://127.0.0.1:${config.bffPort}`,
      forwardAuthToken: true,
    },
  ]);

  // 3) Start the App Router (listens on PORT).
  const ar = approuter();
  ar.start();
  console.log(`App Router starting on port ${process.env.PORT || config.port}`);
}

main();

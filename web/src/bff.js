'use strict';

const express = require('express');
const path = require('path');

/**
 * Builds the BFF Express app.
 *
 * @param {object}   options
 * @param {string}   options.apiUrl         - base URL of the internal API
 * @param {number}   options.apiTimeoutMs   - upstream timeout
 * @param {Function} [options.authMiddleware] - Express middleware guarding /api/*.
 *                                              Defaults to a pass-through (no auth).
 */
function createBff({ apiUrl, apiTimeoutMs = 10000, authMiddleware, apiSecret } = {}) {
  const app = express();
  // strict:false so top-level JSON primitives (e.g. a bare string) are
  // accepted, since the frontend may send "any data" as plain text.
  app.use(express.json({ limit: '1mb', strict: false }));

  const guard = authMiddleware || ((_req, _res, next) => next());

  // Calls the internal API and relays status + JSON body.
  async function relay(method, res, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), apiTimeoutMs);
    try {
      const headers = { 'content-type': 'application/json' };
      // Service-to-service secret so the API accepts calls only from the BFF.
      if (apiSecret) headers['x-internal-secret'] = apiSecret;
      const response = await fetch(`${apiUrl}/items`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      res.status(response.status).json(data);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error(`BFF ${method} /items upstream timeout`);
        res.status(504).json({ error: 'upstream timeout' });
      } else {
        console.error(`BFF ${method} /items upstream error:`, err.message);
        res.status(502).json({ error: 'upstream unavailable' });
      }
    } finally {
      clearTimeout(timer);
    }
  }

  app.get('/api/items', guard, (_req, res) => relay('GET', res));
  app.post('/api/items', guard, (req, res) => relay('POST', res, req.body));

  // Health check (public, no auth) for CF and smoke tests.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Serve the static frontend. In production the App Router handles static
  // files; keeping it here lets the BFF run standalone in local dev.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}

module.exports = { createBff };

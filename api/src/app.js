'use strict';

const express = require('express');

/**
 * Builds the Express app for the internal API.
 * @param {object} repository - item repository (HANA or in-memory)
 */
function createApp(repository) {
  const app = express();
  // strict:false so top-level JSON primitives (e.g. a bare string) are
  // accepted, since callers may store "any data" as plain text.
  app.use(express.json({ limit: '1mb', strict: false }));

  // Health check (used by CF and smoke tests) - always open.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Service-to-service guard. When API_SHARED_SECRET is set, every /items
  // request must present it in the x-internal-secret header. Only the BFF
  // (bff-web) knows the secret, so even though the API has a public route,
  // random internet callers cannot use it. User authentication still happens
  // at the App Router/BFF layer via XSUAA (defense in depth).
  const sharedSecret = process.env.API_SHARED_SECRET;
  app.use('/items', (req, res, next) => {
    if (!sharedSecret) return next(); // local dev without a secret
    if (req.get('x-internal-secret') === sharedSecret) return next();
    return res.status(401).json({ error: 'unauthorized' });
  });

  // List all items (most recent first)
  app.get('/items', async (_req, res) => {
    try {
      const items = await repository.list();
      res.json(items);
    } catch (err) {
      console.error('GET /items failed:', err.message);
      res.status(500).json({ error: 'failed to list items' });
    }
  });

  // Insert "any data": the whole JSON body is stored as the payload
  app.post('/items', async (req, res) => {
    const payload = req.body;
    if (payload === undefined || payload === null || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
      return res.status(400).json({ error: 'request body must contain data' });
    }
    try {
      const created = await repository.insert(payload);
      res.status(201).json(created);
    } catch (err) {
      console.error('POST /items failed:', err.message);
      res.status(500).json({ error: 'failed to store item' });
    }
  });

  return app;
}

module.exports = { createApp };

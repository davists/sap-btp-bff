'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { createBff } = require('../src/bff');
const { createAuthMiddleware } = require('../src/auth');

// Minimal fake XSUAA credentials (enough to build the strategy; no real
// JWKS calls happen unless a token is presented).
const fakeCredentials = {
  clientid: 'test-client',
  clientsecret: 'test-secret',
  url: 'https://example.authentication.us10.hana.ondemand.com',
  uaadomain: 'authentication.us10.hana.ondemand.com',
  xsappname: 'sap-btp-bff',
  verificationkey: '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----',
};

async function startSecuredBff() {
  const authMiddleware = createAuthMiddleware({ credentials: fakeCredentials });
  assert.ok(authMiddleware, 'auth middleware should be created from credentials');
  const app = createBff({ apiUrl: 'http://127.0.0.1:4001', authMiddleware });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

test('createAuthMiddleware returns null without credentials', () => {
  const saved = process.env.VCAP_SERVICES;
  delete process.env.VCAP_SERVICES;
  try {
    const mw = createAuthMiddleware();
    assert.strictEqual(mw, null);
  } finally {
    if (saved !== undefined) process.env.VCAP_SERVICES = saved;
  }
});

test('GET /api/items without token returns 401', async () => {
  const bff = await startSecuredBff();
  try {
    const res = await fetch(`${bff.url}/api/items`);
    assert.strictEqual(res.status, 401);
  } finally {
    await bff.close();
  }
});

test('GET /api/items with malformed token returns 401', async () => {
  const bff = await startSecuredBff();
  try {
    const res = await fetch(`${bff.url}/api/items`, {
      headers: { authorization: 'Bearer not-a-real-jwt' },
    });
    assert.strictEqual(res.status, 401);
  } finally {
    await bff.close();
  }
});

test('/health stays public even with auth enabled', async () => {
  const bff = await startSecuredBff();
  try {
    const res = await fetch(`${bff.url}/health`);
    assert.strictEqual(res.status, 200);
  } finally {
    await bff.close();
  }
});

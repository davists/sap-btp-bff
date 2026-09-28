'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { createBff } = require('../src/bff');

/** Starts a fake upstream API and returns { url, close, received }. */
async function startFakeApi(handler) {
  const received = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      received.push({ method: req.method, url: req.url, body: raw });
      handler(req, res, raw);
    });
  });
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    received,
    close: () => new Promise((r) => server.close(r)),
  };
}

/** Starts the BFF app pointing at apiUrl and returns { url, close }. */
async function startBffApp(apiUrl) {
  const app = createBff({ apiUrl, apiTimeoutMs: 500 });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

test('GET /api/items relays list from upstream API', async () => {
  const api = await startFakeApi((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify([{ id: 1, payload: { a: 1 } }]));
  });
  const bff = await startBffApp(api.url);
  try {
    const res = await fetch(`${bff.url}/api/items`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body[0].payload.a, 1);
  } finally {
    await bff.close();
    await api.close();
  }
});

test('POST /api/items forwards body and relays 201', async () => {
  const api = await startFakeApi((_req, res, raw) => {
    const payload = JSON.parse(raw);
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 9, payload }));
  });
  const bff = await startBffApp(api.url);
  try {
    const res = await fetch(`${bff.url}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'bff' }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.deepStrictEqual(body.payload, { hello: 'bff' });
    assert.strictEqual(api.received[0].body, JSON.stringify({ hello: 'bff' }));
  } finally {
    await bff.close();
    await api.close();
  }
});

test('returns 502 when upstream is unavailable', async () => {
  // Point BFF at a port with nothing listening.
  const bff = await startBffApp('http://127.0.0.1:1');
  try {
    const res = await fetch(`${bff.url}/api/items`);
    assert.strictEqual(res.status, 502);
  } finally {
    await bff.close();
  }
});

test('returns 504 when upstream times out', async () => {
  const api = await startFakeApi(() => {
    // never respond -> BFF aborts after apiTimeoutMs (500ms)
  });
  const bff = await startBffApp(api.url);
  try {
    const res = await fetch(`${bff.url}/api/items`);
    assert.strictEqual(res.status, 504);
  } finally {
    await bff.close();
    await api.close();
  }
});

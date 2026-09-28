'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');
const { createMemoryRepository } = require('../src/repository/memoryRepository');

/** Starts the app on an ephemeral port and returns { baseUrl, close }. */
async function startApp() {
  const repo = createMemoryRepository();
  await repo.init();
  const app = createApp(repo);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

test('POST /items then GET /items returns the stored item', async () => {
  const { baseUrl, close } = await startApp();
  try {
    const postRes = await fetch(`${baseUrl}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hi hana' }),
    });
    assert.strictEqual(postRes.status, 201);
    const created = await postRes.json();
    assert.deepStrictEqual(created.payload, { message: 'hi hana' });

    const getRes = await fetch(`${baseUrl}/items`);
    assert.strictEqual(getRes.status, 200);
    const items = await getRes.json();
    assert.strictEqual(items.length, 1);
    assert.deepStrictEqual(items[0].payload, { message: 'hi hana' });
  } finally {
    await close();
  }
});

test('POST /items with empty body returns 400', async () => {
  const { baseUrl, close } = await startApp();
  try {
    const res = await fetch(`${baseUrl}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
  } finally {
    await close();
  }
});

test('GET /health returns ok', async () => {
  const { baseUrl, close } = await startApp();
  try {
    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
  } finally {
    await close();
  }
});

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { createMemoryRepository } = require('../src/repository/memoryRepository');

test('insert returns item with id, payload and created_at', async () => {
  const repo = createMemoryRepository();
  await repo.init();
  const created = await repo.insert({ hello: 'world' });
  assert.strictEqual(typeof created.id, 'number');
  assert.deepStrictEqual(created.payload, { hello: 'world' });
  assert.strictEqual(typeof created.created_at, 'string');
});

test('list returns items most recent first', async () => {
  const repo = createMemoryRepository();
  await repo.init();
  await repo.insert({ n: 1 });
  await repo.insert({ n: 2 });
  const items = await repo.list();
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].payload.n, 2);
  assert.strictEqual(items[1].payload.n, 1);
});

test('stores arbitrary shapes (strings, arrays, nested)', async () => {
  const repo = createMemoryRepository();
  await repo.init();
  await repo.insert({ arr: [1, 2, 3], nested: { a: { b: 'c' } } });
  const [item] = await repo.list();
  assert.deepStrictEqual(item.payload.arr, [1, 2, 3]);
  assert.strictEqual(item.payload.nested.a.b, 'c');
});

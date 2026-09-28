'use strict';

/**
 * In-memory implementation of the item repository.
 *
 * Used for local runs without HANA and for unit tests. Mirrors the
 * behaviour of the HANA repository: each item gets an id and a created_at
 * timestamp, and stores an arbitrary JSON payload as text.
 */
function createMemoryRepository() {
  /** @type {Array<{id:number, payload:string, created_at:string}>} */
  const rows = [];
  let nextId = 1;

  return {
    async init() {
      // no-op: nothing to create for in-memory storage
    },

    async insert(payload) {
      const row = {
        id: nextId++,
        payload: JSON.stringify(payload),
        created_at: new Date().toISOString(),
      };
      rows.push(row);
      return { id: row.id, payload, created_at: row.created_at };
    },

    async list() {
      return rows
        .slice()
        .sort((a, b) => b.id - a.id)
        .map((r) => ({
          id: r.id,
          payload: JSON.parse(r.payload),
          created_at: r.created_at,
        }));
    },

    async close() {
      // no-op
    },
  };
}

module.exports = { createMemoryRepository };

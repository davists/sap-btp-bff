'use strict';

const { config } = require('../config');
const { createMemoryRepository } = require('./memoryRepository');
const { createHanaRepository } = require('./hanaRepository');

/**
 * Factory that returns a HANA-backed repository when credentials are
 * available, otherwise falls back to the in-memory repository.
 */
function createRepository() {
  if (config.hana) {
    console.log('Using HANA repository');
    return createHanaRepository(config.hana, config.tableName);
  }
  console.log('No HANA credentials found - using in-memory repository');
  return createMemoryRepository();
}

module.exports = { createRepository };

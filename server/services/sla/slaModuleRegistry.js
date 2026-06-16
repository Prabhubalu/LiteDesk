'use strict';

const casesSlaAdapter = require('./adapters/casesSlaAdapter');
const { createGenericSlaAdapter } = require('./adapters/genericSlaAdapter');

const adapters = new Map();

function registerAdapter(moduleKey, adapter) {
  if (!moduleKey || !adapter) return;
  adapters.set(String(moduleKey).toLowerCase(), adapter);
}

function getAdapter(moduleKey, options = {}) {
  const key = String(moduleKey || '').toLowerCase();
  if (!key) return null;
  if (adapters.has(key)) return adapters.get(key);
  return createGenericSlaAdapter(key, options.appKey || null);
}

function listAdapters() {
  return Array.from(adapters.entries()).map(([moduleKey, adapter]) => ({
    moduleKey,
    appKey: adapter.appKey || null,
    milestoneKeys: adapter.milestoneKeys || [],
    priorityDimension: adapter.priorityDimension || 'priority',
    labelKey: adapter.labelKey || null
  }));
}

function bootstrapSlaModuleRegistry() {
  if (!adapters.has('cases')) {
    registerAdapter('cases', casesSlaAdapter);
  }
}

bootstrapSlaModuleRegistry();

module.exports = {
  registerAdapter,
  getAdapter,
  listAdapters,
  bootstrapSlaModuleRegistry
};

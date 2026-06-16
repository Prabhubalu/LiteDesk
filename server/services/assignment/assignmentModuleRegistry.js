'use strict';

const casesAssignmentAdapter = require('./adapters/casesAssignmentAdapter');
const { createGenericAssignmentAdapter } = require('./adapters/genericAssignmentAdapter');

const adapters = new Map();

const KNOWN_OWNER_PATHS = {
  people: 'assignedTo',
  deals: 'ownerId',
  organizations: 'assignedTo',
  tasks: 'assignedTo',
  events: 'eventOwnerId',
  items: 'assignedTo',
  forms: 'assignedTo'
};

function registerAdapter(moduleKey, adapter) {
  if (!moduleKey || !adapter) return;
  adapters.set(String(moduleKey).toLowerCase(), adapter);
}

function getAdapter(moduleKey, options = {}) {
  const key = String(moduleKey || '').toLowerCase();
  if (!key) return null;
  if (adapters.has(key)) return adapters.get(key);
  return createGenericAssignmentAdapter(key, {
    appKey: options.appKey || null,
    moduleFields: options.moduleFields || [],
    ownerPath: options.ownerPath || KNOWN_OWNER_PATHS[key] || null
  });
}

function listAdapters() {
  return Array.from(adapters.entries()).map(([moduleKey, adapter]) => ({
    moduleKey,
    appKey: adapter.appKey || null,
    ownerPath: adapter.ownerPath || null,
    labelKey: adapter.labelKey || null,
    generic: Boolean(adapter.generic)
  }));
}

function bootstrapAssignmentModuleRegistry() {
  if (!adapters.has('cases')) {
    registerAdapter('cases', casesAssignmentAdapter);
  }
}

bootstrapAssignmentModuleRegistry();

module.exports = {
  registerAdapter,
  getAdapter,
  listAdapters,
  bootstrapAssignmentModuleRegistry,
  KNOWN_OWNER_PATHS
};

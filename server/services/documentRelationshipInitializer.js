/**
 * Register default document attachment RelationshipDefinitions (idempotent).
 */

const ModuleDefinition = require('../models/ModuleDefinition');
const {
  MODULE_APP_FALLBACKS,
  SOURCE_APP_BY_MODULE,
  ensureDocumentRelationshipDefinitions
} = require('../constants/defaultDocumentRelationships');

const DOCUMENTS_APP_KEY = 'platform';
const DOCUMENTS_MODULE_KEY = 'documents';

async function moduleExists(appKey, moduleKey) {
  const mk = String(moduleKey || '').toLowerCase();
  if (!mk) return false;

  const candidates = [
    String(appKey || '').toLowerCase(),
    ...(MODULE_APP_FALLBACKS[mk] || ['platform'])
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];
  for (const ak of uniqueCandidates) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await ModuleDefinition.findOne({
      appKey: ak,
      moduleKey: mk,
      enabled: true,
      organizationId: null
    })
      .select('_id')
      .lean();
    if (existing) return true;
  }
  return false;
}

async function registerDefaultDocumentRelationships() {
  const documentsExists = await moduleExists(DOCUMENTS_APP_KEY, DOCUMENTS_MODULE_KEY);
  if (!documentsExists) {
    return;
  }

  await ensureDocumentRelationshipDefinitions();
}

async function registerDocumentRelatedRelationship() {
  await ensureDocumentRelationshipDefinitions();
}

async function registerDocumentChildRelationship() {
  await ensureDocumentRelationshipDefinitions();
}

module.exports = {
  registerDefaultDocumentRelationships,
  registerDocumentRelatedRelationship,
  registerDocumentChildRelationship,
  moduleExists,
  SOURCE_APP_BY_MODULE
};

'use strict';

/**
 * orgMemoryService — shared, tenant-scoped org memory (glossary, playbooks,
 * grounding facts). Thin CRUD over AstraOrgMemory. Model injectable for tests.
 */

const AstraOrgMemory = require('../../../models/AstraOrgMemory');

function model(deps) {
  return deps?.AstraOrgMemory || AstraOrgMemory;
}

/** List org memory rows within a scope (defaults 'grounding'). */
async function listOrgMemory({ organizationId, scope = 'grounding', limit = 100 }, deps = {}) {
  if (!organizationId) return [];
  return model(deps)
    .find({ organizationId, scope })
    .sort({ updatedAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 500))
    .lean();
}

/** Upsert a single org memory fact (unique on org+scope+key). */
async function upsertOrgMemory({ organizationId, scope = 'grounding', key, value, metadata = {}, createdBy = null }, deps = {}) {
  if (!organizationId || !key) throw new Error('organizationId and key are required');
  return model(deps).findOneAndUpdate(
    { organizationId, scope, key },
    { $set: { value: String(value ?? ''), metadata, createdBy } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

/** Remove an org memory fact. */
async function deleteOrgMemory({ organizationId, scope, key }, deps = {}) {
  if (!organizationId || !scope || !key) throw new Error('organizationId, scope and key are required');
  const result = await model(deps).deleteOne({ organizationId, scope, key });
  return { deleted: Number(result?.deletedCount || 0) };
}

module.exports = {
  listOrgMemory,
  upsertOrgMemory,
  deleteOrgMemory,
};

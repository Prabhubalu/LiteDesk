'use strict';

/**
 * personalMemoryService — durable per-user Astra memory (tenant-scoped).
 * Thin CRUD over AstraPersonalMemory. Model is injectable for tests.
 */

const AstraPersonalMemory = require('../../../models/AstraPersonalMemory');

function model(deps) {
  return deps?.AstraPersonalMemory || AstraPersonalMemory;
}

/** Load (or synthesize empty) personal memory for a user. */
async function getPersonalMemory({ organizationId, userId }, deps = {}) {
  if (!organizationId || !userId) return { facts: [], preferences: {} };
  const doc = await model(deps)
    .findOne({ organizationId, userId })
    .lean();
  return doc || { organizationId, userId, facts: [], preferences: {} };
}

/** Upsert preferences / last surface for a user. */
async function updatePersonalMemory({ organizationId, userId, patch = {} }, deps = {}) {
  if (!organizationId || !userId) throw new Error('organizationId and userId are required');
  const update = {};
  if (patch.preferences) update.preferences = patch.preferences;
  if (patch.lastSurface !== undefined) update.lastSurface = patch.lastSurface;
  if (patch.lastModuleKey !== undefined) update.lastModuleKey = patch.lastModuleKey;
  if (patch.lastRecordId !== undefined) update.lastRecordId = patch.lastRecordId;

  return model(deps).findOneAndUpdate(
    { organizationId, userId },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

/** Remember a discrete fact (dedup by key). */
async function rememberFact({ organizationId, userId, key, value, source = 'astra', confidence = 0.6 }, deps = {}) {
  if (!organizationId || !userId || !key) throw new Error('organizationId, userId and key are required');
  const M = model(deps);
  await M.updateOne(
    { organizationId, userId },
    { $pull: { facts: { key } } },
    { upsert: true },
  );
  return M.findOneAndUpdate(
    { organizationId, userId },
    { $push: { facts: { key, value: String(value ?? ''), source, confidence } } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

module.exports = {
  getPersonalMemory,
  updatePersonalMemory,
  rememberFact,
};

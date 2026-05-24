'use strict';

const TargetTypeDefinition = require('../../models/TargetTypeDefinition');
const { DEFAULT_TARGET_TYPES } = require('../../constants/targetConstants');

async function ensureDefaultTargetTypes(organizationId) {
  for (const def of DEFAULT_TARGET_TYPES) {
    await TargetTypeDefinition.findOneAndUpdate(
      { organizationId, key: def.key },
      {
        $setOnInsert: {
          organizationId,
          key: def.key,
          name: def.name,
          metricKind: def.metricKind,
          defaultSourceModules: def.defaultSourceModules,
          isSystem: true,
          enabled: true
        }
      },
      { upsert: true, new: true }
    );
  }
}

async function listTargetTypes(organizationId) {
  await ensureDefaultTargetTypes(organizationId);
  return TargetTypeDefinition.find({ organizationId, enabled: true }).sort({ name: 1 }).lean();
}

module.exports = {
  ensureDefaultTargetTypes,
  listTargetTypes
};

'use strict';

const Organization = require('../../models/Organization');

async function resolveDependencyWarnings(target, organization) {
  const warnings = [];
  const org = organization || (await Organization.findById(target.organizationId).lean());
  const enabledApps = new Set(
    (org?.enabledApps || org?.applications || [])
      .map((a) => (typeof a === 'string' ? a : a?.appKey || a?.key || '').toUpperCase())
      .filter(Boolean)
  );

  if (!enabledApps.size && org?.subscription?.enabledApps) {
    for (const k of org.subscription.enabledApps) enabledApps.add(String(k).toUpperCase());
  }

  for (const mod of target.sourceModules || []) {
    if (enabledApps.size && !enabledApps.has(mod.appKey)) {
      warnings.push(`App ${mod.appKey} is disabled; contributions from ${mod.moduleKey} are paused.`);
    }
  }

  return warnings;
}

module.exports = {
  resolveDependencyWarnings
};

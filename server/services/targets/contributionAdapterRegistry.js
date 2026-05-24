'use strict';

/**
 * Contribution adapter registry for cross-app targets.
 * MVP: SALES/deals, HELPDESK/cases, PLATFORM/tasks.
 * Future: MARKETING/forms|campaigns, INVENTORY/orders|items — register when apps ship.
 */
const ADAPTERS = {
  SALES: {
    deals: { entityType: 'deal', defaultMetricField: 'amount' }
  },
  HELPDESK: {
    cases: { entityType: 'case', defaultMetricField: null }
  },
  PLATFORM: {
    tasks: { entityType: 'task', defaultMetricField: null }
  },
  MARKETING: {
    forms: { entityType: 'form_response', status: 'stub' },
    campaigns: { entityType: 'campaign', status: 'stub' }
  },
  INVENTORY: {
    orders: { entityType: 'order', status: 'stub' },
    items: { entityType: 'item', status: 'stub' }
  }
};

function listActiveAdapters(enabledAppKeys = []) {
  const enabled = new Set((enabledAppKeys || []).map((k) => String(k).toUpperCase()));
  const rows = [];
  for (const [appKey, modules] of Object.entries(ADAPTERS)) {
    if (enabled.size && !enabled.has(appKey)) continue;
    for (const [moduleKey, meta] of Object.entries(modules)) {
      rows.push({ appKey, moduleKey, ...meta });
    }
  }
  return rows;
}

module.exports = {
  ADAPTERS,
  listActiveAdapters
};

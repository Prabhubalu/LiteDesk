const { test } = require('node:test');
const assert = require('node:assert/strict');

const uiCompositionService = require('../../services/uiCompositionService');
const {
  buildDefaultSharingEntries,
  seedSharingDefaultsForOrganization
} = require('../../services/sharingSeedService');
const { APP_KEYS } = require('../../constants/appKeys');

const orgId = '507f1f77bcf86cd799439011';

function makeOrganization(enabledAppKeys) {
  return {
    enabledApps: enabledAppKeys.map((appKey) => ({ appKey, status: 'ACTIVE' }))
  };
}

test('buildDefaultSharingEntries seeds core + app modules for every enabled app', async () => {
  const originalGetModules = uiCompositionService.getUIModulesForApp;
  uiCompositionService.getUIModulesForApp = async (_organizationId, appKey) => {
    if (appKey === APP_KEYS.SALES) {
      return [{ moduleKey: 'deals', label: 'Deals' }];
    }
    if (appKey === APP_KEYS.HELPDESK) {
      return [{ moduleKey: 'cases', label: 'Cases' }];
    }
    if (appKey === APP_KEYS.AUDIT) {
      return [{ moduleKey: 'audits', label: 'Audits' }];
    }
    return [];
  };

  try {
    const organization = makeOrganization([APP_KEYS.SALES, APP_KEYS.HELPDESK, APP_KEYS.AUDIT]);
    const entries = await buildDefaultSharingEntries(orgId, organization);
    const keys = new Set(entries.map((row) => `${row.appKey}:${row.moduleKey}`));

    assert.ok(keys.has(`${APP_KEYS.SALES}:people`));
    assert.ok(keys.has(`${APP_KEYS.SALES}:documents`));
    assert.ok(keys.has(`${APP_KEYS.SALES}:deals`));
    assert.ok(keys.has(`${APP_KEYS.HELPDESK}:people`));
    assert.ok(keys.has(`${APP_KEYS.HELPDESK}:cases`));
    assert.ok(keys.has(`${APP_KEYS.AUDIT}:people`));
    assert.ok(keys.has(`${APP_KEYS.AUDIT}:audits`));
    assert.ok(keys.has(`${APP_KEYS.SALES}:reports`));
  } finally {
    uiCompositionService.getUIModulesForApp = originalGetModules;
  }
});

test('seedSharingDefaultsForOrganization backfills missing enabled-app rows', async () => {
  const originalGetModules = uiCompositionService.getUIModulesForApp;
  uiCompositionService.getUIModulesForApp = async (_organizationId, appKey) => {
    if (appKey === APP_KEYS.HELPDESK) return [{ moduleKey: 'cases', label: 'Cases' }];
    if (appKey === APP_KEYS.SALES) return [{ moduleKey: 'deals', label: 'Deals' }];
    return [];
  };

  const stored = [
    { organizationId: orgId, appKey: APP_KEYS.SALES, moduleKey: 'people', mode: 'private' }
  ];

  const Model = {
    deleteMany: async () => ({ deletedCount: 0 }),
    findOne: (query) => ({
      lean: async () =>
        stored.find(
          (row) =>
            String(row.organizationId) === String(query.organizationId) &&
            row.appKey === query.appKey &&
            row.moduleKey === query.moduleKey
        ) || null
    }),
    updateOne: async (query, update, options = {}) => {
      const existing = stored.find(
        (row) =>
          String(row.organizationId) === String(query.organizationId) &&
          row.appKey === query.appKey &&
          row.moduleKey === query.moduleKey
      );
      if (existing) return { matchedCount: 1, modifiedCount: 0, upsertedCount: 0 };
      const doc = {
        ...(update?.$setOnInsert || {}),
        organizationId: query.organizationId,
        appKey: query.appKey,
        moduleKey: query.moduleKey
      };
      stored.push(doc);
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    },
    create: async (doc) => {
      stored.push(doc);
      return doc;
    }
  };

  try {
    const organization = makeOrganization([APP_KEYS.SALES, APP_KEYS.HELPDESK]);
    const result = await seedSharingDefaultsForOrganization(orgId, organization, {
      ModuleSharingDefaultModel: Model
    });

    assert.ok(result.created.length > 0);
    assert.ok(stored.some((row) => row.appKey === APP_KEYS.HELPDESK && row.moduleKey === 'cases'));
    assert.ok(stored.some((row) => row.appKey === APP_KEYS.SALES && row.moduleKey === 'deals'));
  } finally {
    uiCompositionService.getUIModulesForApp = originalGetModules;
  }
});

test('seedSharingDefaultsForOrganization removes app-exclusive modules from wrong app', async () => {
  const originalGetModules = uiCompositionService.getUIModulesForApp;
  uiCompositionService.getUIModulesForApp = async (_organizationId, appKey) => {
    if (appKey === APP_KEYS.HELPDESK) return [{ moduleKey: 'cases', label: 'Cases' }];
    return [];
  };

  const deleted = [];
  const Model = {
    deleteMany: async (query) => {
      deleted.push(query);
      return { deletedCount: 1 };
    },
    findOne: () => ({
      lean: async () => null
    }),
    updateOne: async (query, update) => {
      const doc = {
        ...(update?.$setOnInsert || {}),
        organizationId: query.organizationId,
        appKey: query.appKey,
        moduleKey: query.moduleKey
      };
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    },
    create: async (doc) => doc
  };

  try {
    const organization = makeOrganization([APP_KEYS.SALES, APP_KEYS.HELPDESK]);
    await seedSharingDefaultsForOrganization(orgId, organization, {
      ModuleSharingDefaultModel: Model
    });

    assert.deepEqual(deleted[0], {
      organizationId: orgId,
      moduleKey: 'cases',
      appKey: { $ne: APP_KEYS.HELPDESK }
    });
  } finally {
    uiCompositionService.getUIModulesForApp = originalGetModules;
  }
});

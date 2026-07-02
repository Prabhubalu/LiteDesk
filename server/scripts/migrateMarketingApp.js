#!/usr/bin/env node

/**
 * Register Marketing business app and module definitions in platform metadata.
 * Upserts master DB and syncs dedicated tenant databases.
 *
 * Usage:
 *   node scripts/migrateMarketingApp.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AppDefinition = require('../models/AppDefinition');
const ModuleDefinition = require('../models/ModuleDefinition');
const Organization = require('../models/Organization');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');
const dbConnectionManager = require('../utils/databaseConnectionManager');

const MARKETING_APP = {
  appKey: 'marketing',
  name: 'Marketing',
  description: 'Email campaigns, audiences, templates, and marketing analytics',
  icon: 'megaphone',
  category: 'BUSINESS',
  owner: 'PLATFORM',
  enabled: true,
  order: 4,
  capabilities: {
    usesPeople: true,
    usesOrganization: true,
    usesTransactions: false,
    usesAutomation: true
  },
  settingsSchema: null,
  ui: {
    sidebarOrder: 4,
    icon: 'megaphone',
    defaultRoute: '/dashboard/marketing',
    showInAppSwitcher: true
  },
  marketplace: {
    category: 'Sales',
    beta: true,
    comingSoon: false,
    shortDescription:
      'Create email campaigns, manage audiences, and measure engagement via AMDS delivery'
  }
};

const MARKETING_MODULES = [
  {
    moduleKey: 'campaigns',
    appKey: 'marketing',
    label: 'Campaign',
    pluralLabel: 'Campaigns',
    entityType: 'TRANSACTION',
    primaryField: 'name',
    peopleConstraints: { allowedTypes: ['Contact'], required: false },
    organizationConstraints: { required: false },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: [
        'draft',
        'scheduled',
        'running',
        'paused',
        'completed',
        'cancelled',
        'archived',
        'sending',
        'sent',
        'failed'
      ]
    },
    supports: {
      ownership: true,
      assignment: false,
      comments: true,
      attachments: false,
      automation: true
    },
    permissions: { create: true, edit: true, delete: true, view: true },
    ui: {
      routeBase: '/marketing/campaigns',
      icon: 'megaphone',
      showInSidebar: true,
      sidebarOrder: 1,
      createLabel: 'Create Campaign',
      listLabel: 'Campaigns'
    }
  },
  {
    moduleKey: 'audiences',
    appKey: 'marketing',
    label: 'Audience',
    pluralLabel: 'Audiences',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: { allowedTypes: ['Contact'], required: false },
    organizationConstraints: { required: false },
    lifecycle: null,
    supports: {
      ownership: true,
      assignment: false,
      comments: false,
      attachments: false,
      automation: false
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true,
      import: true,
      export: true
    },
    ui: {
      routeBase: '/marketing/audiences',
      icon: 'users',
      showInSidebar: true,
      sidebarOrder: 2,
      createLabel: 'Create Audience',
      listLabel: 'Audiences'
    }
  },
  {
    moduleKey: 'segments',
    appKey: 'marketing',
    label: 'Segment',
    pluralLabel: 'Segments',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: { allowedTypes: ['Contact'], required: false },
    organizationConstraints: { required: false },
    lifecycle: null,
    supports: {
      ownership: true,
      assignment: false,
      comments: false,
      attachments: false,
      automation: false
    },
    permissions: { create: true, edit: true, delete: true, view: true },
    ui: {
      routeBase: '/marketing/segments',
      icon: 'funnel',
      showInSidebar: true,
      sidebarOrder: 3,
      createLabel: 'Create Segment',
      listLabel: 'Segments'
    }
  },
  {
    moduleKey: 'assets',
    appKey: 'marketing',
    label: 'Asset',
    pluralLabel: 'Assets',
    entityType: 'CORE',
    primaryField: 'filename',
    peopleConstraints: { allowedTypes: [], required: false },
    organizationConstraints: { required: false },
    lifecycle: null,
    supports: {
      ownership: true,
      assignment: false,
      comments: false,
      attachments: false,
      automation: false
    },
    permissions: { create: true, edit: true, delete: true, view: true },
    ui: {
      routeBase: '/marketing/assets',
      icon: 'photo',
      showInSidebar: true,
      sidebarOrder: 4,
      createLabel: 'Upload Asset',
      listLabel: 'Assets'
    }
  }
];

function snapshotDoc(doc) {
  const obj =
    doc && typeof doc.toObject === 'function'
      ? doc.toObject({ depopulate: true })
      : { ...(doc || {}) };
  delete obj._id;
  delete obj.__v;
  delete obj.createdAt;
  delete obj.updatedAt;
  return obj;
}

function getOrRegisterModel(connection, name, schema) {
  return connection.models[name] || connection.model(name, schema);
}

async function upsertMarketingAppDefinition(AppDefModel) {
  const existing = await AppDefModel.findOne({ appKey: MARKETING_APP.appKey });
  if (existing) {
    await AppDefModel.updateOne({ _id: existing._id }, { $set: MARKETING_APP });
    return 'updated';
  }
  await AppDefModel.create(MARKETING_APP);
  return 'created';
}

async function removeMarketingTemplatesModule(ModuleDefModel) {
  const result = await ModuleDefModel.deleteMany({
    appKey: 'marketing',
    moduleKey: 'templates',
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
  });
  return result.deletedCount || 0;
}

async function upsertMarketingModules(ModuleDefModel) {
  const results = [];
  for (const moduleData of MARKETING_MODULES) {
    const filter = {
      appKey: moduleData.appKey,
      moduleKey: moduleData.moduleKey,
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
    };

    const existing = await ModuleDefModel.findOne(filter);
    await ModuleDefModel.updateOne(
      filter,
      { $set: moduleData, $unset: { organizationId: '', key: '' } },
      { upsert: true }
    );
    results.push(`${existing ? 'updated' : 'created'} marketing.${moduleData.moduleKey}`);
  }
  return results;
}

async function syncDedicatedTenantDatabases() {
  const orgs = await Organization.find({
    isTenant: true,
    'database.initialized': true,
    'database.name': { $exists: true, $ne: null }
  })
    .select('name database.name')
    .lean();

  if (!orgs.length) {
    console.log('\n⏭️  No dedicated tenant databases to sync');
    return;
  }

  console.log(`\n🔄 Syncing ${orgs.length} dedicated tenant database(s)...`);
  let synced = 0;

  for (const org of orgs) {
    const dbName = org.database?.name;
    if (!dbName) continue;

    try {
      const connection = await dbConnectionManager.getOrganizationConnection(dbName);
      if (connection.readyState !== 1 && typeof connection.asPromise === 'function') {
        await connection.asPromise();
      }

      const TenantAppDef = getOrRegisterModel(
        connection,
        'AppDefinition',
        AppDefinition.schema
      );
      const TenantModuleDef = getOrRegisterModel(
        connection,
        'ModuleDefinition',
        ModuleDefinition.schema
      );

      const appResult = await upsertMarketingAppDefinition(TenantAppDef);
      const moduleResults = await upsertMarketingModules(TenantModuleDef);
      const removed = await removeMarketingTemplatesModule(TenantModuleDef);
      synced += 1;
      console.log(
        `  ✅ ${org.name || dbName}: app ${appResult}, ${moduleResults.length} modules`
        + (removed ? `, removed templates (${removed})` : '')
      );
    } catch (err) {
      console.warn(`  ⚠️  ${org.name || dbName}: ${err.message}`);
    }
  }

  console.log(`\n📊 Tenant DB sync complete (${synced}/${orgs.length})`);
}

async function migrateMarketingApp() {
  console.log('🚀 Marketing app migration\n');
  const masterUri = getMasterDatabaseUri();
  await mongoose.connect(masterUri);
  console.log('✅ Connected to master database\n');

  const appResult = await upsertMarketingAppDefinition(AppDefinition);
  console.log(`✅ ${appResult === 'created' ? 'Created' : 'Updated'} AppDefinition: marketing`);

  console.log('\n📦 Marketing modules (master)...');
  const moduleResults = await upsertMarketingModules(ModuleDefinition);
  for (const line of moduleResults) {
    console.log(`  ✅ ${line}`);
  }
  const removed = await removeMarketingTemplatesModule(ModuleDefinition);
  if (removed) {
    console.log(`  ✅ removed marketing.templates module definition (${removed})`);
  }

  await syncDedicatedTenantDatabases();

  await mongoose.disconnect();
  console.log('\nDone. Restart the API server, then refresh Platform → Apps or Settings → Applications.');
}

migrateMarketingApp().catch((err) => {
  console.error(err);
  process.exit(1);
});

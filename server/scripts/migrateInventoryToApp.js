/**
 * Register Inventory business app and ensure ledger + workbench ModuleDefinitions.
 * Optionally enable INVENTORY for tenants that already have SALES (backward compat).
 *
 * Usage:
 *   node scripts/migrateInventoryToApp.js
 *   node scripts/migrateInventoryToApp.js --enable-for-sales-tenants
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AppDefinition = require('../models/AppDefinition');
const ModuleDefinition = require('../models/ModuleDefinition');
const Organization = require('../models/Organization');
const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');
const {
  ensureInventoryAppModuleDefinitions
} = require('../services/inventoryModuleBootstrapService');

const INVENTORY_APP = {
  appKey: 'inventory',
  name: 'Inventory',
  description: 'Stock ledger, locations, reservations, and fulfillment operations',
  icon: 'cube',
  category: 'BUSINESS',
  owner: 'PLATFORM',
  enabled: true,
  order: 5,
  capabilities: {
    usesPeople: true,
    usesOrganization: true,
    usesTransactions: true,
    usesAutomation: true
  },
  settingsSchema: null,
  ui: {
    sidebarOrder: 5,
    icon: 'cube',
    defaultRoute: '/dashboard/inventory',
    showInAppSwitcher: true
  }
};

const enableForSalesTenants = process.argv.includes('--enable-for-sales-tenants');

async function upsertInventoryAppDefinition() {
  const existing = await AppDefinition.findOne({ appKey: INVENTORY_APP.appKey });
  if (existing) {
    await AppDefinition.updateOne({ _id: existing._id }, { $set: INVENTORY_APP });
    console.log('✅ Updated AppDefinition: inventory');
    return;
  }
  await AppDefinition.create(INVENTORY_APP);
  console.log('✅ Created AppDefinition: inventory');
}

async function enableInventoryForSalesTenants() {
  const orgs = await Organization.find({
    isTenant: true,
    'enabledApps.appKey': 'SALES',
    'enabledApps.status': 'ACTIVE'
  }).select('_id enabledApps name');

  let orgsUpdated = 0;
  let tenantConfigs = 0;

  for (const org of orgs) {
    const hasInventory = (org.enabledApps || []).some(
      (entry) =>
        String(typeof entry === 'object' ? entry.appKey : entry).toUpperCase() === 'INVENTORY' &&
        (typeof entry !== 'object' || entry.status === 'ACTIVE')
    );
    if (hasInventory) continue;

    org.enabledApps = org.enabledApps || [];
    org.enabledApps.push({ appKey: 'INVENTORY', status: 'ACTIVE', enabledAt: new Date() });
    await org.save();
    orgsUpdated += 1;

    const config = await TenantAppConfiguration.findOneAndUpdate(
      { organizationId: org._id, appKey: 'INVENTORY' },
      { $set: { enabled: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (config) tenantConfigs += 1;
    console.log(`  ✅ Enabled INVENTORY for org: ${org.name || org._id}`);
  }

  console.log(`\n📊 Tenants updated: ${orgsUpdated} orgs, ${tenantConfigs} TenantAppConfiguration rows`);
}

async function migrateInventoryToApp() {
  console.log('🚀 Inventory app migration\n');
  const masterUri = getMasterDatabaseUri();
  await mongoose.connect(masterUri);
  console.log('✅ Connected to master database\n');

  await upsertInventoryAppDefinition();
  const { results } = await ensureInventoryAppModuleDefinitions();
  for (const row of results) {
    const flag = row.created ? 'created' : row.updated ? 'updated' : 'ok';
    console.log(
      `  ✅ inventory.${row.moduleKey} (${flag}${row.moved ? ', moved from platform' : ''})`
    );
  }

  await ModuleDefinition.updateMany(
    { appKey: 'inventory' },
    { $set: { 'ui.showInSidebar': false } }
  );
  console.log('✅ inventory modules ui.showInSidebar=false (client workbench owns nav)\n');

  if (enableForSalesTenants) {
    console.log('\n📦 Enabling INVENTORY for active SALES tenants...');
    await enableInventoryForSalesTenants();
  } else {
    console.log('\n⏭️  Skipping tenant enablement (pass --enable-for-sales-tenants to opt in)');
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

migrateInventoryToApp().catch((err) => {
  console.error(err);
  process.exit(1);
});

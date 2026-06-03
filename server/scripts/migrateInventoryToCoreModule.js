#!/usr/bin/env node

/**
 * Register platform.inventory core module (INV0).
 *
 * Usage: node scripts/migrateInventoryToCoreModule.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');
const {
  INITIAL_INVENTORY_FIELDS,
  INITIAL_INVENTORY_QUICK_CREATE,
  applyInventoryModuleFieldDefaults
} = require('../constants/inventoryModuleDefaults');

const INVENTORY_UI = {
  routeBase: '/inventory',
  icon: '📦',
  showInSidebar: true,
  sidebarOrder: 12,
  createLabel: 'Adjust Stock',
  listLabel: 'Inventory',
  navigationEntity: true,
  excludeFromApps: true
};

async function migrateInventoryToCoreModule() {
  console.log('🚀 Registering platform.inventory module (INV0)...\n');

  const masterUri = getMasterDatabaseUri();
  await mongoose.connect(masterUri);
  console.log('✅ Connected to master database\n');

  let platformModule = await ModuleDefinition.findOne({
    appKey: 'platform',
    moduleKey: 'inventory'
  });

  const basePayload = {
    appKey: 'platform',
    moduleKey: 'inventory',
    label: 'Inventory',
    pluralLabel: 'Inventory',
    entityType: 'TRANSACTION',
    primaryField: 'locationCode',
    type: 'system',
    enabled: true,
    ui: INVENTORY_UI,
    quickCreate: [...INITIAL_INVENTORY_QUICK_CREATE],
    quickCreateLayout: { version: 1, rows: [] },
    fields: applyInventoryModuleFieldDefaults(INITIAL_INVENTORY_FIELDS),
    relationships: [],
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['active', 'inactive']
    },
    supports: {
      ownership: false,
      assignment: false,
      comments: false,
      attachments: false,
      activity: true,
      trash: false
    }
  };

  if (platformModule) {
    await ModuleDefinition.updateOne({ _id: platformModule._id }, { $set: basePayload });
    console.log('✅ Updated existing platform.inventory module\n');
  } else {
    platformModule = await ModuleDefinition.create(basePayload);
    console.log('✅ Created platform.inventory module\n');
  }

  console.log(`Module id: ${platformModule._id}`);
  await mongoose.disconnect();
}

migrateInventoryToCoreModule().catch((err) => {
  console.error(err);
  process.exit(1);
});

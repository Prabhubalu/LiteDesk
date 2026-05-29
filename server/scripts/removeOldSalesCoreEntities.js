#!/usr/bin/env node

/**
 * Remove old core entity modules from sales app
 * 
 * This script removes modules with appKey: 'sales' that are core entities
 * (people, organizations, tasks, events, items, forms, quotes) since they should
 * only exist with appKey: 'platform' and navigationEntity: true
 * 
 * Usage: node server/scripts/removeOldSalesCoreEntities.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

const CORE_ENTITY_MODULE_KEYS = [
  'people',
  'organizations',
  'tasks',
  'events',
  'items',
  'forms',
  'quotes'
];

async function removeOldSalesCoreEntities() {
  try {
    console.log('🚀 Removing old core entity modules from sales app...\n');

    const masterUri = getMasterDatabaseUri();
    console.log('🔗 Connecting to MongoDB master database (arivu_master)...');
    await mongoose.connect(masterUri);
    console.log('✅ Connected to MongoDB master database (arivu_master)\n');

    let removedCount = 0;

    for (const moduleKey of CORE_ENTITY_MODULE_KEYS) {
      // Find and remove old modules with appKey: 'sales'
      const result = await ModuleDefinition.deleteMany({
        appKey: 'sales',
        moduleKey: moduleKey
      });

      if (result.deletedCount > 0) {
        console.log(`  ✅ Removed: sales.${moduleKey} (${result.deletedCount} module(s))`);
        removedCount += result.deletedCount;
      } else {
        console.log(`  ℹ️  No old module found: sales.${moduleKey}`);
      }
    }

    console.log(`\n📊 Summary: Removed ${removedCount} old core entity module(s) from sales app\n`);

    // Verify platform modules exist
    console.log('🔍 Verifying platform modules exist...\n');
    for (const moduleKey of CORE_ENTITY_MODULE_KEYS) {
      const platformModule = await ModuleDefinition.findOne({
        appKey: 'platform',
        moduleKey: moduleKey
      });

      if (platformModule) {
        const hasNavigationEntity = platformModule.ui?.navigationEntity === true;
        const hasExcludeFromApps = platformModule.ui?.excludeFromApps === true;
        console.log(`  ${hasNavigationEntity && hasExcludeFromApps ? '✅' : '⚠️ '} platform.${moduleKey} - navigationEntity: ${hasNavigationEntity}, excludeFromApps: ${hasExcludeFromApps}`);
      } else {
        console.log(`  ❌ Missing: platform.${moduleKey}`);
      }
    }

    console.log('\n✅ Cleanup complete!');
    console.log('\n💡 Next Steps:');
    console.log('   1. Refresh your browser to see the updated sidebar');
    console.log('   2. Core entities should now only appear in Entities section, not under Sales app\n');

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error removing old sales core entities:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

removeOldSalesCoreEntities();


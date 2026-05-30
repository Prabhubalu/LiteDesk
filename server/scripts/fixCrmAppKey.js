#!/usr/bin/env node

/**
 * Fix CRM AppKey Migration
 * 
 * This script updates modules with appKey: 'crm' to the correct appKey:
 * - deals, responses → 'sales'
 * - tasks, events → 'platform' (if they should be entities)
 * 
 * It also removes duplicate modules if they exist.
 * 
 * Usage: node server/scripts/fixCrmAppKey.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

// Mapping of modules that should be migrated from 'crm' to their correct appKey
const CRM_TO_SALES_MODULES = ['deals', 'responses'];
const CRM_TO_PLATFORM_MODULES = []; // tasks and events should already be platform, but check

async function fixCrmAppKey() {
  try {
    console.log('🔧 Fixing CRM AppKey Migration\n');
    console.log('Connecting to database...\n');

    const masterUri = getMasterDatabaseUri();
    await mongoose.connect(masterUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all modules with appKey: 'crm'
    const crmModules = await ModuleDefinition.find({ appKey: 'crm' });
    console.log(`📦 Found ${crmModules.length} modules with appKey: 'crm'\n`);

    if (crmModules.length === 0) {
      console.log('✅ No modules with appKey: "crm" found. Nothing to fix.\n');
      await mongoose.connection.close();
      return;
    }

    // Show what we found
    console.log('Modules to fix:');
    for (const module of crmModules) {
      console.log(`  - ${module.moduleKey} (${module.appKey})`);
    }
    console.log('');

    let updated = 0;
    let deleted = 0;

    for (const module of crmModules) {
      const moduleKey = module.moduleKey.toLowerCase();
      
      // Check if there's already a module with the correct appKey
      let targetAppKey = null;
      
      if (CRM_TO_SALES_MODULES.includes(moduleKey)) {
        targetAppKey = 'sales';
      } else if (moduleKey === 'tasks' || moduleKey === 'events') {
        // Check if platform version exists
        const platformVersion = await ModuleDefinition.findOne({
          appKey: 'platform',
          moduleKey: moduleKey
        });
        
        if (platformVersion) {
          // Platform version exists, delete the CRM version
          console.log(`🗑️  Deleting duplicate ${moduleKey} (crm) - platform version exists`);
          await ModuleDefinition.deleteOne({ _id: module._id });
          deleted++;
          continue;
        } else {
          // No platform version, but these should be platform entities
          // Check if they should have navigationEntity: true
          targetAppKey = 'platform';
        }
      } else {
        // Unknown module, ask what to do
        console.log(`⚠️  Unknown module ${moduleKey} with appKey: 'crm'. Skipping.`);
        continue;
      }

      if (targetAppKey) {
        // Check if target already exists
        const existing = await ModuleDefinition.findOne({
          appKey: targetAppKey,
          moduleKey: moduleKey
        });

        if (existing) {
          // Target exists, delete the CRM version
          console.log(`🗑️  Deleting duplicate ${moduleKey} (crm) - ${targetAppKey} version exists`);
          await ModuleDefinition.deleteOne({ _id: module._id });
          deleted++;
        } else {
          // Update to target appKey
          console.log(`✅ Updating ${moduleKey} from 'crm' to '${targetAppKey}'`);
          await ModuleDefinition.updateOne(
            { _id: module._id },
            { $set: { appKey: targetAppKey } }
          );
          updated++;
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Deleted (duplicates): ${deleted}`);
    console.log(`   - Total fixed: ${updated + deleted}\n`);

    // Verify fixes
    const remainingCrm = await ModuleDefinition.find({ appKey: 'crm' });
    if (remainingCrm.length > 0) {
      console.log(`⚠️  Warning: ${remainingCrm.length} modules still have appKey: 'crm':`);
      for (const module of remainingCrm) {
        console.log(`   - ${module.moduleKey}`);
      }
    } else {
      console.log('✅ All modules with appKey: "crm" have been fixed!\n');
    }

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error fixing CRM appKey:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixCrmAppKey();
}

module.exports = fixCrmAppKey;


#!/usr/bin/env node

/**
 * Migrate Responses module from Sales to Platform.
 *
 * Updates ModuleDefinition for responses:
 * - appKey: 'sales' | 'crm' → 'platform'
 * - navigationEntity: true, excludeFromApps: true
 *
 * Usage: node server/scripts/migrateResponsesToPlatform.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

const LEGACY_APP_KEYS = ['sales', 'crm'];

const PLATFORM_RESPONSES_UI = {
  routeBase: '/responses',
  icon: 'clipboard-document-list',
  showInSidebar: true,
  sidebarOrder: 7.5,
  showAsTabUnder: ['forms'],
  createLabel: 'New Response',
  listLabel: 'All Responses',
  navigationEntity: true,
  excludeFromApps: true
};

async function migrateResponsesToPlatform() {
  try {
    console.log('🔄 Migrating Responses module to Platform...\n');

    const masterUri = getMasterDatabaseUri();
    await mongoose.connect(masterUri);
    console.log('✅ Connected to MongoDB master database\n');

    const legacyModules = await ModuleDefinition.find({
      moduleKey: 'responses',
      appKey: { $in: LEGACY_APP_KEYS }
    });

    const platformModule = await ModuleDefinition.findOne({
      moduleKey: 'responses',
      appKey: 'platform'
    });

    if (legacyModules.length === 0 && platformModule) {
      await ModuleDefinition.updateOne(
        { _id: platformModule._id },
        {
          $set: {
            ui: {
              ...toPlainObject(platformModule.ui),
              ...PLATFORM_RESPONSES_UI,
              icon: 'clipboard-document-list'
            }
          }
        }
      );
      console.log('✅ Responses already on platform — synced UI metadata and icon\n');
    } else if (platformModule && legacyModules.length > 0) {
      console.log(`🗑️  Removing ${legacyModules.length} legacy Sales/CRM responses module(s)...`);
      for (const legacy of legacyModules) {
        await ModuleDefinition.deleteOne({ _id: legacy._id });
        console.log(`   - Deleted appKey=${legacy.appKey} moduleKey=responses`);
      }
      await ModuleDefinition.updateOne(
        { _id: platformModule._id },
        {
          $set: {
            'ui.icon': 'clipboard-document-list',
            ui: {
              ...toPlainObject(platformModule.ui),
              ...PLATFORM_RESPONSES_UI,
              icon: 'clipboard-document-list'
            }
          }
        }
      );
      console.log('✅ Updated existing platform responses module UI flags\n');
    } else if (legacyModules.length > 0) {
      const source = legacyModules[0];
      console.log(`📝 Moving responses from appKey=${source.appKey} to platform...`);
      await ModuleDefinition.updateOne(
        { _id: source._id },
        {
          $set: {
            appKey: 'platform',
            'ui.icon': 'clipboard-document-list',
            ui: {
              ...toPlainObject(source.ui),
              ...PLATFORM_RESPONSES_UI,
              icon: 'clipboard-document-list'
            }
          }
        }
      );
      for (let i = 1; i < legacyModules.length; i += 1) {
        await ModuleDefinition.deleteOne({ _id: legacyModules[i]._id });
        console.log(`   - Removed duplicate appKey=${legacyModules[i].appKey}`);
      }
      console.log('✅ Migrated responses module to platform\n');
    } else {
      console.log('⚠️  No responses module found. Run seedPlatformDefinitionsWithUI.js to seed.\n');
    }

    const verified = await ModuleDefinition.findOne({ moduleKey: 'responses', appKey: 'platform' });
    if (verified) {
      console.log('✅ Verified: responses module is platform-owned');
      console.log(`   navigationEntity=${verified.ui?.navigationEntity === true}`);
      console.log(`   excludeFromApps=${verified.ui?.excludeFromApps === true}\n`);
    }

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

function toPlainObject(value) {
  if (!value) return {};
  if (typeof value.toObject === 'function') return value.toObject();
  return { ...value };
}

if (require.main === module) {
  migrateResponsesToPlatform();
}

module.exports = migrateResponsesToPlatform;

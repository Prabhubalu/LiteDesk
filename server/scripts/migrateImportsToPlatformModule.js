#!/usr/bin/env node

/**
 * Promote Imports from Sales app module to platform core module.
 *
 * - Updates sales.imports in place to platform.imports with navigationEntity flags
 * - Removes any duplicate sales.imports rows if present
 *
 * Usage: node server/scripts/migrateImportsToPlatformModule.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

const IMPORTS_UI = {
  routeBase: '/imports',
  icon: '📥',
  showInSidebar: true,
  sidebarOrder: 9,
  createLabel: 'New Import',
  listLabel: 'Import History',
  navigationEntity: true,
  excludeFromApps: true
};

async function migrateImportsToPlatformModule() {
  try {
    console.log('🚀 Migrating Imports to platform core module...\n');

    const masterUri = getMasterDatabaseUri();
    await mongoose.connect(masterUri);
    console.log('✅ Connected to master database\n');

    const platformImports = await ModuleDefinition.findOne({
      appKey: 'platform',
      moduleKey: 'imports',
      organizationId: null
    });

    if (platformImports) {
      await ModuleDefinition.updateOne(
        { _id: platformImports._id },
        {
          $set: {
            appKey: 'platform',
            ui: { ...(platformImports.ui || {}), ...IMPORTS_UI }
          }
        }
      );
      console.log('  ✅ Updated existing platform.imports');
    } else {
      const salesImports = await ModuleDefinition.findOne({
        appKey: 'sales',
        moduleKey: 'imports',
        organizationId: null
      });

      if (salesImports) {
        await ModuleDefinition.updateOne(
          { _id: salesImports._id },
          {
            $set: {
              appKey: 'platform',
              ui: { ...(salesImports.ui || {}), ...IMPORTS_UI }
            }
          }
        );
        console.log('  ✅ Promoted sales.imports → platform.imports');
      } else {
        await ModuleDefinition.create({
          appKey: 'platform',
          moduleKey: 'imports',
          organizationId: null,
          label: 'Import',
          pluralLabel: 'Imports',
          entityType: 'CORE',
          primaryField: 'fileName',
          type: 'system',
          enabled: true,
          ui: IMPORTS_UI
        });
        console.log('  ✅ Created platform.imports');
      }
    }

    const deleteResult = await ModuleDefinition.deleteMany({
      appKey: 'sales',
      moduleKey: 'imports',
      organizationId: null
    });
    if (deleteResult.deletedCount > 0) {
      console.log(`  ✅ Removed leftover sales.imports (${deleteResult.deletedCount} doc(s))`);
    }

    const verify = await ModuleDefinition.findOne({
      appKey: 'platform',
      moduleKey: 'imports',
      organizationId: null
    }).lean();
    const ok =
      verify &&
      verify.ui?.navigationEntity === true &&
      verify.ui?.excludeFromApps === true;
    console.log(
      `\n${ok ? '✅' : '⚠️ '} Verification: platform.imports navigationEntity=${verify?.ui?.navigationEntity}, excludeFromApps=${verify?.ui?.excludeFromApps}`
    );

    console.log('\n💡 Refresh the browser; Import should appear under Core Modules, not Sales app nav.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

migrateImportsToPlatformModule();

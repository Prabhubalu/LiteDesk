#!/usr/bin/env node

/**
 * ============================================================================
 * Seed Tenant Defaults (Phase 0C)
 * ============================================================================
 * 
 * This script seeds default tenant app and module configurations for existing tenants.
 * 
 * For each existing tenant (Organization):
 * 1. Enable tenant apps that match platform definitions (SALES, AUDIT, PORTAL, LMS)
 * 2. Enable all modules for each app
 * 3. Set sane defaults
 * 
 * This script is idempotent - safe to run multiple times.
 * 
 * Usage: node server/scripts/seedTenantDefaults.js
 * 
 * ============================================================================
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const TenantModuleConfiguration = require('../models/TenantModuleConfiguration');
const AppDefinition = require('../models/AppDefinition');
const ModuleDefinition = require('../models/ModuleDefinition');

// Support both MONGODB_URI and MONGO_URI
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;

/**
 * Map tenant appKey (must match TenantAppConfiguration / TenantModuleConfiguration enum)
 * to platform AppDefinition / ModuleDefinition appKey (lowercase).
 */
const APP_KEY_MAP = {
  SALES: 'sales',
  AUDIT: 'audit',
  PORTAL: 'portal', // May not exist in platform metadata yet
  LMS: 'lms', // May not exist in platform metadata yet
  INVENTORY: 'inventory'
};

async function seedTenantDefaults() {
  try {
    console.log('🚀 Seeding Tenant Defaults (Phase 0C)...\n');

    // Validate MongoDB URI
    if (!MONGO_URI) {
      console.error('❌ Error: MONGODB_URI is not set in .env file!');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all tenant organizations
    console.log('📋 Finding tenant organizations...');
    const tenantOrgs = await Organization.find({ isTenant: true });
    console.log(`✅ Found ${tenantOrgs.length} tenant organizations\n`);

    if (tenantOrgs.length === 0) {
      console.log('⚠️  No tenant organizations found. Skipping seed.\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Get platform app definitions
    console.log('📦 Loading platform app definitions...');
    const platformApps = await AppDefinition.find({ enabled: true });
    const platformAppMap = new Map(
      platformApps.map(app => [app.appKey.toLowerCase(), app])
    );
    console.log(`✅ Loaded ${platformApps.length} platform apps\n`);

    // Get platform module definitions
    console.log('📦 Loading platform module definitions...');
    const platformModules = await ModuleDefinition.find({ enabled: true });
    const moduleMapByApp = new Map();
    for (const module of platformModules) {
      const key = `${module.appKey}.${module.moduleKey}`;
      if (!moduleMapByApp.has(module.appKey)) {
        moduleMapByApp.set(module.appKey, []);
      }
      moduleMapByApp.get(module.appKey).push(module);
    }
    console.log(`✅ Loaded ${platformModules.length} platform modules\n`);

    // Process each tenant organization
    let tenantsProcessed = 0;
    let appsCreated = 0;
    let appsUpdated = 0;
    let modulesCreated = 0;
    let modulesUpdated = 0;

    for (const org of tenantOrgs) {
      console.log(`\n🏢 Processing organization: ${org.name} (${org._id})`);

      // Process each app key
      for (const [systemAppKey, platformAppKey] of Object.entries(APP_KEY_MAP)) {
        const platformApp = platformAppMap.get(platformAppKey);

        // Skip if platform app doesn't exist (e.g., PORTAL, LMS not yet seeded)
        if (!platformApp) {
          console.log(`  ⚠️  Skipping ${systemAppKey} - platform definition not found`);
          continue;
        }

        // Create or update TenantAppConfiguration
        const existingAppConfig = await TenantAppConfiguration.findOne({
          organizationId: org._id,
          appKey: systemAppKey
        });

        if (existingAppConfig) {
          // Update if needed
          if (!existingAppConfig.enabled) {
            existingAppConfig.enabled = true;
            await existingAppConfig.save();
            appsUpdated++;
            console.log(`  ✅ Updated app: ${systemAppKey}`);
          } else {
            console.log(`  ⏭️  App already configured: ${systemAppKey}`);
          }
        } else {
          // Create new configuration
          await TenantAppConfiguration.create({
            organizationId: org._id,
            appKey: systemAppKey,
            enabled: true,
            settings: {
              labelOverrides: null,
              featureToggles: null
            }
          });
          appsCreated++;
          console.log(`  ✅ Created app: ${systemAppKey}`);
        }

        // Get modules for this app
        const appModules = moduleMapByApp.get(platformAppKey) || [];

        // Create or update TenantModuleConfiguration for each module
        for (const platformModule of appModules) {
          const existingModuleConfig = await TenantModuleConfiguration.findOne({
            organizationId: org._id,
            appKey: systemAppKey,
            moduleKey: platformModule.moduleKey
          });

          if (existingModuleConfig) {
            // Update if disabled
            if (!existingModuleConfig.enabled) {
              existingModuleConfig.enabled = true;
              await existingModuleConfig.save();
              modulesUpdated++;
            }
            // People (sales app): ensure peopleTypes includes SALES + HELPDESK defaults when missing
            if (platformModule.moduleKey === 'people' && platformAppKey === 'sales') {
              let ptChanged = false;
              if (!existingModuleConfig.settings) existingModuleConfig.settings = {};
              if (!existingModuleConfig.settings.peopleTypes) {
                existingModuleConfig.settings.peopleTypes = {};
              }
              const pt = existingModuleConfig.settings.peopleTypes;
              if (!Array.isArray(pt.SALES) || pt.SALES.length === 0) {
                pt.SALES = ['Lead', 'Contact'];
                ptChanged = true;
              }
              if (!Array.isArray(pt.HELPDESK) || pt.HELPDESK.length === 0) {
                pt.HELPDESK = ['Customer', 'Agent'];
                ptChanged = true;
              }
              if (ptChanged) {
                existingModuleConfig.markModified('settings');
                await existingModuleConfig.save();
                modulesUpdated++;
              }
            }
          } else {
            // Create new configuration
            const baseConfig = {
              organizationId: org._id,
              appKey: systemAppKey,
              moduleKey: platformModule.moduleKey,
              enabled: true,
              labelOverride: null,
              peopleMode: null, // Inherit from platform
              requiredRelationships: [],
              ui: {
                showInSidebar: true,
                order: null // Use platform default order
              }
            };
            // People module (platform sales app): default peopleTypes per app key
            if (platformModule.moduleKey === 'people' && platformAppKey === 'sales') {
              baseConfig.settings = {
                peopleTypes: {
                  SALES: ['Lead', 'Contact'],
                  HELPDESK: ['Customer', 'Agent']
                }
              };
            }
            await TenantModuleConfiguration.create(baseConfig);
            modulesCreated++;
          }
        }

        if (appModules.length > 0) {
          console.log(`  ✅ Configured ${appModules.length} modules for ${systemAppKey}`);
        }
      }

      tenantsProcessed++;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Tenant defaults seeded successfully!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - Tenants processed: ${tenantsProcessed}`);
    console.log(`   - Apps created: ${appsCreated}`);
    console.log(`   - Apps updated: ${appsUpdated}`);
    console.log(`   - Modules created: ${modulesCreated}`);
    console.log(`   - Modules updated: ${modulesUpdated}`);
    console.log('='.repeat(60) + '\n');

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding tenant defaults:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedTenantDefaults();
}

module.exports = seedTenantDefaults;


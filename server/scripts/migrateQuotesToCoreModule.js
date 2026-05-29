#!/usr/bin/env node

/**
 * Promote Quotes from Sales app module to platform core module.
 *
 * - Upserts platform.quotes (copies fields from sales.quotes when present)
 * - Removes sales.quotes platform-level definition
 *
 * Usage: node server/scripts/migrateQuotesToCoreModule.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');
const {
  INITIAL_QUOTE_QUICK_CREATE,
  applyQuoteModuleFieldDefaults
} = require('../constants/quoteModuleDefaults');
const {
  cloneQuoteDefaultRelationships,
  ensureQuoteRelationshipDefinitions
} = require('../constants/defaultQuoteRelationships');

const QUOTES_UI = {
  routeBase: '/quotes',
  icon: '🧾',
  showInSidebar: true,
  sidebarOrder: 8,
  createLabel: 'Create Quote',
  listLabel: 'All Quotes',
  navigationEntity: true,
  excludeFromApps: true
};

async function migrateQuotesToCoreModule() {
  try {
    console.log('🚀 Migrating Quotes to platform core module...\n');

    const masterUri = getMasterDatabaseUri();
    await mongoose.connect(masterUri);
    console.log('✅ Connected to master database\n');

    await ensureQuoteRelationshipDefinitions();
    console.log('  ✅ Ensured platform quote relationship definitions\n');

    const salesQuotes = await ModuleDefinition.findOne({
      appKey: 'sales',
      moduleKey: 'quotes',
      organizationId: null
    }).lean();

    let platformQuotes = await ModuleDefinition.findOne({
      appKey: 'platform',
      moduleKey: 'quotes',
      organizationId: null
    });

    const basePayload = {
      appKey: 'platform',
      moduleKey: 'quotes',
      organizationId: null,
      label: 'Quote',
      pluralLabel: 'Quotes',
      entityType: 'TRANSACTION',
      primaryField: 'quoteTitle',
      type: 'system',
      enabled: true,
      ui: QUOTES_UI
    };

    if (platformQuotes) {
      const update = {
        ...basePayload,
        ui: { ...(platformQuotes.ui || {}), ...QUOTES_UI }
      };
      if (!Array.isArray(platformQuotes.quickCreate) || platformQuotes.quickCreate.length === 0) {
        update.quickCreate = [...INITIAL_QUOTE_QUICK_CREATE];
        update.quickCreateLayout = { version: 1, rows: [] };
        const fieldsForDefaults = update.fields || platformQuotes.fields;
        if (Array.isArray(fieldsForDefaults) && fieldsForDefaults.length) {
          update.fields = applyQuoteModuleFieldDefaults(fieldsForDefaults);
        }
      }
      if (!Array.isArray(platformQuotes.relationships) || platformQuotes.relationships.length === 0) {
        update.relationships = cloneQuoteDefaultRelationships();
      }
      if (salesQuotes) {
        if (Array.isArray(salesQuotes.fields) && salesQuotes.fields.length) {
          update.fields = salesQuotes.fields;
        }
        if (Array.isArray(salesQuotes.relationships) && salesQuotes.relationships.length) {
          update.relationships = salesQuotes.relationships;
        }
        if (Array.isArray(salesQuotes.quickCreate) && salesQuotes.quickCreate.length) {
          update.quickCreate = salesQuotes.quickCreate;
        }
        if (salesQuotes.quickCreateLayout) {
          update.quickCreateLayout = salesQuotes.quickCreateLayout;
        }
      }
      await ModuleDefinition.updateOne({ _id: platformQuotes._id }, { $set: update });
      console.log('  ✅ Updated platform.quotes');
    } else {
      const createPayload = {
        ...basePayload,
        quickCreate: [...INITIAL_QUOTE_QUICK_CREATE],
        quickCreateLayout: { version: 1, rows: [] },
        relationships: cloneQuoteDefaultRelationships()
      };
      if (salesQuotes) {
        createPayload.fields = salesQuotes.fields || [];
        createPayload.relationships = salesQuotes.relationships || [];
        createPayload.quickCreate = salesQuotes.quickCreate || [];
        createPayload.quickCreateLayout = salesQuotes.quickCreateLayout || { version: 1, rows: [] };
        if (salesQuotes.label) createPayload.label = salesQuotes.label;
        if (salesQuotes.pluralLabel) createPayload.pluralLabel = salesQuotes.pluralLabel;
      }
      await ModuleDefinition.create(createPayload);
      console.log('  ✅ Created platform.quotes');
    }

    const deleteResult = await ModuleDefinition.deleteMany({
      appKey: 'sales',
      moduleKey: 'quotes',
      organizationId: null
    });
    if (deleteResult.deletedCount > 0) {
      console.log(`  ✅ Removed sales.quotes (${deleteResult.deletedCount} doc(s))`);
    } else {
      console.log('  ℹ️  No sales.quotes platform definition to remove');
    }

    const verify = await ModuleDefinition.findOne({
      appKey: 'platform',
      moduleKey: 'quotes',
      organizationId: null
    }).lean();
    const ok =
      verify &&
      verify.ui?.navigationEntity === true &&
      verify.ui?.excludeFromApps === true;
    console.log(`\n${ok ? '✅' : '⚠️ '} Verification: platform.quotes navigationEntity=${verify?.ui?.navigationEntity}, excludeFromApps=${verify?.ui?.excludeFromApps}`);

    console.log('\n💡 Refresh the browser; Quotes should appear under Core Modules, not Sales app nav.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

migrateQuotesToCoreModule();

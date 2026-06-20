#!/usr/bin/env node

/**
 * Register Documents as a platform core module.
 *
 * Usage: node server/scripts/migrateDocumentsToCoreModule.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

const {
  INITIAL_DOCUMENT_QUICK_CREATE,
  INITIAL_DOCUMENT_FIELDS,
  cloneDocumentDefaultRelationships,
  applyDocumentModuleFieldDefaults
} = require('../constants/documentModuleDefaults');

const DOCUMENTS_UI = {
  routeBase: '/documents',
  icon: 'document-duplicate',
  showInSidebar: true,
  sidebarOrder: 9,
  createLabel: 'New Document',
  listLabel: 'Documents',
  navigationEntity: true,
  excludeFromApps: true
};

const DOCUMENTS_MODULE = {
  appKey: 'platform',
  moduleKey: 'documents',
  label: 'Document',
  pluralLabel: 'Documents',
  entityType: 'CORE',
  primaryField: 'title',
  type: 'system',
  enabled: true,
  peopleConstraints: {
    allowedTypes: ['Contact'],
    required: false
  },
  organizationConstraints: {
    required: false
  },
  lifecycle: {
    statusField: 'status',
    allowedStatuses: ['draft', 'pending_review', 'approved', 'published', 'archived']
  },
  supports: {
    ownership: true,
    assignment: false,
    comments: true,
    attachments: true,
    automation: true
  },
  permissions: {
    create: true,
    edit: true,
    delete: true,
    view: true
  },
  fields: applyDocumentModuleFieldDefaults(INITIAL_DOCUMENT_FIELDS),
  relationships: cloneDocumentDefaultRelationships(),
  quickCreate: [...INITIAL_DOCUMENT_QUICK_CREATE],
  quickCreateLayout: { version: 1, rows: [] },
  ui: DOCUMENTS_UI
};

async function migrateDocumentsToCoreModule() {
  try {
    console.log('🚀 Registering Documents platform core module...\n');

    const masterUri = getMasterDatabaseUri();
    await mongoose.connect(masterUri);
    console.log('✅ Connected to master database\n');

    const existing = await ModuleDefinition.findOne({
      appKey: 'platform',
      moduleKey: 'documents'
    });

    if (existing) {
      await ModuleDefinition.updateOne(
        { _id: existing._id },
        {
          $set: {
            ...DOCUMENTS_MODULE,
            ui: { ...(existing.ui || {}), ...DOCUMENTS_UI },
            fields: Array.isArray(existing.fields) && existing.fields.length
              ? existing.fields
              : applyDocumentModuleFieldDefaults(INITIAL_DOCUMENT_FIELDS),
            relationships: Array.isArray(existing.relationships) && existing.relationships.length
              ? existing.relationships
              : cloneDocumentDefaultRelationships(),
            quickCreate: Array.isArray(existing.quickCreate) && existing.quickCreate.length
              ? existing.quickCreate
              : [...INITIAL_DOCUMENT_QUICK_CREATE],
            quickCreateLayout: existing.quickCreateLayout || { version: 1, rows: [] }
          },
          $unset: { organizationId: '', key: '' }
        }
      );
      console.log('  ✅ Updated platform.documents');
    } else {
      await ModuleDefinition.create(DOCUMENTS_MODULE);
      console.log('  ✅ Created platform.documents');
    }

    const verify = await ModuleDefinition.findOne({
      appKey: 'platform',
      moduleKey: 'documents',
      organizationId: null
    }).lean();

    const ok = verify?.ui?.navigationEntity === true && verify?.ui?.excludeFromApps === true;
    console.log(
      `\n${ok ? '✅' : '⚠️ '} Verification: platform.documents navigationEntity=${verify?.ui?.navigationEntity}, excludeFromApps=${verify?.ui?.excludeFromApps}`
    );
    console.log('\n💡 Refresh the browser; Documents should appear under Core Modules.\n');

    const { registerDefaultDocumentRelationships } = require('../services/documentRelationshipInitializer');
    await registerDefaultDocumentRelationships();
    const relationshipRegistry = require('../utils/relationshipRegistry');
    await relationshipRegistry.refreshRelationshipKeyCache();
    console.log('✅ Document attachment relationship definitions registered');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

migrateDocumentsToCoreModule();

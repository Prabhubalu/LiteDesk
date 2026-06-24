#!/usr/bin/env node

/**
 * Seed Responses Module Definition (Platform-owned execution domain).
 *
 * Usage: node server/scripts/seedResponsesModule.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;

const RESPONSES_MODULE_DEFINITION = {
  moduleKey: 'responses',
  appKey: 'platform',
  label: 'Response',
  pluralLabel: 'Responses',
  entityType: 'TRANSACTION',
  primaryField: 'responseId',
  peopleConstraints: {
    allowedTypes: [],
    required: false
  },
  organizationConstraints: {
    required: false
  },
  lifecycle: {
    statusField: 'executionStatus',
    allowedStatuses: ['Not Started', 'In Progress', 'Submitted'],
    executionDriven: true,
    immutableAfter: 'executionStatus:Submitted'
  },
  supports: {
    ownership: false,
    assignment: false,
    comments: true,
    attachments: true,
    automation: false,
    correctiveActions: true,
    approvalFlow: true,
    auditReview: true,
    reporting: true
  },
  permissions: {
    create: true,
    edit: false,
    delete: false,
    view: true,
    execution: true,
    review: true,
    approve: true
  },
  ui: {
    routeBase: '/responses',
    icon: 'clipboard-document-list',
    showInSidebar: true,
    sidebarOrder: 7.5,
    createLabel: 'New Response',
    listLabel: 'All Responses',
    showAsTabUnder: ['forms'],
    navigationEntity: true,
    excludeFromApps: true
  }
};

async function seedResponsesModule() {
  try {
    console.log('🚀 Seeding Responses Module Definition (Platform)...\n');

    if (!MONGO_URI) {
      console.error('❌ Error: MONGODB_URI is not set in .env file!');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const existingModule = await ModuleDefinition.findOne({
      appKey: 'platform',
      moduleKey: 'responses'
    });

    if (existingModule) {
      await ModuleDefinition.updateOne(
        { appKey: 'platform', moduleKey: 'responses' },
        RESPONSES_MODULE_DEFINITION
      );
      console.log('✅ Updated Platform Responses module definition\n');
    } else {
      await ModuleDefinition.create(RESPONSES_MODULE_DEFINITION);
      console.log('✅ Created Platform Responses module definition\n');
    }

    // Remove legacy Sales/CRM registrations
    const removed = await ModuleDefinition.deleteMany({
      moduleKey: 'responses',
      appKey: { $in: ['sales', 'crm'] }
    });
    if (removed.deletedCount > 0) {
      console.log(`🗑️  Removed ${removed.deletedCount} legacy Sales/CRM responses module(s)\n`);
    }

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding Responses module:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

if (require.main === module) {
  seedResponsesModule();
}

module.exports = seedResponsesModule;

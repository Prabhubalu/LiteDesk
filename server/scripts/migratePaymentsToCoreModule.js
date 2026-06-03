#!/usr/bin/env node

/**
 * Register platform.payments core module (PAY0).
 *
 * Usage: node scripts/migratePaymentsToCoreModule.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');
const {
  INITIAL_PAYMENT_QUICK_CREATE,
  applyPaymentModuleFieldDefaults,
  INITIAL_PAYMENT_FIELDS
} = require('../constants/paymentModuleDefaults');
const { PAYMENT_STATUSES } = require('../constants/paymentLifecycle');

const { commercialModuleIconId } = require('../constants/commercialModuleIcons');

const PAYMENTS_UI = {
  routeBase: '/payments',
  icon: commercialModuleIconId('payments'),
  showInSidebar: true,
  sidebarOrder: 11,
  createLabel: 'Record Payment',
  listLabel: 'All Payments',
  navigationEntity: true,
  excludeFromApps: true
};

async function migratePaymentsToCoreModule() {
  console.log('🚀 Registering platform.payments module (PAY0)...\n');

  const masterUri = getMasterDatabaseUri();
  await mongoose.connect(masterUri);
  console.log('✅ Connected to master database\n');

  let platformModule = await ModuleDefinition.findOne({
    appKey: 'platform',
    moduleKey: 'payments'
  });

  const basePayload = {
    appKey: 'platform',
    moduleKey: 'payments',
    key: 'payments',
    name: 'Payments',
    label: 'Payment',
    pluralLabel: 'Payments',
    entityType: 'TRANSACTION',
    primaryField: 'paymentNumber',
    type: 'system',
    enabled: true,
    ui: PAYMENTS_UI,
    quickCreate: [...INITIAL_PAYMENT_QUICK_CREATE],
    quickCreateLayout: { version: 1, rows: [] },
    fields: applyPaymentModuleFieldDefaults(INITIAL_PAYMENT_FIELDS),
    relationships: [],
    lifecycle: {
      statusField: 'status',
      allowedStatuses: [...PAYMENT_STATUSES]
    },
    supports: {
      ownership: true,
      assignment: false,
      comments: true,
      attachments: true,
      activity: true,
      trash: false
    }
  };

  if (platformModule) {
    await ModuleDefinition.updateOne(
      { _id: platformModule._id },
      {
        $set: basePayload,
        $unset: { organizationId: '' }
      }
    );
    console.log('✅ Updated existing platform.payments module\n');
  } else {
    platformModule = await ModuleDefinition.create(basePayload);
    console.log('✅ Created platform.payments module\n');
  }

  console.log(`Module id: ${platformModule._id}`);
  await mongoose.disconnect();
  console.log('Done.');
}

migratePaymentsToCoreModule().catch((err) => {
  console.error(err);
  process.exit(1);
});

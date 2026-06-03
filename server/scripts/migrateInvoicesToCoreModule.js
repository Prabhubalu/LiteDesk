#!/usr/bin/env node

/**
 * Register platform.invoices core module (INV0).
 *
 * Usage: node scripts/migrateInvoicesToCoreModule.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');
const {
  INITIAL_INVOICE_QUICK_CREATE,
  applyInvoiceModuleFieldDefaults
} = require('../constants/invoiceModuleDefaults');
const { INVOICE_STATUSES } = require('../constants/invoiceLifecycle');

const INVOICES_UI = {
  routeBase: '/invoices',
  icon: '🧾',
  showInSidebar: true,
  sidebarOrder: 10,
  createLabel: 'Create Invoice',
  listLabel: 'All Invoices',
  navigationEntity: true,
  excludeFromApps: true
};

const INITIAL_INVOICE_FIELDS = [
  { key: 'invoiceTitle', label: 'Invoice Title', type: 'text', required: true },
  { key: 'invoiceNumber', label: 'Invoice Number', type: 'text', system: true },
  { key: 'status', label: 'Status', type: 'select', options: INVOICE_STATUSES },
  { key: 'invoiceType', label: 'Invoice Type', type: 'select', options: ['standard', 'credit_note', 'debit_note', 'proforma'] },
  { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
  { key: 'dueDate', label: 'Due Date', type: 'date' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'grandTotal', label: 'Grand Total', type: 'currency', system: true },
  { key: 'amountDue', label: 'Amount Due', type: 'currency', system: true },
  { key: 'contactId', label: 'Contact', type: 'lookup', lookupModule: 'people' },
  { key: 'organizationRefId', label: 'Account', type: 'lookup', lookupModule: 'organizations' },
  { key: 'dealId', label: 'Deal', type: 'lookup', lookupModule: 'deals' },
  { key: 'ownerId', label: 'Owner', type: 'lookup', lookupModule: 'users' },
  { key: 'sourceContext', label: 'Source Context', type: 'text', system: true }
];

async function migrateInvoicesToCoreModule() {
  console.log('🚀 Registering platform.invoices module (INV0)...\n');

  const masterUri = getMasterDatabaseUri();
  await mongoose.connect(masterUri);
  console.log('✅ Connected to master database\n');

  let platformModule = await ModuleDefinition.findOne({
    appKey: 'platform',
    moduleKey: 'invoices'
  });

  const basePayload = {
    appKey: 'platform',
    moduleKey: 'invoices',
    label: 'Invoice',
    pluralLabel: 'Invoices',
    entityType: 'TRANSACTION',
    primaryField: 'invoiceTitle',
    type: 'system',
    enabled: true,
    ui: INVOICES_UI,
    quickCreate: [...INITIAL_INVOICE_QUICK_CREATE],
    quickCreateLayout: { version: 1, rows: [] },
    fields: applyInvoiceModuleFieldDefaults(INITIAL_INVOICE_FIELDS),
    relationships: [],
    lifecycle: {
      statusField: 'status',
      allowedStatuses: [...INVOICE_STATUSES]
    },
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      activity: true,
      trash: true
    }
  };

  if (platformModule) {
    await ModuleDefinition.updateOne({ _id: platformModule._id }, { $set: basePayload });
    console.log('✅ Updated existing platform.invoices module\n');
  } else {
    platformModule = await ModuleDefinition.create(basePayload);
    console.log('✅ Created platform.invoices module\n');
  }

  console.log(`Module id: ${platformModule._id}`);
  await mongoose.disconnect();
  console.log('Done.');
}

migrateInvoicesToCoreModule().catch((err) => {
  console.error(err);
  process.exit(1);
});

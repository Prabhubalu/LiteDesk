#!/usr/bin/env node

/**
 * Register platform.sales_orders core module (SO0).
 *
 * Usage: node scripts/migrateSalesOrdersToCoreModule.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');
const {
  INITIAL_SALES_ORDER_QUICK_CREATE,
  applySalesOrderModuleFieldDefaults
} = require('../constants/salesOrderModuleDefaults');
const { SALES_ORDER_STATUSES } = require('../constants/salesOrderLifecycle');

const SALES_ORDERS_UI = {
  routeBase: '/sales-orders',
  icon: '📦',
  showInSidebar: true,
  sidebarOrder: 9,
  createLabel: 'Create Sales Order',
  listLabel: 'All Sales Orders',
  navigationEntity: true,
  excludeFromApps: true
};

const INITIAL_SALES_ORDER_FIELDS = [
  { key: 'orderTitle', label: 'Order Title', type: 'text', required: true },
  { key: 'salesOrderNumber', label: 'Order Number', type: 'text', system: true },
  { key: 'status', label: 'Status', type: 'select', options: SALES_ORDER_STATUSES },
  { key: 'fulfillmentMode', label: 'Fulfillment Mode', type: 'select', options: ['product', 'service', 'hybrid'] },
  { key: 'fulfillmentStatus', label: 'Fulfillment Status', type: 'text', system: true },
  { key: 'orderDate', label: 'Order Date', type: 'date' },
  { key: 'requestedDeliveryDate', label: 'Requested Delivery', type: 'date' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'grandTotal', label: 'Grand Total', type: 'currency', system: true },
  { key: 'contactId', label: 'Contact', type: 'lookup', lookupModule: 'people' },
  { key: 'organizationRefId', label: 'Account', type: 'lookup', lookupModule: 'organizations' },
  { key: 'dealId', label: 'Deal', type: 'lookup', lookupModule: 'deals' },
  { key: 'ownerId', label: 'Owner', type: 'lookup', lookupModule: 'users' },
  { key: 'sourceQuoteNumber', label: 'Source Quote', type: 'text', system: true }
];

async function migrateSalesOrdersToCoreModule() {
  console.log('🚀 Registering platform.sales_orders module (SO0)...\n');

  const masterUri = getMasterDatabaseUri();
  await mongoose.connect(masterUri);
  console.log('✅ Connected to master database\n');

  let platformModule = await ModuleDefinition.findOne({
    appKey: 'platform',
    moduleKey: 'sales_orders'
  });

  const basePayload = {
    appKey: 'platform',
    moduleKey: 'sales_orders',
    label: 'Sales Order',
    pluralLabel: 'Sales Orders',
    entityType: 'TRANSACTION',
    primaryField: 'orderTitle',
    type: 'system',
    enabled: true,
    ui: SALES_ORDERS_UI,
    quickCreate: [...INITIAL_SALES_ORDER_QUICK_CREATE],
    quickCreateLayout: { version: 1, rows: [] },
    fields: applySalesOrderModuleFieldDefaults(INITIAL_SALES_ORDER_FIELDS),
    relationships: [],
    lifecycle: {
      statusField: 'status',
      allowedStatuses: [...SALES_ORDER_STATUSES]
    },
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true
    }
  };

  if (platformModule) {
    await ModuleDefinition.updateOne(
      { _id: platformModule._id },
      {
        $set: {
          ...basePayload,
          ui: { ...(platformModule.ui || {}), ...SALES_ORDERS_UI }
        },
        $unset: { organizationId: '', key: '' }
      }
    );
    console.log('  ✅ Updated platform.sales_orders');
  } else {
    await ModuleDefinition.create(basePayload);
    console.log('  ✅ Created platform.sales_orders');
  }

  const verify = await ModuleDefinition.findOne({
    appKey: 'platform',
    moduleKey: 'sales_orders'
  }).lean();

  console.log(
    `\n${verify ? '✅' : '⚠️ '} Verification: moduleKey=${verify?.moduleKey}, entityType=${verify?.entityType}`
  );
  console.log('\n💡 SO0 models registered. SO1 will add API routes + UI.\n');

  await mongoose.connection.close();
  process.exit(0);
}

migrateSalesOrdersToCoreModule().catch(async (error) => {
  console.error('❌ Migration failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});

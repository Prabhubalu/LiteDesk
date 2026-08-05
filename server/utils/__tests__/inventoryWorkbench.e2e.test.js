/**
 * Inventory end-to-end coverage beyond ledger unit tests:
 * - ModuleDefinition bootstrap (ledger + workbench)
 * - Native RBAC / workbench permission fallback
 * - Procurement: PO → order → RN → verify (ledger receipt)
 * - Stock transfer continues to work under inventory-enabled tenant
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const ModuleDefinition = require('../../models/ModuleDefinition');
const ItemInventory = require('../../models/ItemInventory');
const InventoryLedgerEntry = require('../../models/InventoryLedgerEntry');
const Organization = require('../../models/Organization');
const { INVENTORY_WORKBENCH_KEYS } = require('../../constants/inventoryWorkbenchModules');
const {
  ensureInventoryAppModuleDefinitions
} = require('../../services/inventoryModuleBootstrapService');
const {
  buildOrgPermissionContext,
  passesOrgAuthorizationGuards,
  resolveRuntimePermission
} = require('../../services/runtimePermissionResolver');
const { isInventoryEnabledForOrg } = require('../../services/inventoryCapabilityService');
const { ensureMainWarehouse } = require('../../services/inventoryLocationService');
const {
  createPurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  markPurchaseOrderOrdered,
  createReceiptNote,
  verifyReceiptNote
} = require('../../services/procurementService');
const { createTransfer, postTransfer } = require('../../services/inventoryTransferService');
const {
  seedInventoryContext,
  createSecondaryLocation
} = require('./helpers/inventoryTestHelper');

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  // Populate targets used by procurement service getters
  require('../../models/People');
  require('../../models/User');
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

async function createVendorOrg(userId) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return Organization.create({
    name: `Vendor ${suffix}`,
    slug: `vendor-${suffix}`,
    isTenant: false,
    isActive: true,
    types: ['vendor'],
    participations: {
      INVENTORY: { role: 'vendor' }
    },
    assignedTo: userId,
    createdBy: userId
  });
}

test('bootstrap creates inventory ledger + all workbench ModuleDefinitions', async () => {
  const { results } = await ensureInventoryAppModuleDefinitions();
  assert.ok(results.length >= 1 + INVENTORY_WORKBENCH_KEYS.length);

  const defs = await ModuleDefinition.find({
    appKey: 'inventory',
    organizationId: null
  })
    .select('moduleKey ui.showInSidebar permissions fields')
    .lean();

  const keys = new Set(defs.map((d) => d.moduleKey));
  assert.ok(keys.has('inventory'));
  for (const key of INVENTORY_WORKBENCH_KEYS) {
    assert.ok(keys.has(key), `missing ModuleDefinition for ${key}`);
  }
  for (const d of defs) {
    assert.equal(d.ui?.showInSidebar, false, `${d.moduleKey} should hide MD sidebar (client owns nav)`);
  }

  // Field catalogs must be non-empty (Settings + create drawers)
  const ledger = defs.find((d) => d.moduleKey === 'inventory');
  assert.ok(Array.isArray(ledger?.fields) && ledger.fields.length > 0, 'ledger fields seeded');
  for (const key of INVENTORY_WORKBENCH_KEYS) {
    const def = defs.find((d) => d.moduleKey === key);
    assert.ok(
      Array.isArray(def?.fields) && def.fields.length > 0,
      `workbench fields seeded for ${key}`
    );
  }

  // Idempotent
  const second = await ensureInventoryAppModuleDefinitions();
  assert.equal(second.results.filter((r) => r.created).length, 0);
});

test('bootstrap backfills empty workbench fields on re-run', async () => {
  await ensureInventoryAppModuleDefinitions();
  await ModuleDefinition.updateOne(
    { appKey: 'inventory', moduleKey: 'purchase_orders', organizationId: null },
    { $set: { fields: [] } }
  );
  const afterEmpty = await ModuleDefinition.findOne({
    appKey: 'inventory',
    moduleKey: 'purchase_orders',
    organizationId: null
  })
    .select('fields')
    .lean();
  assert.equal(Array.isArray(afterEmpty?.fields) ? afterEmpty.fields.length : -1, 0);

  const { results } = await ensureInventoryAppModuleDefinitions();
  const poResult = results.find((r) => r.moduleKey === 'purchase_orders');
  assert.equal(poResult?.fieldsSeeded, true);

  const po = await ModuleDefinition.findOne({
    appKey: 'inventory',
    moduleKey: 'purchase_orders',
    organizationId: null
  })
    .select('fields')
    .lean();
  assert.ok(Array.isArray(po?.fields) && po.fields.length > 0, 'PO fields backfilled');
  assert.ok(
    po.fields.some((f) => String(f.key || '').toLowerCase() === 'subject'),
    'PO fields include subject'
  );
});

test('capability + org guards: workbench modules require INVENTORY app', async () => {
  const invOrg = {
    enabledApps: [{ appKey: 'INVENTORY', status: 'ACTIVE' }]
  };
  const salesOrg = {
    enabledApps: [{ appKey: 'SALES', status: 'ACTIVE' }]
  };

  assert.equal(isInventoryEnabledForOrg(invOrg), true);
  assert.equal(isInventoryEnabledForOrg(salesOrg), false);

  const invCtx = buildOrgPermissionContext(invOrg);
  const salesCtx = buildOrgPermissionContext(salesOrg);

  for (const key of ['inventory', 'purchase_orders', 'stockrooms', 'delivery_notes']) {
    assert.equal(
      passesOrgAuthorizationGuards(invCtx, key, 'INVENTORY'),
      true,
      `${key} should pass with INVENTORY`
    );
    assert.equal(
      passesOrgAuthorizationGuards(salesCtx, key, 'INVENTORY'),
      false,
      `${key} should fail without INVENTORY`
    );
  }
});

test('workbench view/create resolve via inventory.* envelope fallback', async () => {
  const orgContext = buildOrgPermissionContext({
    enabledApps: [{ appKey: 'INVENTORY', status: 'ACTIVE' }]
  });
  const user = {
    permissions: {
      inventory: { view: true, create: true, edit: true, delete: false }
    },
    _orgPermissionContext: orgContext
  };

  assert.equal(
    resolveRuntimePermission(user, 'purchase_orders', 'view', {
      appKey: 'INVENTORY',
      orgContext
    }),
    true
  );
  assert.equal(
    resolveRuntimePermission(user, 'receipt_notes', 'create', {
      appKey: 'INVENTORY',
      orgContext
    }),
    true
  );
  assert.equal(
    resolveRuntimePermission(
      { permissions: {}, _orgPermissionContext: orgContext },
      'purchase_orders',
      'view',
      { appKey: 'INVENTORY', orgContext }
    ),
    false
  );

  // Dedicated module grant without inventory envelope
  const fineUser = {
    permissions: {
      purchase_orders: { view: true, create: false }
    },
    _orgPermissionContext: orgContext
  };
  assert.equal(
    resolveRuntimePermission(fineUser, 'purchase_orders', 'view', {
      appKey: 'INVENTORY',
      orgContext
    }),
    true
  );
  assert.equal(
    resolveRuntimePermission(fineUser, 'purchase_orders', 'create', {
      appKey: 'INVENTORY',
      orgContext
    }),
    false
  );
});

test('E2E procurement: PO submit → approve → ordered → RN verify posts receipt', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const vendor = await createVendorOrg(userId);
  const location = await ensureMainWarehouse(tenant._id);

  const { purchaseOrder, lines } = await createPurchaseOrder({
    organizationId: tenant._id,
    userId,
    payload: {
      vendorId: vendor._id,
      subject: 'E2E PO',
      deliveryWarehouseId: location._id,
      lines: [{ variantId: variant._id, quantityOrdered: 8, unitPrice: 12 }]
    }
  });
  assert.ok(purchaseOrder._id);
  assert.equal(lines.length, 1);
  assert.equal(Number(lines[0].quantityOrdered), 8);

  await submitPurchaseOrder({
    organizationId: tenant._id,
    id: purchaseOrder._id,
    userId
  });
  await approvePurchaseOrder({
    organizationId: tenant._id,
    id: purchaseOrder._id,
    userId
  });
  await markPurchaseOrderOrdered({
    organizationId: tenant._id,
    id: purchaseOrder._id,
    userId
  });

  const { receiptNote, lines: rnLines } = await createReceiptNote({
    organizationId: tenant._id,
    userId,
    payload: {
      purchaseOrderId: purchaseOrder._id,
      receiptLocationId: location._id
    }
  });
  assert.equal(rnLines.length, 1);
  assert.equal(Number(rnLines[0].quantityAccepted), 8);

  await verifyReceiptNote({
    organizationId: tenant._id,
    id: receiptNote._id,
    userId
  });

  const onHand = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  }).lean();
  assert.equal(Number(onHand?.onHand), 8);

  const receipts = await InventoryLedgerEntry.countDocuments({
    organizationId: tenant._id,
    entryType: 'receipt',
    status: 'posted',
    'sourceRef.moduleKey': 'receipt_notes'
  });
  assert.ok(receipts >= 1);
});

test('E2E stock transfer after receipt moves on-hand between locations', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const main = await ensureMainWarehouse(tenant._id);
  const secondary = await createSecondaryLocation({
    organizationId: tenant._id,
    userId,
    locationCode: 'E2E-SEC',
    name: 'E2E Secondary'
  });

  // Seed stock via transfer requires stock first — use secondary after move from receipt path
  const vendor = await createVendorOrg(userId);
  const { purchaseOrder } = await createPurchaseOrder({
    organizationId: tenant._id,
    userId,
    payload: {
      vendorId: vendor._id,
      subject: 'E2E Transfer PO',
      deliveryWarehouseId: main._id,
      lines: [{ variantId: variant._id, quantityOrdered: 5, unitPrice: 1 }]
    }
  });
  await submitPurchaseOrder({ organizationId: tenant._id, id: purchaseOrder._id, userId });
  await approvePurchaseOrder({ organizationId: tenant._id, id: purchaseOrder._id, userId });
  await markPurchaseOrderOrdered({ organizationId: tenant._id, id: purchaseOrder._id, userId });
  const { receiptNote } = await createReceiptNote({
    organizationId: tenant._id,
    userId,
    payload: {
      purchaseOrderId: purchaseOrder._id,
      receiptLocationId: main._id
    }
  });
  await verifyReceiptNote({
    organizationId: tenant._id,
    id: receiptNote._id,
    userId
  });

  const transfer = await createTransfer({
    organizationId: tenant._id,
    userId,
    fromLocationId: main.inventoryLocationId,
    toLocationId: secondary.inventoryLocationId,
    lines: [{ variantId: variant._id, quantity: 2 }]
  });
  await postTransfer({
    organizationId: tenant._id,
    inventoryTransferId: transfer.inventoryTransferId,
    userId
  });

  const mainBal = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: main.inventoryLocationId
  }).lean();
  const secBal = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: secondary.inventoryLocationId
  }).lean();
  assert.equal(Number(mainBal?.onHand), 3);
  assert.equal(Number(secBal?.onHand), 2);
});

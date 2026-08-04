/**
 * Ensure platform ModuleDefinitions exist for Inventory app modules
 * (ledger + commercial/ops workbench). Safe to call repeatedly.
 *
 * App-owned modules (appKey: inventory). People/items remain platform core
 * and are not created here.
 */

const ModuleDefinition = require('../models/ModuleDefinition');
const {
  INVENTORY_WORKBENCH_MODULES,
  INVENTORY_WORKBENCH_KEYS
} = require('../constants/inventoryWorkbenchModules');
const {
  INITIAL_INVENTORY_FIELDS,
  INITIAL_INVENTORY_QUICK_CREATE,
  applyInventoryModuleFieldDefaults
} = require('../constants/inventoryModuleDefaults');
const {
  INITIAL_PURCHASE_ORDER_QUICK_CREATE
} = require('../constants/purchaseOrderModuleDefaults');
const {
  INITIAL_RECEIPT_NOTE_QUICK_CREATE
} = require('../constants/receiptNoteModuleDefaults');
const {
  INITIAL_PURCHASE_RETURN_QUICK_CREATE
} = require('../constants/purchaseReturnModuleDefaults');
const {
  INITIAL_DELIVERY_NOTE_QUICK_CREATE
} = require('../constants/deliveryNoteModuleDefaults');
const {
  INITIAL_DELIVERY_RETURN_QUICK_CREATE
} = require('../constants/deliveryReturnModuleDefaults');
const {
  INITIAL_SALES_RETURN_QUICK_CREATE
} = require('../constants/salesReturnModuleDefaults');
const {
  INITIAL_STOCKROOM_QUICK_CREATE
} = require('../constants/stockroomModuleDefaults');
const {
  INITIAL_STOCK_ADJUSTMENT_QUICK_CREATE
} = require('../constants/stockAdjustmentModuleDefaults');
const {
  INITIAL_STOCK_TRANSFER_QUICK_CREATE
} = require('../constants/stockTransferModuleDefaults');

/** UI + defaults for each workbench module (sidebar owned by client workbench nav). */
const WORKBENCH_BOOTSTRAP = {
  purchase_orders: {
    label: 'Purchase Order',
    pluralLabel: 'Purchase Orders',
    primaryField: 'subject',
    routeBase: '/inventory/purchase-orders',
    icon: 'document-text',
    sidebarOrder: 10,
    quickCreate: INITIAL_PURCHASE_ORDER_QUICK_CREATE,
    createLabel: 'Create Purchase Order',
    listLabel: 'All Purchase Orders',
    supports: { ownership: true, assignment: true, comments: true, attachments: true, activity: true, trash: false }
  },
  receipt_notes: {
    label: 'Receipt Note',
    pluralLabel: 'Receipt Notes',
    primaryField: 'receiptNoteNumber',
    routeBase: '/inventory/receipt-notes',
    icon: 'inbox-arrow-down',
    sidebarOrder: 20,
    quickCreate: INITIAL_RECEIPT_NOTE_QUICK_CREATE,
    createLabel: 'Create Receipt Note',
    listLabel: 'All Receipt Notes',
    supports: { ownership: false, assignment: false, comments: true, attachments: true, activity: true, trash: false }
  },
  purchase_returns: {
    label: 'Purchase Return',
    pluralLabel: 'Purchase Returns',
    primaryField: 'subject',
    routeBase: '/inventory/purchase-returns',
    icon: 'arrow-uturn-left',
    sidebarOrder: 30,
    quickCreate: INITIAL_PURCHASE_RETURN_QUICK_CREATE,
    createLabel: 'Create Purchase Return',
    listLabel: 'All Purchase Returns',
    supports: { ownership: true, assignment: true, comments: true, attachments: true, activity: true, trash: false }
  },
  delivery_notes: {
    label: 'Delivery Note',
    pluralLabel: 'Delivery Notes',
    primaryField: 'subject',
    routeBase: '/inventory/delivery-notes',
    icon: 'truck',
    sidebarOrder: 40,
    quickCreate: INITIAL_DELIVERY_NOTE_QUICK_CREATE,
    createLabel: 'Create Delivery Note',
    listLabel: 'All Delivery Notes',
    supports: { ownership: true, assignment: true, comments: true, attachments: true, activity: true, trash: false }
  },
  delivery_returns: {
    label: 'Delivery Return',
    pluralLabel: 'Delivery Returns',
    primaryField: 'subject',
    routeBase: '/inventory/delivery-returns',
    icon: 'arrow-uturn-right',
    sidebarOrder: 50,
    quickCreate: INITIAL_DELIVERY_RETURN_QUICK_CREATE,
    createLabel: 'Create Delivery Return',
    listLabel: 'All Delivery Returns',
    supports: { ownership: true, assignment: true, comments: true, attachments: true, activity: true, trash: false }
  },
  sales_returns: {
    label: 'Sales Return',
    pluralLabel: 'Sales Returns',
    primaryField: 'salesReturnNumber',
    routeBase: '/inventory/sales-returns',
    icon: 'receipt-refund',
    sidebarOrder: 60,
    quickCreate: INITIAL_SALES_RETURN_QUICK_CREATE,
    createLabel: 'Create Sales Return',
    listLabel: 'All Sales Returns',
    supports: { ownership: false, assignment: false, comments: true, attachments: true, activity: true, trash: false }
  },
  stockrooms: {
    label: 'Stockroom',
    pluralLabel: 'Stockrooms',
    primaryField: 'name',
    routeBase: '/inventory/stockrooms',
    icon: 'building-storefront',
    sidebarOrder: 70,
    quickCreate: INITIAL_STOCKROOM_QUICK_CREATE,
    createLabel: 'Create Stockroom',
    listLabel: 'All Stockrooms',
    supports: { ownership: false, assignment: false, comments: false, attachments: false, activity: true, trash: false }
  },
  stock_adjustments: {
    label: 'Stock Adjustment',
    pluralLabel: 'Stock Adjustments',
    primaryField: 'inventoryAdjustmentId',
    routeBase: '/inventory/adjustments',
    icon: 'adjustments-horizontal',
    sidebarOrder: 80,
    quickCreate: INITIAL_STOCK_ADJUSTMENT_QUICK_CREATE,
    createLabel: 'Create Stock Adjustment',
    listLabel: 'All Stock Adjustments',
    supports: { ownership: false, assignment: false, comments: true, attachments: false, activity: true, trash: false }
  },
  stock_transfers: {
    label: 'Stock Transfer',
    pluralLabel: 'Stock Transfers',
    primaryField: 'inventoryTransferId',
    routeBase: '/inventory/transfers',
    icon: 'arrows-right-left',
    sidebarOrder: 90,
    quickCreate: INITIAL_STOCK_TRANSFER_QUICK_CREATE,
    createLabel: 'Create Stock Transfer',
    listLabel: 'All Stock Transfers',
    supports: { ownership: false, assignment: false, comments: true, attachments: false, activity: true, trash: false }
  }
};

const LEDGER_UI = {
  routeBase: '/inventory',
  icon: 'cube',
  showInSidebar: false,
  sidebarOrder: 1,
  createLabel: 'Stock Operations',
  listLabel: 'Inventory',
  navigationEntity: false,
  excludeFromApps: false
};

function workbenchUi(meta) {
  return {
    routeBase: meta.routeBase,
    icon: meta.icon,
    // Client inventoryWorkbenchNav owns app sidebar links; keep MD out of duplicate nav.
    showInSidebar: false,
    sidebarOrder: meta.sidebarOrder,
    createLabel: meta.createLabel,
    listLabel: meta.listLabel,
    navigationEntity: false,
    excludeFromApps: false
  };
}

function defaultPermissions({ deleteAllowed = false } = {}) {
  return {
    create: true,
    edit: true,
    delete: deleteAllowed,
    view: true
  };
}

async function ensureLedgerModuleDefinition() {
  const payload = {
    appKey: 'inventory',
    moduleKey: 'inventory',
    key: 'inventory',
    name: 'Inventory',
    label: 'Inventory',
    pluralLabel: 'Inventory',
    entityType: 'TRANSACTION',
    primaryField: 'locationCode',
    type: 'system',
    enabled: true,
    ui: LEDGER_UI,
    quickCreate: [...INITIAL_INVENTORY_QUICK_CREATE],
    quickCreateLayout: { version: 1, rows: [] },
    fields: applyInventoryModuleFieldDefaults(INITIAL_INVENTORY_FIELDS),
    relationships: [],
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['active', 'inactive']
    },
    supports: {
      ownership: false,
      assignment: false,
      comments: false,
      attachments: false,
      activity: true,
      trash: false
    },
    permissions: defaultPermissions({ deleteAllowed: false })
  };

  const existing = await ModuleDefinition.findOne({
    appKey: 'inventory',
    moduleKey: 'inventory',
    organizationId: null
  })
    .select('_id quickCreate ui')
    .lean();

  if (existing) {
    const patch = {};
    if (!Array.isArray(existing.quickCreate) || existing.quickCreate.length === 0) {
      patch.quickCreate = payload.quickCreate;
      patch.quickCreateLayout = payload.quickCreateLayout;
    }
    if (existing.ui?.showInSidebar !== false) {
      patch['ui.showInSidebar'] = false;
    }
    if (Object.keys(patch).length) {
      await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
    }
    return { created: false, updated: Object.keys(patch).length > 0, moduleKey: 'inventory' };
  }

  // Legacy: moved from platform.inventory
  const platformLegacy = await ModuleDefinition.findOne({
    appKey: 'platform',
    moduleKey: 'inventory',
    organizationId: null
  }).select('_id').lean();

  if (platformLegacy) {
    await ModuleDefinition.updateOne({ _id: platformLegacy._id }, { $set: payload });
    return { created: false, updated: true, moduleKey: 'inventory', moved: true };
  }

  await ModuleDefinition.create(payload);
  return { created: true, updated: false, moduleKey: 'inventory' };
}

async function ensureWorkbenchModuleDefinition(moduleKey) {
  const meta = WORKBENCH_BOOTSTRAP[moduleKey];
  if (!meta) return null;

  const existing = await ModuleDefinition.findOne({
    appKey: 'inventory',
    moduleKey,
    organizationId: null
  })
    .select('_id quickCreate ui permissions')
    .lean();

  const base = {
    appKey: 'inventory',
    moduleKey,
    key: moduleKey,
    name: meta.pluralLabel,
    label: meta.label,
    pluralLabel: meta.pluralLabel,
    entityType: 'TRANSACTION',
    primaryField: meta.primaryField,
    type: 'system',
    enabled: true,
    ui: workbenchUi(meta),
    quickCreate: Array.isArray(meta.quickCreate) ? [...meta.quickCreate] : [],
    quickCreateLayout: { version: 1, rows: [] },
    fields: [],
    relationships: [],
    supports: { ...meta.supports },
    permissions: defaultPermissions({ deleteAllowed: false })
  };

  if (existing) {
    const patch = {};
    if (!Array.isArray(existing.quickCreate) || existing.quickCreate.length === 0) {
      if (base.quickCreate.length) {
        patch.quickCreate = base.quickCreate;
        patch.quickCreateLayout = base.quickCreateLayout;
      }
    }
    if (!existing.ui?.routeBase) {
      patch.ui = base.ui;
    } else if (existing.ui?.showInSidebar === true) {
      // Prefer client workbench nav; avoid duplicate sidebar entries.
      patch['ui.showInSidebar'] = false;
    }
    if (!existing.permissions) {
      patch.permissions = base.permissions;
    }
    if (Object.keys(patch).length) {
      await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
    }
    return { created: false, updated: Object.keys(patch).length > 0, moduleKey };
  }

  await ModuleDefinition.create(base);
  return { created: true, updated: false, moduleKey };
}

/**
 * Ensure inventory.inventory + all workbench ModuleDefinitions exist at platform scope.
 * @returns {Promise<{ results: object[] }>}
 */
async function ensureInventoryAppModuleDefinitions() {
  const results = [];
  results.push(await ensureLedgerModuleDefinition());
  for (const key of INVENTORY_WORKBENCH_KEYS) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await ensureWorkbenchModuleDefinition(key));
  }
  return { results: results.filter(Boolean) };
}

module.exports = {
  ensureInventoryAppModuleDefinitions,
  WORKBENCH_BOOTSTRAP,
  INVENTORY_WORKBENCH_MODULES
};

'use strict';

/**
 * ATIP (Arivu Tally Integration Platform) shared constants.
 * Decisions: 1B fully-dynamic metadata; 2C configurable inbound voucher create.
 */

const ATIP_HEALTH_STATES = Object.freeze([
  'searching',
  'found',
  'metadata_pending',
  'ready',
  'degraded',
  'offline',
]);

const INBOUND_CREATE_POLICIES = Object.freeze([
  'draft',
  'posted_if_valid',
  'review_only',
]);

const SUPPORT_TIERS = Object.freeze([
  'supported',
  'reference_only',
  'discover_only',
  'unsupported',
]);

const ATIP_ENGINE_KEYS = Object.freeze([
  'connection',
  'metadata',
  'schema',
  'mapping',
  'validation',
  'transformation',
  'synchronisation',
  'changeDetection',
  'conflict',
  'audit',
  'monitoring',
  'errorIntelligence',
  'aiMapping',
]);

/** Arivu-side capability registry (1B: Tally side is dynamic; Arivu targets are product modules). */
const ARIVU_CAPABILITY_REGISTRY = Object.freeze([
  {
    entityType: 'party',
    moduleKey: 'organizations',
    label: 'Organizations',
    tallyObjectHints: ['ledger'],
    syncDefault: 'bidirectional',
  },
  {
    entityType: 'person',
    moduleKey: 'people',
    label: 'People',
    tallyObjectHints: ['ledger'],
    syncDefault: 'bidirectional',
  },
  {
    entityType: 'item',
    moduleKey: 'items',
    label: 'Items',
    tallyObjectHints: ['stock_item'],
    syncDefault: 'bidirectional',
  },
  {
    entityType: 'catalog_category',
    moduleKey: 'catalog_categories',
    label: 'Catalog categories',
    tallyObjectHints: ['stock_group', 'stock_category'],
    syncDefault: 'bidirectional',
  },
  {
    entityType: 'inventory_location',
    moduleKey: 'inventory_locations',
    label: 'Inventory locations',
    tallyObjectHints: ['godown'],
    syncDefault: 'bidirectional',
  },
  {
    entityType: 'invoice',
    moduleKey: 'invoices',
    label: 'Invoices',
    tallyObjectHints: ['sales', 'credit_note', 'debit_note'],
    syncDefault: 'arivu_to_tally',
    inboundCreateSupported: true,
  },
  {
    entityType: 'sales_order',
    moduleKey: 'sales_orders',
    label: 'Sales orders',
    tallyObjectHints: ['sales_order'],
    syncDefault: 'arivu_to_tally',
    inboundCreateSupported: true,
  },
  {
    entityType: 'purchase_order',
    moduleKey: 'purchase_orders',
    label: 'Purchase orders',
    tallyObjectHints: ['purchase_order'],
    syncDefault: 'arivu_to_tally',
    inboundCreateSupported: true,
  },
  {
    entityType: 'purchase_bill',
    moduleKey: 'purchase_bills',
    label: 'Purchase bills',
    tallyObjectHints: ['purchase'],
    syncDefault: 'arivu_to_tally',
    inboundCreateSupported: true,
  },
  {
    entityType: 'payment',
    moduleKey: 'payments',
    label: 'Payments',
    tallyObjectHints: ['receipt', 'payment'],
    syncDefault: 'arivu_to_tally',
    inboundCreateSupported: true,
  },
  {
    entityType: 'journal_entry',
    moduleKey: 'journal_entries',
    label: 'Journal entries',
    tallyObjectHints: ['journal', 'contra'],
    syncDefault: 'arivu_to_tally',
    inboundCreateSupported: true,
  },
  {
    entityType: 'delivery_note',
    moduleKey: 'delivery_notes',
    label: 'Delivery notes',
    tallyObjectHints: ['delivery_note'],
    syncDefault: 'arivu_to_tally',
    inboundCreateSupported: true,
  },
  {
    entityType: 'receipt_note',
    moduleKey: 'receipt_notes',
    label: 'Receipt notes',
    tallyObjectHints: ['receipt_note'],
    syncDefault: 'arivu_to_tally',
    inboundCreateSupported: true,
  },
  {
    entityType: 'cost_centre',
    moduleKey: 'cost_centres',
    label: 'Cost centres',
    tallyObjectHints: ['cost_centre'],
    syncDefault: 'tally_to_arivu',
  },
  {
    entityType: 'tax',
    moduleKey: 'taxes',
    label: 'Taxes',
    tallyObjectHints: ['tax_unit', 'gst_classification', 'ledger'],
    syncDefault: 'tally_to_arivu',
  },
  {
    entityType: 'price_book',
    moduleKey: 'catalog_price_books',
    label: 'Price books',
    tallyObjectHints: ['price_level', 'price_list'],
    syncDefault: 'discover_only',
  },
  {
    entityType: 'reference',
    moduleKey: null,
    label: 'Reference cache',
    tallyObjectHints: [
      'group',
      'unit',
      'currency',
      'voucher_type',
      'batch',
      'cost_category',
      'employee',
      'payroll',
      'attendance',
      'bank_transaction',
      'quotation',
      'manufacturing_journal',
      'physical_stock',
    ],
    syncDefault: 'tally_to_arivu',
    supportTier: 'reference_only',
  },
]);

const VOUCHER_MODULE_KEYS = Object.freeze([
  'sales',
  'purchase',
  'receipt',
  'payment',
  'credit_note',
  'debit_note',
  'journal',
  'contra',
  'stock_journal',
  'delivery_note',
  'receipt_note',
  'purchase_order',
  'sales_order',
  'quotation',
  'manufacturing_journal',
  'physical_stock',
  'payroll_voucher',
]);

module.exports = {
  ATIP_HEALTH_STATES,
  INBOUND_CREATE_POLICIES,
  SUPPORT_TIERS,
  ATIP_ENGINE_KEYS,
  ARIVU_CAPABILITY_REGISTRY,
  VOUCHER_MODULE_KEYS,
};

'use strict';

/**
 * Canonical registry for Module Numbering.
 * moduleKey may include a sub-key (e.g. invoices:credit_note).
 *
 * @typedef {object} ModuleNumberingRegistryEntry
 * @property {string} numberFieldKey
 * @property {string} numberFieldLabel - Human-readable field name for Settings UI
 * @property {string} defaultPrefix
 * @property {string} defaultFormat
 * @property {number} [defaultSequenceLength]
 * @property {string} [label]
 * @property {string} [parentModuleKey] - display grouping for sub-keys
 * @property {string} [requireAppKey] - only seed/list when this app is enabled for the org
 * @property {boolean} [standard] - false for derived custom defaults only
 */

/**
 * @param {string} fieldKey
 * @returns {string}
 */
function humanizeFieldKey(fieldKey) {
  const raw = String(fieldKey || '').trim();
  if (!raw) return 'Record Number';
  if (raw === 'item_code') return 'Item Code';
  if (raw === 'caseId') return 'Case ID';
  if (raw === 'assetId') return 'Asset ID';
  return raw
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bId\b/g, 'ID')
    .replace(/^./, (c) => c.toUpperCase());
}

/** @type {Readonly<Record<string, ModuleNumberingRegistryEntry>>} */
const MODULE_NUMBERING_REGISTRY = Object.freeze({
  quotes: {
    numberFieldKey: 'quoteNumber',
    numberFieldLabel: 'Quote Number',
    defaultPrefix: 'QT',
    defaultFormat: 'QT-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Quotes',
  },
  sales_orders: {
    numberFieldKey: 'salesOrderNumber',
    numberFieldLabel: 'Sales Order Number',
    defaultPrefix: 'SO',
    defaultFormat: 'SO-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Sales Orders',
  },
  invoices: {
    numberFieldKey: 'invoiceNumber',
    numberFieldLabel: 'Invoice Number',
    defaultPrefix: 'INV',
    defaultFormat: 'INV-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Invoices',
  },
  'invoices:credit_note': {
    numberFieldKey: 'invoiceNumber',
    numberFieldLabel: 'Credit Note Number',
    defaultPrefix: 'CN',
    defaultFormat: 'CN-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Credit Notes',
    parentModuleKey: 'invoices',
  },
  payments: {
    numberFieldKey: 'paymentNumber',
    numberFieldLabel: 'Payment Number',
    defaultPrefix: 'PAY',
    defaultFormat: 'PAY-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Payments',
  },
  documents: {
    numberFieldKey: 'documentNumber',
    numberFieldLabel: 'Document Number',
    defaultPrefix: 'DOC',
    defaultFormat: 'DOC-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Documents',
  },
  cases: {
    numberFieldKey: 'caseId',
    numberFieldLabel: 'Case ID',
    defaultPrefix: 'CAS',
    defaultFormat: 'CAS-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Cases',
  },
  items: {
    numberFieldKey: 'item_code',
    numberFieldLabel: 'Item Code',
    defaultPrefix: 'ITM',
    defaultFormat: 'ITM-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Items',
  },
  people: {
    numberFieldKey: 'personNumber',
    numberFieldLabel: 'Person Number',
    defaultPrefix: 'PEO',
    defaultFormat: 'PEO-{SEQ}',
    defaultSequenceLength: 6,
    label: 'People',
  },
  organizations: {
    numberFieldKey: 'organizationNumber',
    numberFieldLabel: 'Organization Number',
    defaultPrefix: 'ORG',
    defaultFormat: 'ORG-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Organizations',
  },
  deals: {
    numberFieldKey: 'dealNumber',
    numberFieldLabel: 'Deal Number',
    defaultPrefix: 'DEAL',
    defaultFormat: 'DEAL-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Deals',
  },
  tasks: {
    numberFieldKey: 'taskNumber',
    numberFieldLabel: 'Task Number',
    defaultPrefix: 'TSK',
    defaultFormat: 'TSK-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Tasks',
  },
  events: {
    numberFieldKey: 'eventNumber',
    numberFieldLabel: 'Event Number',
    defaultPrefix: 'EVT',
    defaultFormat: 'EVT-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Events',
  },
  forms: {
    numberFieldKey: 'formNumber',
    numberFieldLabel: 'Form Number',
    defaultPrefix: 'FRM',
    defaultFormat: 'FRM-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Forms',
  },
  responses: {
    numberFieldKey: 'responseNumber',
    numberFieldLabel: 'Response Number',
    defaultPrefix: 'RSP',
    defaultFormat: 'RSP-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Responses',
  },
  templates: {
    numberFieldKey: 'templateNumber',
    numberFieldLabel: 'Template Number',
    defaultPrefix: 'TPL',
    defaultFormat: 'TPL-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Templates',
  },
  imports: {
    numberFieldKey: 'importNumber',
    numberFieldLabel: 'Import Number',
    defaultPrefix: 'IMP',
    defaultFormat: 'IMP-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Imports',
  },
  articles: {
    numberFieldKey: 'articleNumber',
    numberFieldLabel: 'Article Number',
    defaultPrefix: 'ART',
    defaultFormat: 'ART-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Articles',
  },
  campaigns: {
    numberFieldKey: 'campaignNumber',
    numberFieldLabel: 'Campaign Number',
    defaultPrefix: 'CMP',
    defaultFormat: 'CMP-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Campaigns',
  },
  blog: {
    numberFieldKey: 'blogNumber',
    numberFieldLabel: 'Blog Number',
    defaultPrefix: 'BLG',
    defaultFormat: 'BLG-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Blog',
  },
  audiences: {
    numberFieldKey: 'audienceNumber',
    numberFieldLabel: 'Audience Number',
    defaultPrefix: 'AUD',
    defaultFormat: 'AUD-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Audiences',
  },
  segments: {
    numberFieldKey: 'segmentNumber',
    numberFieldLabel: 'Segment Number',
    defaultPrefix: 'SEG',
    defaultFormat: 'SEG-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Segments',
  },
  assets: {
    numberFieldKey: 'assetId',
    numberFieldLabel: 'Asset ID',
    defaultPrefix: 'AST',
    defaultFormat: 'AST-{SEQ}',
    defaultSequenceLength: 6,
    label: 'Assets',
  },

  // Inventory app workbench documents (requireAppKey: INVENTORY)
  purchase_orders: {
    numberFieldKey: 'poNumber',
    numberFieldLabel: 'PO Number',
    defaultPrefix: 'PO',
    defaultFormat: 'PO-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Purchase Orders',
    requireAppKey: 'INVENTORY',
  },
  receipt_notes: {
    numberFieldKey: 'receiptNoteNumber',
    numberFieldLabel: 'Receipt Note Number',
    defaultPrefix: 'RN',
    defaultFormat: 'RN-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Receipt Notes',
    requireAppKey: 'INVENTORY',
  },
  purchase_returns: {
    numberFieldKey: 'purchaseReturnNumber',
    numberFieldLabel: 'Purchase Return Number',
    defaultPrefix: 'PR',
    defaultFormat: 'PR-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Purchase Returns',
    requireAppKey: 'INVENTORY',
  },
  delivery_notes: {
    numberFieldKey: 'deliveryNoteNumber',
    numberFieldLabel: 'Delivery Note Number',
    defaultPrefix: 'DN',
    defaultFormat: 'DN-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Delivery Notes',
    requireAppKey: 'INVENTORY',
  },
  delivery_returns: {
    numberFieldKey: 'deliveryReturnNumber',
    numberFieldLabel: 'Delivery Return Number',
    defaultPrefix: 'DR',
    defaultFormat: 'DR-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Delivery Returns',
    requireAppKey: 'INVENTORY',
  },
  sales_returns: {
    numberFieldKey: 'salesReturnNumber',
    numberFieldLabel: 'Sales Return Number',
    defaultPrefix: 'SR',
    defaultFormat: 'SR-{SEQ}',
    defaultSequenceLength: 4,
    label: 'Sales Returns',
    requireAppKey: 'INVENTORY',
  },
});

const STANDARD_MODULE_KEYS = Object.freeze(Object.keys(MODULE_NUMBERING_REGISTRY));

const ALLOWED_FORMAT_TOKENS = Object.freeze([
  'PREFIX',
  'SUFFIX',
  'YYYY',
  'YY',
  'MM',
  'DD',
  'SEQ',
]);

/**
 * @param {string} moduleKey
 * @returns {ModuleNumberingRegistryEntry | null}
 */
function getRegistryEntry(moduleKey) {
  const key = String(moduleKey || '').trim();
  if (!key) return null;
  return MODULE_NUMBERING_REGISTRY[key] || null;
}

/**
 * Derive a default config for a custom module.
 * @param {string} moduleKey
 * @param {string} [label]
 */
function buildCustomModuleDefaults(moduleKey, label) {
  const raw = String(moduleKey || '').trim().toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom';
  const prefix = cleaned
    .split('_')
    .filter(Boolean)
    .map((part) => part.slice(0, 3).toUpperCase())
    .join('')
    .slice(0, 6) || 'REC';

  return {
    numberFieldKey: 'recordNumber',
    numberFieldLabel: 'Record Number',
    defaultPrefix: prefix,
    defaultFormat: `${prefix}-{SEQ}`,
    defaultSequenceLength: 6,
    label: label || moduleKey,
    standard: false,
  };
}

/**
 * @param {string} moduleKey
 * @param {string} [label]
 * @returns {ModuleNumberingRegistryEntry}
 */
function resolveRegistryEntry(moduleKey, label) {
  const entry = getRegistryEntry(moduleKey) || buildCustomModuleDefaults(moduleKey, label);
  if (!entry.numberFieldLabel) {
    return {
      ...entry,
      numberFieldLabel: humanizeFieldKey(entry.numberFieldKey),
    };
  }
  return entry;
}

module.exports = {
  MODULE_NUMBERING_REGISTRY,
  STANDARD_MODULE_KEYS,
  ALLOWED_FORMAT_TOKENS,
  getRegistryEntry,
  buildCustomModuleDefaults,
  resolveRegistryEntry,
  humanizeFieldKey,
};

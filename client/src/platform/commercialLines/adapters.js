/**
 * Commercial document adapters for the shared Lines workspace.
 * Same editor chrome; capabilities + API shape differ by module / lifecycle.
 */

import { isCommerciallyLockedStatus } from '@/constants/quoteLifecycle';

/** Draft PO: catalog lines + unit price; document-level overall discount supported. */
/** @type {CommercialLinesCapabilities} */
const PURCHASE_ORDER_CAPABILITIES = {
  discounts: true,
  pricingColumns: false,
  sectionReorder: false,
  lineReorder: false,
  optionalSections: false,
  sectionDiscounts: false,
  globalDiscounts: true,
  taxesCharges: true,
  recalculate: true,
  bundles: false,
  headerActions: false,
  createCatalogItem: true,
  columnPrefs: true,
  unitPriceEdit: true,
  taxEdit: true
};

/** @typedef {'quote' | 'salesOrder' | 'invoice' | 'purchaseOrder'} CommercialLinesKind */

/**
 * @typedef {object} CommercialLinesCapabilities
 * @property {boolean} discounts
 * @property {boolean} pricingColumns
 * @property {boolean} sectionReorder
 * @property {boolean} lineReorder
 * @property {boolean} optionalSections
 * @property {boolean} sectionDiscounts
 * @property {boolean} globalDiscounts
 * @property {boolean} taxesCharges
 * @property {boolean} recalculate
 * @property {boolean} bundles
 * @property {boolean} headerActions
 * @property {boolean} createCatalogItem
 * @property {boolean} columnPrefs
 * @property {boolean} unitPriceEdit
 * @property {boolean} taxEdit
 */

/**
 * @typedef {object} CommercialLinesAdapter
 * @property {CommercialLinesKind} kind
 * @property {string} apiBase
 * @property {string} lineIdField
 * @property {string} sectionIdField
 * @property {string} sectionUuidField
 * @property {string} includeInTotalField
 * @property {string} moduleKey
 * @property {CommercialLinesCapabilities} capabilities
 * @property {(record: object | null | undefined) => boolean} isEditable
 * @property {(args: {
 *   variantId: string,
 *   quantity?: number,
 *   sectionRef?: string | null,
 *   priceBookId?: string | null,
 *   overridePricing?: boolean
 * }) => Record<string, unknown>} buildAddLineBody
 * @property {(args: {
 *   quantity?: number,
 *   sectionRef?: string | null,
 *   discountType?: string | null,
 *   discountValue?: number,
 *   unitPrice?: number,
 *   taxIds?: string[]
 * }) => Record<string, unknown>} buildPatchLineBody
 */

/** @type {CommercialLinesCapabilities} */
const QUOTE_CAPABILITIES = {
  discounts: true,
  pricingColumns: true,
  sectionReorder: true,
  lineReorder: true,
  optionalSections: true,
  sectionDiscounts: true,
  globalDiscounts: true,
  taxesCharges: true,
  recalculate: true,
  bundles: true,
  headerActions: true,
  createCatalogItem: true,
  columnPrefs: true,
  unitPriceEdit: true,
  taxEdit: true
};

/** Draft SO/Invoice: full commercial Lines parity with Quotes (except quote workflow header actions). */
/** @type {CommercialLinesCapabilities} */
const EXECUTION_DRAFT_CAPABILITIES = {
  discounts: true,
  pricingColumns: false,
  sectionReorder: true,
  lineReorder: true,
  optionalSections: true,
  sectionDiscounts: true,
  globalDiscounts: true,
  taxesCharges: true,
  recalculate: true,
  bundles: true,
  headerActions: false,
  createCatalogItem: true,
  columnPrefs: true,
  unitPriceEdit: false,
  taxEdit: true
};

/** @type {CommercialLinesAdapter} */
export const quoteCommercialLinesAdapter = {
  kind: 'quote',
  apiBase: '/quotes',
  lineIdField: 'quoteLineId',
  sectionIdField: 'quoteSectionId',
  sectionUuidField: 'quoteSectionId',
  includeInTotalField: 'includeInQuoteTotal',
  moduleKey: 'quotes',
  capabilities: QUOTE_CAPABILITIES,
  isEditable(record) {
    return !isCommerciallyLockedStatus(String(record?.status || '').trim());
  },
  buildAddLineBody({
    variantId,
    quantity = 1,
    sectionRef,
    priceBookId,
    overridePricing,
    productConfigurationId,
    configurationSelections
  }) {
    const body = {
      variantId,
      quantity,
      priceBookId: priceBookId || null,
      quoteSectionId: sectionRef || null,
      overridePricing: overridePricing === true
    };
    if (productConfigurationId) {
      body.productConfigurationId = productConfigurationId;
      body.configurationSelections = configurationSelections || {};
    }
    return body;
  },
  buildPatchLineBody(fields) {
    const body = {};
    if (fields.quantity !== undefined) body.quantity = fields.quantity;
    if (fields.sectionRef !== undefined) body.quoteSectionId = fields.sectionRef;
    if (fields.discountType !== undefined) body.discountType = fields.discountType;
    if (fields.discountValue !== undefined) body.discountValue = fields.discountValue;
    if (fields.unitPrice !== undefined) body.unitPrice = fields.unitPrice;
    if (fields.taxIds !== undefined) body.taxIds = fields.taxIds;
    return body;
  }
};

/** @type {CommercialLinesAdapter} */
export const salesOrderCommercialLinesAdapter = {
  kind: 'salesOrder',
  apiBase: '/sales-orders',
  lineIdField: 'salesOrderLineId',
  sectionIdField: 'salesOrderSectionId',
  sectionUuidField: 'salesOrderSectionId',
  includeInTotalField: 'includeInOrderTotal',
  moduleKey: 'sales_orders',
  capabilities: EXECUTION_DRAFT_CAPABILITIES,
  isEditable(record) {
    return String(record?.status || '') === 'Draft';
  },
  buildAddLineBody({
    variantId,
    quantity = 1,
    sectionRef,
    productConfigurationId,
    configurationSelections
  }) {
    const body = { variantId, quantity };
    if (sectionRef) body.salesOrderSectionId = sectionRef;
    if (productConfigurationId) {
      body.productConfigurationId = productConfigurationId;
      body.configurationSelections = configurationSelections || {};
    }
    return body;
  },
  buildPatchLineBody(fields) {
    const body = {};
    if (fields.quantity !== undefined) body.quantity = fields.quantity;
    if (fields.sectionRef !== undefined) body.salesOrderSectionId = fields.sectionRef;
    if (fields.discountType !== undefined) body.discountType = fields.discountType;
    if (fields.discountValue !== undefined) body.discountValue = fields.discountValue;
    if (fields.taxIds !== undefined) body.taxIds = fields.taxIds;
    return body;
  }
};

/** @type {CommercialLinesAdapter} */
export const invoiceCommercialLinesAdapter = {
  kind: 'invoice',
  apiBase: '/invoices',
  lineIdField: 'invoiceLineId',
  sectionIdField: 'invoiceSectionId',
  sectionUuidField: 'invoiceSectionId',
  includeInTotalField: 'includeInInvoiceTotal',
  moduleKey: 'invoices',
  capabilities: EXECUTION_DRAFT_CAPABILITIES,
  isEditable(record) {
    return String(record?.status || '') === 'Draft';
  },
  buildAddLineBody({ variantId, quantity = 1, sectionRef }) {
    const body = { variantId, quantity };
    if (sectionRef) body.invoiceSectionId = sectionRef;
    return body;
  },
  buildPatchLineBody(fields) {
    const body = {};
    if (fields.quantity !== undefined) body.quantity = fields.quantity;
    if (fields.sectionRef !== undefined) body.invoiceSectionId = fields.sectionRef;
    if (fields.discountType !== undefined) body.discountType = fields.discountType;
    if (fields.discountValue !== undefined) body.discountValue = fields.discountValue;
    if (fields.taxIds !== undefined) body.taxIds = fields.taxIds;
    return body;
  }
};

/** @type {CommercialLinesAdapter} */
export const purchaseOrderCommercialLinesAdapter = {
  kind: 'purchaseOrder',
  apiBase: '/inventory/purchase-orders',
  lineIdField: 'purchaseOrderLineId',
  sectionIdField: 'purchaseOrderSectionId',
  sectionUuidField: 'purchaseOrderSectionId',
  includeInTotalField: 'includeInPoTotal',
  moduleKey: 'purchase_orders',
  capabilities: PURCHASE_ORDER_CAPABILITIES,
  isEditable(record) {
    return String(record?.status || '').toLowerCase() === 'draft';
  },
  buildAddLineBody({
    variantId,
    quantity = 1,
    unitPrice,
    linkToVendorCatalog,
    vendorItemCode,
    vendorItemName,
    minOrderQty
  }) {
    const body = {
      variantId,
      quantityOrdered: quantity,
      quantity
    };
    if (unitPrice != null && unitPrice !== '') {
      body.unitPrice = Number(unitPrice) || 0;
    }
    if (linkToVendorCatalog === true) {
      body.linkToVendorCatalog = true;
    }
    if (vendorItemCode != null && String(vendorItemCode).trim()) {
      body.vendorItemCode = String(vendorItemCode).trim();
    }
    if (vendorItemName != null && String(vendorItemName).trim()) {
      body.vendorItemName = String(vendorItemName).trim();
    }
    if (minOrderQty != null && Number.isFinite(Number(minOrderQty))) {
      body.minOrderQty = Number(minOrderQty);
    }
    return body;
  },
  buildPatchLineBody(fields) {
    const body = {};
    if (fields.quantity !== undefined) {
      body.quantityOrdered = fields.quantity;
      body.quantity = fields.quantity;
    }
    if (fields.discountType !== undefined) body.discountType = fields.discountType;
    if (fields.discountValue !== undefined) body.discountValue = fields.discountValue;
    if (fields.unitPrice !== undefined) body.unitPrice = fields.unitPrice;
    if (fields.taxIds !== undefined) body.taxIds = fields.taxIds;
    return body;
  }
};

const BY_KIND = {
  quote: quoteCommercialLinesAdapter,
  salesOrder: salesOrderCommercialLinesAdapter,
  invoice: invoiceCommercialLinesAdapter,
  purchaseOrder: purchaseOrderCommercialLinesAdapter
};

/**
 * @param {Partial<CommercialLinesAdapter> | CommercialLinesKind | null | undefined} input
 * @returns {CommercialLinesAdapter}
 */
export function resolveCommercialLinesAdapter(input) {
  if (!input) return quoteCommercialLinesAdapter;
  if (typeof input === 'string') {
    return BY_KIND[input] || quoteCommercialLinesAdapter;
  }
  if (input.kind && BY_KIND[input.kind] && Object.keys(input).length === 1) {
    return BY_KIND[input.kind];
  }
  const base = BY_KIND[input.kind] || quoteCommercialLinesAdapter;
  return {
    ...base,
    ...input,
    capabilities: {
      ...base.capabilities,
      ...(input.capabilities || {})
    }
  };
}

/**
 * @param {CommercialLinesAdapter} adapter
 * @param {object | null | undefined} line
 */
export function commercialLineId(adapter, line) {
  if (!line) return '';
  const key = adapter.lineIdField;
  return String(line[key] || line._id || line._localId || '').trim();
}

/**
 * @param {CommercialLinesAdapter} adapter
 * @param {object | null | undefined} line
 */
export function commercialLineSectionRef(adapter, line) {
  if (!line) return null;
  const val = line[adapter.sectionIdField];
  return val != null && val !== '' ? String(val) : null;
}

/**
 * @param {CommercialLinesAdapter} adapter
 * @param {object | null | undefined} section
 */
export function commercialSectionRef(adapter, section) {
  if (!section) return null;
  return section[adapter.sectionUuidField] || section._id || null;
}

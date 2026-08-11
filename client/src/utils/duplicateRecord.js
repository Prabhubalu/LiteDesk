/**
 * Build Create-form initial data from an existing record.
 * Duplicate never persists until the user saves the Create form.
 */

export const DUPLICATE_OMIT_KEYS = new Set([
  '_id',
  'id',
  '__v',
  'createdAt',
  'updatedAt',
  'createdBy',
  'modifiedBy',
  'deletedAt',
  'deletedBy',
  'deletionReason',
  'activityLogs',
  'organizationId',
  'comments',
  'followers',
  // Auto-allocated / identity fields — server re-generates on create
  'item_id',
  'item_code',
  'formId',
  'caseId',
  'caseNumber',
  'quoteNumber',
  'invoiceNumber',
  'salesOrderNumber',
  'poNumber',
  'purchaseReturnNumber',
  'deliveryReturnNumber',
  'deliveryNoteNumber',
  'salesReturnNumber',
  'receiptNoteNumber',
  'documentNumber',
  'publicLink',
  'inventoryLocationId',
  'inventoryAdjustmentId',
  'inventoryTransferId',
  // Nested enrichments not valid on create payload
  'variants',
  'defaultVariant',
  'catalogCategory',
  'attributeTemplates',
  'media',
  'slaContext',
  'liveChat'
]);

function normalizeValue(value) {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null || item === '') return null;
        if (typeof item === 'object') {
          return item._id ?? item.id ?? item.userId ?? item.value ?? item.recordId ?? null;
        }
        return item;
      })
      .filter((v) => v != null && v !== '');
  }
  if (typeof value === 'object') {
    if (value._id != null) return value._id;
    if (value.id != null && (typeof value.id === 'string' || typeof value.id === 'number')) {
      return value.id;
    }
  }
  return value;
}

/**
 * @param {Record<string, unknown>|null|undefined} record
 * @param {{ moduleKey?: string }} [options]
 * @returns {Record<string, unknown>}
 */
export function buildDuplicateInitialData(record, options = {}) {
  if (!record || typeof record !== 'object') return {};

  const moduleKey = String(options.moduleKey || '').toLowerCase();
  const payload = {};

  // Structural / identity arrays — not form fields (caller may re-attach lines separately)
  const STRUCTURAL_KEYS = new Set([
    'lines',
    'sections',
    'nodes',
    'edges',
    'variants',
    'defaultVariant',
    'activity',
    'comments',
    'attachments',
    'versions'
  ]);

  for (const key of Object.keys(record)) {
    if (DUPLICATE_OMIT_KEYS.has(key)) continue;
    if (STRUCTURAL_KEYS.has(key)) continue;
    if (key.startsWith('$') || key.startsWith('_')) continue;
    payload[key] = normalizeValue(record[key]);
  }

  // Module-specific create cleanup
  if (moduleKey === 'items') {
    delete payload.stock_quantity;
    delete payload.reserved_quantity;
    delete payload.available_quantity;
  }

  if (moduleKey === 'deals') {
    // Fresh pipeline state for the copy
    if (payload.status === 'Won' || payload.status === 'Lost' || payload.status === 'Closed') {
      delete payload.status;
      delete payload.closedAt;
      delete payload.wonAt;
      delete payload.lostAt;
      delete payload.lostReason;
    }
  }

  if (moduleKey === 'tasks') {
    delete payload.completedDate;
    delete payload.completedAt;
    if (payload.status === 'Completed' || payload.status === 'Done') {
      payload.status = 'Open';
    }
  }

  if (moduleKey === 'cases') {
    delete payload.closedAt;
    delete payload.resolvedAt;
  }

  // Primary human title → unique-by-default, clearly marked as a copy
  applyDuplicateTitleSuffix(payload, moduleKey);

  // Quotes / invoices / SOs / POs: seed commercial lines for Create drawer draft workspace
  attachCommercialDuplicateDraft(payload, record, moduleKey);

  return payload;
}

/**
 * Per-module commercial lines identity (mirrors platform commercial lines adapters).
 * @type {Record<string, { sectionIdField: string, lineIdField: string, includeField: string, defaultStatus: string }>}
 */
const COMMERCIAL_DUP_CONFIG = {
  quotes: {
    sectionIdField: 'quoteSectionId',
    lineIdField: 'quoteLineId',
    includeField: 'includeInQuoteTotal',
    defaultStatus: 'Draft'
  },
  invoices: {
    sectionIdField: 'invoiceSectionId',
    lineIdField: 'invoiceLineId',
    includeField: 'includeInInvoiceTotal',
    defaultStatus: 'Draft'
  },
  sales_orders: {
    sectionIdField: 'salesOrderSectionId',
    lineIdField: 'salesOrderLineId',
    includeField: 'includeInOrderTotal',
    defaultStatus: 'Draft'
  },
  purchase_orders: {
    sectionIdField: 'purchaseOrderSectionId',
    lineIdField: 'purchaseOrderLineId',
    includeField: 'includeInPoTotal',
    defaultStatus: 'draft'
  }
};

function resolveRelationId(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') {
    const id = value._id ?? value.id ?? value.value ?? null;
    return id != null && String(id).trim() ? String(id).trim() : null;
  }
  const s = String(value).trim();
  return s || null;
}

/**
 * Map source commercial lines + sections into Create-drawer local draft shape.
 * Stored on payload as `_commercialLines` / `_commercialSections` (not form fields).
 *
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>} record
 * @param {string} moduleKey
 */
function attachCommercialDuplicateDraft(payload, record, moduleKey) {
  const cfg = COMMERCIAL_DUP_CONFIG[moduleKey];
  if (!cfg) return;

  // Always start a commercial copy as Draft / draft
  if (payload.status != null) payload.status = cfg.defaultStatus;

  const sourceLines = Array.isArray(record.lines) ? record.lines : [];
  const sourceSections = Array.isArray(record.sections) ? record.sections : [];
  if (!sourceLines.length && !sourceSections.length) return;

  const { sectionIdField, lineIdField, includeField } = cfg;
  const stamp = Date.now().toString(36);
  /** @type {Map<string, string>} */
  const sectionMap = new Map();
  /** @type {object[]} */
  const localSections = [];

  if (sourceSections.length) {
    sourceSections.forEach((sec, idx) => {
      const oldRef = resolveRelationId(sec?.[sectionIdField] ?? sec?._id ?? sec?.id) || `sec-${idx}`;
      const lid = `local-sec-${stamp}-${idx}`;
      sectionMap.set(String(oldRef), lid);
      localSections.push({
        _id: lid,
        [sectionIdField]: lid,
        sectionTitle: sec.sectionTitle || (idx === 0 ? 'General' : `Section ${idx + 1}`),
        sectionOrder: sec.sectionOrder != null ? Number(sec.sectionOrder) : idx,
        sectionType: sec.sectionType || 'standard',
        [includeField]: sec[includeField] !== false,
        sectionDiscountType: sec.sectionDiscountType || null,
        sectionDiscountValue: sec.sectionDiscountValue ?? 0,
        sectionTotal: 0
      });
    });
  } else {
    const lid = `local-sec-${stamp}-0`;
    sectionMap.set('__default__', lid);
    localSections.push({
      _id: lid,
      [sectionIdField]: lid,
      sectionTitle: 'General',
      sectionOrder: 0,
      sectionType: 'standard',
      [includeField]: true,
      sectionTotal: 0
    });
  }

  const defaultSectionRef = localSections[0]?.[sectionIdField] || localSections[0]?._id || null;
  /** @type {object[]} */
  const localLines = [];

  sourceLines.forEach((line, idx) => {
    if (!line || typeof line !== 'object') return;
    const lineType = String(line.lineType || 'product');
    // Skip pure bundle components — parent bundle expand recreates them
    if (lineType === 'bundle_component' || lineType === 'bundle_child') return;

    const variantId = resolveRelationId(line.variantId);
    if (!variantId) return;

    const lid = `local-line-${stamp}-${idx}`;
    const oldSec =
      resolveRelationId(line[sectionIdField]) ||
      resolveRelationId(line.sectionId) ||
      null;
    const sectionRef =
      (oldSec && sectionMap.get(String(oldSec))) || defaultSectionRef;

    const qty = Number(
      line.quantity ?? line.quantityOrdered ?? line.quantityDelivered ?? 1
    );
    const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
    const unitPrice = Number(
      line.unitPrice ?? line.unitPriceSnapshot ?? line.listPriceSnapshot ?? 0
    );

    const mapped = {
      _localId: lid,
      _id: lid,
      [lineIdField]: lid,
      [sectionIdField]: sectionRef,
      variantId,
      quantity,
      quantityOrdered: quantity,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      unitPriceSnapshot: Number.isFinite(unitPrice) ? unitPrice : 0,
      listPriceSnapshot: line.listPriceSnapshot ?? unitPrice,
      itemNameSnapshot: line.itemNameSnapshot || line.description || null,
      skuSnapshot: line.skuSnapshot || null,
      lineType: lineType === 'bundle_parent' ? 'bundle_parent' : 'product',
      lineOrder: line.lineOrder != null ? Number(line.lineOrder) : idx + 1,
      discountType: line.discountType || null,
      discountValue: line.discountValue ?? 0,
      discountAmount: line.discountAmount ?? 0,
      taxIds: Array.isArray(line.taxIds)
        ? line.taxIds.map((t) => resolveRelationId(t)).filter(Boolean)
        : [],
      priceBookIdSnapshot: resolveRelationId(line.priceBookIdSnapshot || line.priceBookId),
      priceBookNameSnapshot: line.priceBookNameSnapshot || null,
      pricingSourceSnapshot: line.pricingSourceSnapshot || null,
      lineTotal: line.lineTotal ?? null,
      // Bundle expand on create uses this
      _localBundleVariantId:
        lineType === 'bundle_parent' ? variantId : undefined,
      _localIncludedOptionalComponentVariantIds: Array.isArray(
        line.includedOptionalComponentVariantIds
      )
        ? line.includedOptionalComponentVariantIds.map((v) => resolveRelationId(v)).filter(Boolean)
        : undefined
    };

    if (moduleKey === 'purchase_orders') {
      mapped.vendorItemCode = line.vendorItemCode || null;
      mapped.vendorItemName = line.vendorItemName || null;
      mapped.minOrderQty = line.minOrderQty ?? null;
      mapped.description = line.descriptionSnapshot || line.description || '';
    }

    localLines.push(mapped);
  });

  if (localLines.length) payload._commercialLines = localLines;
  if (localSections.length) payload._commercialSections = localSections;

  // Header commercial money snapshot (UI; recalculated after save)
  if (record.overallDiscountType != null) {
    payload.overallDiscountType = record.overallDiscountType;
  }
  if (record.overallDiscountValue != null) {
    payload.overallDiscountValue = record.overallDiscountValue;
  }
}

/** Field keys that act as the user-facing record name for each module. */
const DUPLICATE_TITLE_FIELDS_BY_MODULE = {
  tasks: ['title'],
  deals: ['name'],
  items: ['item_name'],
  organizations: ['name'],
  people: [], // avoid mutating personal names
  events: ['eventName', 'title'],
  cases: ['title', 'subject'],
  documents: ['title', 'name'],
  quotes: ['quoteTitle', 'subject'],
  invoices: ['invoiceTitle', 'subject'],
  sales_orders: ['orderTitle', 'subject'],
  purchase_orders: ['subject'],
  purchase_returns: ['subject'],
  delivery_notes: ['subject'],
  delivery_returns: ['subject'],
  sales_returns: ['subject'],
  receipt_notes: ['subject'],
  templates: ['name'],
  forms: ['name']
};

const FALLBACK_TITLE_FIELDS = [
  'quoteTitle',
  'invoiceTitle',
  'orderTitle',
  'title',
  'name',
  'subject',
  'item_name',
  'eventName'
];

/**
 * @param {Record<string, unknown>} payload
 * @param {string} moduleKey
 */
function applyDuplicateTitleSuffix(payload, moduleKey) {
  const preferred = DUPLICATE_TITLE_FIELDS_BY_MODULE[moduleKey];
  const fields = preferred != null ? preferred : FALLBACK_TITLE_FIELDS;
  for (const key of fields) {
    if (payload[key] == null || payload[key] === '') continue;
    if (typeof payload[key] !== 'string' && typeof payload[key] !== 'number') continue;
    payload[key] = withCopyNameSuffix(payload[key]);
    return;
  }
  // Fallback first matching known field on payload
  for (const key of FALLBACK_TITLE_FIELDS) {
    if (payload[key] == null || payload[key] === '') continue;
    if (typeof payload[key] !== 'string' && typeof payload[key] !== 'number') continue;
    payload[key] = withCopyNameSuffix(payload[key]);
    return;
  }
}

/**
 * World-class copy label: "Original name - copy"
 * Idempotent if already ends with " - copy" / "(copy)".
 *
 * @param {unknown} name
 * @returns {string}
 */
export function withCopyNameSuffix(name) {
  const base = String(name || '').trim();
  if (!base) return '';
  if (/\s-\s*copy$/i.test(base)) return base;
  if (/\(copy\)$/i.test(base)) return base;
  return `${base} - copy`;
}

/**
 * @param {import('vue-router').LocationQuery | Record<string, unknown> | null | undefined} query
 * @returns {string}
 */
export function resolveDuplicateFromQuery(query) {
  const raw = query?.duplicateFrom;
  if (raw == null || raw === '') return '';
  return String(Array.isArray(raw) ? raw[0] : raw).trim();
}

/**
 * Map inventory workflow create paths for duplicate-as-create navigation.
 * @param {string} moduleKey
 * @param {string} sourceId
 * @returns {string|null}
 */
export function inventoryDuplicateCreatePath(moduleKey, sourceId) {
  const id = String(sourceId || '').trim();
  if (!id) return null;
  const map = {
    purchase_orders: '/inventory/purchase-orders/new',
    purchase_returns: '/inventory/purchase-returns/new',
    delivery_notes: '/inventory/delivery-notes/new',
    delivery_returns: '/inventory/delivery-returns/new',
    sales_returns: '/inventory/sales-returns/new',
    receipt_notes: '/inventory/receipt-notes/new'
  };
  const base = map[String(moduleKey || '').toLowerCase()];
  if (!base) return null;
  return `${base}?duplicateFrom=${encodeURIComponent(id)}`;
}

/**
 * Open the platform Create drawer prefilled from a source record (no DB write).
 * Requires GlobalSearch / shell listener for `arivu:open-create-drawer`.
 *
 * @param {{ moduleKey: string, record: Record<string, unknown>, title?: string, lockedFields?: string[] }} args
 */
export function openDuplicateCreateDrawer({ moduleKey, record, title, lockedFields }) {
  if (typeof window === 'undefined' || !moduleKey || !record) return;
  const initialData = buildDuplicateInitialData(record, { moduleKey });
  window.dispatchEvent(
    new CustomEvent('arivu:open-create-drawer', {
      detail: {
        moduleKey,
        initialData,
        title: title || undefined,
        lockedFields: lockedFields || []
      }
    })
  );
}

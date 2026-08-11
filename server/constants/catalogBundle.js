/**
 * Catalog C5 — Bundle / composite sellables.
 * Bundle definition lives on ItemVariant; components on ItemBundleComponent.
 */

const CATALOG_BUNDLE_TYPES = ['fixed', 'flexible'];
const CATALOG_BUNDLE_TYPE_DEFAULT = 'fixed';

/** fixed = package list price; rollup = sum of included components; discount = rollup − bundle discount */
const CATALOG_BUNDLE_PRICING_MODES = ['fixed', 'rollup', 'discount'];
const CATALOG_BUNDLE_PRICING_DEFAULT = 'fixed';

const CATALOG_BUNDLE_DISCOUNT_TYPES = ['percent', 'amount'];

function isCatalogBundleType(value) {
  return CATALOG_BUNDLE_TYPES.includes(value);
}

function isCatalogBundlePricingMode(value) {
  return CATALOG_BUNDLE_PRICING_MODES.includes(value);
}

function isCatalogBundleDiscountType(value) {
  return CATALOG_BUNDLE_DISCOUNT_TYPES.includes(value);
}

function validationError(message, details = null) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  if (details != null) err.details = details;
  return err;
}

/**
 * Normalize a component row from API payload.
 * @returns {object}
 */
function normalizeBundleComponentInput(row) {
  const componentVariantId = row?.componentVariantId;
  if (!componentVariantId) {
    throw validationError('Each component requires componentVariantId');
  }

  const quantity = Number(row.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw validationError('Component quantity must be greater than zero');
  }

  const isOptional = row.isOptional === true;
  let minQuantity =
    row.minQuantity !== undefined && row.minQuantity !== null && row.minQuantity !== ''
      ? Number(row.minQuantity)
      : null;
  let maxQuantity =
    row.maxQuantity !== undefined && row.maxQuantity !== null && row.maxQuantity !== ''
      ? Number(row.maxQuantity)
      : null;

  if (minQuantity != null && (!Number.isFinite(minQuantity) || minQuantity <= 0)) {
    throw validationError('minQuantity must be a positive number when set');
  }
  if (maxQuantity != null && (!Number.isFinite(maxQuantity) || maxQuantity <= 0)) {
    throw validationError('maxQuantity must be a positive number when set');
  }
  if (minQuantity != null && maxQuantity != null && minQuantity > maxQuantity) {
    throw validationError('minQuantity cannot exceed maxQuantity');
  }
  if (minQuantity != null && quantity < minQuantity) {
    throw validationError(`Default quantity is below minQuantity for a component`);
  }
  if (maxQuantity != null && quantity > maxQuantity) {
    throw validationError(`Default quantity exceeds maxQuantity for a component`);
  }

  return {
    componentVariantId,
    quantity,
    isOptional,
    defaultSelected: isOptional ? row.defaultSelected === true : false,
    editableQuantity: row.editableQuantity === true,
    remarks: typeof row.remarks === 'string' ? row.remarks.trim().slice(0, 500) : '',
    minQuantity,
    maxQuantity,
    sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : 0
  };
}

/**
 * Validate bundle definition rules (save-time).
 * @param {{ bundleType: string, pricingMode: string, components: object[], minOptionalSelection?: number|null, maxOptionalSelection?: number|null, discountType?: string|null, discountValue?: number|null }} def
 */
function validateBundleDefinition(def) {
  const bundleType = def.bundleType || CATALOG_BUNDLE_TYPE_DEFAULT;
  if (!isCatalogBundleType(bundleType)) {
    throw validationError('bundleType must be fixed or flexible');
  }

  const pricingMode = def.pricingMode || CATALOG_BUNDLE_PRICING_DEFAULT;
  if (!isCatalogBundlePricingMode(pricingMode)) {
    throw validationError('pricingMode must be fixed, rollup, or discount');
  }

  const components = Array.isArray(def.components) ? def.components : [];
  // Empty component list allowed for intermediate editor state; expand/quote validate separately.

  if (bundleType === 'fixed') {
    const optional = components.filter((c) => c.isOptional === true);
    if (optional.length) {
      throw validationError('Fixed bundles cannot include optional components', {
        rule: 'fixed_no_optionals',
        optionalCount: optional.length
      });
    }
  }

  let minOptionalSelection =
    def.minOptionalSelection !== undefined && def.minOptionalSelection !== null && def.minOptionalSelection !== ''
      ? Number(def.minOptionalSelection)
      : null;
  let maxOptionalSelection =
    def.maxOptionalSelection !== undefined && def.maxOptionalSelection !== null && def.maxOptionalSelection !== ''
      ? Number(def.maxOptionalSelection)
      : null;

  if (minOptionalSelection != null && (!Number.isFinite(minOptionalSelection) || minOptionalSelection < 0)) {
    throw validationError('minOptionalSelection must be a non-negative number');
  }
  if (maxOptionalSelection != null && (!Number.isFinite(maxOptionalSelection) || maxOptionalSelection < 0)) {
    throw validationError('maxOptionalSelection must be a non-negative number');
  }
  if (
    minOptionalSelection != null &&
    maxOptionalSelection != null &&
    minOptionalSelection > maxOptionalSelection
  ) {
    throw validationError('minOptionalSelection cannot exceed maxOptionalSelection');
  }

  const optionalCount = components.filter((c) => c.isOptional === true).length;
  if (bundleType === 'fixed') {
    minOptionalSelection = null;
    maxOptionalSelection = null;
  } else {
    if (minOptionalSelection != null && minOptionalSelection > optionalCount) {
      throw validationError('minOptionalSelection cannot exceed number of optional components');
    }
    if (maxOptionalSelection != null && maxOptionalSelection > optionalCount) {
      throw validationError('maxOptionalSelection cannot exceed number of optional components');
    }
  }

  let discountType = def.discountType ?? null;
  let discountValue = def.discountValue ?? null;
  if (pricingMode === 'discount') {
    if (!isCatalogBundleDiscountType(discountType)) {
      throw validationError('discountType must be percent or amount when pricingMode is discount');
    }
    discountValue = Number(discountValue);
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      throw validationError('discountValue must be a non-negative number');
    }
    if (discountType === 'percent' && discountValue > 100) {
      throw validationError('percent discount cannot exceed 100');
    }
  } else {
    discountType = null;
    discountValue = null;
  }

  return {
    bundleType,
    pricingMode,
    minOptionalSelection,
    maxOptionalSelection,
    discountType,
    discountValue
  };
}

/**
 * Parse date boundary; returns null if empty.
 */
function parseBundleDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw validationError('Invalid bundle effective date');
  }
  return d;
}

/**
 * Check effective window for quote/SO as-of date.
 */
function assertBundleEffective({ effectiveFrom, effectiveUntil, asOfDate }) {
  if (!asOfDate) return;
  const asOf = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  if (Number.isNaN(asOf.getTime())) return;

  if (effectiveFrom) {
    const from = effectiveFrom instanceof Date ? effectiveFrom : new Date(effectiveFrom);
    if (!Number.isNaN(from.getTime()) && asOf < from) {
      throw validationError('Bundle is not yet effective', {
        rule: 'effective_from',
        effectiveFrom: from.toISOString()
      });
    }
  }
  if (effectiveUntil) {
    const until = effectiveUntil instanceof Date ? effectiveUntil : new Date(effectiveUntil);
    if (!Number.isNaN(until.getTime()) && asOf > until) {
      throw validationError('Bundle is no longer effective', {
        rule: 'effective_until',
        effectiveUntil: until.toISOString()
      });
    }
  }
}

/**
 * Resolve which component variants are included for a configuration.
 * @param {object[]} components definition rows (with isOptional, defaultSelected, componentVariantId)
 * @param {Iterable<string>|null|undefined} includedOptionalIds — if null/undefined, use defaults
 * @returns {{ includedIds: Set<string>, selectedOptionalCount: number }}
 */
function resolveIncludedComponents(components, includedOptionalIds) {
  const useDefaults = includedOptionalIds == null;
  const requested = useDefaults
    ? null
    : new Set([...includedOptionalIds].map((id) => String(id)).filter(Boolean));

  const includedIds = new Set();
  let selectedOptionalCount = 0;

  for (const comp of components) {
    const id = String(comp.componentVariantId);
    if (!comp.isOptional) {
      includedIds.add(id);
      continue;
    }
    const selected = useDefaults
      ? comp.defaultSelected === true
      : requested.has(id);
    if (selected) {
      includedIds.add(id);
      selectedOptionalCount += 1;
    }
  }

  return { includedIds, selectedOptionalCount };
}

/**
 * Validate a configuration against definition rules (configure / quote time).
 * @param {object} opts
 * @param {string} opts.bundleType
 * @param {object[]} opts.components
 * @param {Set<string>} opts.includedIds
 * @param {number} opts.selectedOptionalCount
 * @param {number|null} opts.minOptionalSelection
 * @param {number|null} opts.maxOptionalSelection
 * @param {Record<string, number>|null} opts.quantityOverrides — per componentVariantId
 */
function validateBundleConfiguration(opts) {
  const {
    bundleType,
    components,
    includedIds,
    selectedOptionalCount,
    minOptionalSelection,
    maxOptionalSelection,
    quantityOverrides = null
  } = opts;

  if (bundleType === 'fixed') {
    for (const comp of components) {
      if (comp.isOptional) {
        throw validationError('Fixed bundle definition is invalid (has optional components)', {
          rule: 'fixed_optional'
        });
      }
      if (!includedIds.has(String(comp.componentVariantId))) {
        throw validationError('Fixed bundle requires all components', {
          rule: 'mandatory_component',
          componentVariantId: String(comp.componentVariantId)
        });
      }
    }
  }

  for (const comp of components) {
    const id = String(comp.componentVariantId);
    if (!comp.isOptional && !includedIds.has(id)) {
      throw validationError('Mandatory component is missing from the bundle', {
        rule: 'mandatory_component',
        componentVariantId: id,
        itemName: comp.item_name || null
      });
    }
  }

  if (bundleType === 'flexible') {
    if (minOptionalSelection != null && selectedOptionalCount < minOptionalSelection) {
      throw validationError(
        `Select at least ${minOptionalSelection} optional component(s)`,
        {
          rule: 'min_optional_selection',
          min: minOptionalSelection,
          selected: selectedOptionalCount
        }
      );
    }
    if (maxOptionalSelection != null && selectedOptionalCount > maxOptionalSelection) {
      throw validationError(
        `Select at most ${maxOptionalSelection} optional component(s)`,
        {
          rule: 'max_optional_selection',
          max: maxOptionalSelection,
          selected: selectedOptionalCount
        }
      );
    }
  }

  if (quantityOverrides && typeof quantityOverrides === 'object') {
    for (const [variantId, rawQty] of Object.entries(quantityOverrides)) {
      const comp = components.find((c) => String(c.componentVariantId) === String(variantId));
      if (!comp) {
        throw validationError('Quantity override for unknown component', {
          rule: 'unknown_component',
          componentVariantId: String(variantId)
        });
      }
      if (comp.editableQuantity !== true) {
        throw validationError('Quantity is not editable for this component', {
          rule: 'quantity_not_editable',
          componentVariantId: String(variantId)
        });
      }
      const qty = Number(rawQty);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw validationError('Component quantity must be greater than zero', {
          rule: 'quantity_invalid',
          componentVariantId: String(variantId)
        });
      }
      if (comp.minQuantity != null && qty < Number(comp.minQuantity)) {
        throw validationError('Component quantity is below minimum', {
          rule: 'min_quantity',
          componentVariantId: String(variantId),
          min: Number(comp.minQuantity),
          quantity: qty
        });
      }
      if (comp.maxQuantity != null && qty > Number(comp.maxQuantity)) {
        throw validationError('Maximum quantity exceeded', {
          rule: 'max_quantity',
          componentVariantId: String(variantId),
          max: Number(comp.maxQuantity),
          quantity: qty
        });
      }
    }
  }

  return true;
}

/**
 * Resolve per-component quantity (default × bundle qty, with optional override).
 */
function resolveComponentQuantity(comp, bundleQuantity, quantityOverrides) {
  const id = String(comp.componentVariantId);
  const unitQty =
    quantityOverrides && quantityOverrides[id] != null
      ? Number(quantityOverrides[id])
      : Number(comp.quantity) || 0;
  return unitQty * (Number(bundleQuantity) || 1);
}

/**
 * Compute bundle unit price from mode + rollup of included lines.
 */
function computeBundleUnitPrice({
  pricingMode,
  fixedUnitPrice,
  includedLineTotals,
  discountType,
  discountValue
}) {
  const rollup = (includedLineTotals || []).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const mode = pricingMode || CATALOG_BUNDLE_PRICING_DEFAULT;

  if (mode === 'fixed') {
    return {
      bundleUnitPrice: Number(fixedUnitPrice) || 0,
      rollupComponentTotal: rollup,
      priceSource: 'fixed',
      discountApplied: 0
    };
  }

  if (mode === 'discount') {
    let discountApplied = 0;
    if (discountType === 'percent') {
      discountApplied = (rollup * (Number(discountValue) || 0)) / 100;
    } else if (discountType === 'amount') {
      discountApplied = Math.min(Number(discountValue) || 0, rollup);
    }
    const bundleUnitPrice = Math.max(0, rollup - discountApplied);
    return {
      bundleUnitPrice,
      rollupComponentTotal: rollup,
      priceSource: 'discount',
      discountApplied
    };
  }

  // rollup
  return {
    bundleUnitPrice: rollup,
    rollupComponentTotal: rollup,
    priceSource: 'rollup',
    discountApplied: 0
  };
}

module.exports = {
  CATALOG_BUNDLE_TYPES,
  CATALOG_BUNDLE_TYPE_DEFAULT,
  CATALOG_BUNDLE_PRICING_MODES,
  CATALOG_BUNDLE_PRICING_DEFAULT,
  CATALOG_BUNDLE_DISCOUNT_TYPES,
  isCatalogBundleType,
  isCatalogBundlePricingMode,
  isCatalogBundleDiscountType,
  normalizeBundleComponentInput,
  validateBundleDefinition,
  parseBundleDate,
  assertBundleEffective,
  resolveIncludedComponents,
  validateBundleConfiguration,
  resolveComponentQuantity,
  computeBundleUnitPrice
};

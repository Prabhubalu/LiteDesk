const Item = require('../models/Item');
const ItemVariant = require('../models/ItemVariant');
const ItemBundleComponent = require('../models/ItemBundleComponent');
const { getVariantById } = require('./itemVariantService');
const { resolve: resolveCatalogPrice } = require('./catalogPriceResolver');
const {
  CATALOG_BUNDLE_PRICING_DEFAULT,
  CATALOG_BUNDLE_TYPE_DEFAULT,
  normalizeBundleComponentInput,
  validateBundleDefinition,
  parseBundleDate,
  assertBundleEffective,
  resolveIncludedComponents,
  validateBundleConfiguration,
  resolveComponentQuantity,
  computeBundleUnitPrice
} = require('../constants/catalogBundle');
const { CATALOG_SELLABLE_LIFECYCLE_STATES } = require('../constants/catalogLifecycle');

function pickBundleSettings(variant) {
  return {
    bundleType: variant.bundleType || CATALOG_BUNDLE_TYPE_DEFAULT,
    pricingMode: variant.pricingMode || CATALOG_BUNDLE_PRICING_DEFAULT,
    discountType: variant.bundleDiscountType ?? null,
    discountValue: variant.bundleDiscountValue ?? null,
    minOptionalSelection: variant.minOptionalSelection ?? null,
    maxOptionalSelection: variant.maxOptionalSelection ?? null,
    effectiveFrom: variant.bundleEffectiveFrom ?? null,
    effectiveUntil: variant.bundleEffectiveUntil ?? null,
    revision: Number(variant.bundleRevision) || 1
  };
}

async function assertBundleVariant(bundleVariantId, organizationId) {
  const variant = await getVariantById(bundleVariantId, organizationId);
  if (!variant) {
    const err = new Error('Bundle variant not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const item = await Item.findOne({ _id: variant.itemId, organizationId, deletedAt: null })
    .select('item_type item_name description status lifecycle_state item_code')
    .lean();
  if (!item || item.item_type !== 'Bundle') {
    const err = new Error('Variant parent item must be of type Bundle');
    err.code = 'NOT_BUNDLE';
    throw err;
  }
  return { variant, item };
}

async function enrichComponents(organizationId, rows) {
  if (!rows.length) return [];

  const variantIds = [...new Set(rows.map((r) => String(r.componentVariantId)))];
  const variants = await ItemVariant.find({
    organizationId,
    _id: { $in: variantIds }
  }).lean();
  const variantById = new Map(variants.map((v) => [String(v._id), v]));

  const itemIds = [...new Set(variants.map((v) => String(v.itemId)))];
  const items = await Item.find({
    organizationId,
    _id: { $in: itemIds },
    deletedAt: null
  }).select('item_name item_code item_type').lean();
  const itemById = new Map(items.map((i) => [String(i._id), i]));

  return rows.map((row) => {
    const variant = variantById.get(String(row.componentVariantId));
    const item = variant ? itemById.get(String(variant.itemId)) : null;
    return {
      ...row,
      variant_code: variant?.variant_code || null,
      item_id: variant?.itemId || null,
      item_name: item?.item_name || null,
      item_code: item?.item_code || null,
      item_type: item?.item_type || null,
      selling_price: variant?.selling_price ?? 0,
      currency: variant?.currency || 'USD'
    };
  });
}

async function getBundleComponents(bundleVariantId, organizationId) {
  const { variant, item } = await assertBundleVariant(bundleVariantId, organizationId);

  const rows = await ItemBundleComponent.find({ organizationId, bundleVariantId })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const components = await enrichComponents(organizationId, rows);
  const settings = pickBundleSettings(variant);

  return {
    bundleVariantId,
    bundleItemName: item.item_name,
    bundleItemCode: item.item_code,
    ...settings,
    pricingMode: settings.pricingMode,
    components
  };
}

async function replaceBundleComponents({
  bundleVariantId,
  organizationId,
  userId,
  components = [],
  pricingMode,
  bundleType,
  minOptionalSelection,
  maxOptionalSelection,
  discountType,
  discountValue,
  effectiveFrom,
  effectiveUntil
}) {
  const { variant } = await assertBundleVariant(bundleVariantId, organizationId);

  const normalized = components.map(normalizeBundleComponentInput);
  const seen = new Set();

  for (const row of normalized) {
    const key = String(row.componentVariantId);
    if (key === String(bundleVariantId)) {
      const err = new Error('Bundle cannot include itself as a component');
      err.code = 'SELF_REFERENCE';
      throw err;
    }
    if (seen.has(key)) {
      const err = new Error('Duplicate component variant in bundle');
      err.code = 'DUPLICATE_COMPONENT';
      throw err;
    }
    seen.add(key);

    const componentVariant = await getVariantById(row.componentVariantId, organizationId);
    if (!componentVariant) {
      const err = new Error(`Component variant not found: ${row.componentVariantId}`);
      err.code = 'NOT_FOUND';
      throw err;
    }
  }

  const nextPricingMode =
    pricingMode !== undefined ? pricingMode : variant.pricingMode || CATALOG_BUNDLE_PRICING_DEFAULT;
  const nextBundleType =
    bundleType !== undefined ? bundleType : variant.bundleType || CATALOG_BUNDLE_TYPE_DEFAULT;
  const nextMin =
    minOptionalSelection !== undefined ? minOptionalSelection : variant.minOptionalSelection;
  const nextMax =
    maxOptionalSelection !== undefined ? maxOptionalSelection : variant.maxOptionalSelection;
  const nextDiscountType =
    discountType !== undefined ? discountType : variant.bundleDiscountType;
  const nextDiscountValue =
    discountValue !== undefined ? discountValue : variant.bundleDiscountValue;

  const validated = validateBundleDefinition({
    bundleType: nextBundleType,
    pricingMode: nextPricingMode,
    components: normalized,
    minOptionalSelection: nextMin,
    maxOptionalSelection: nextMax,
    discountType: nextDiscountType,
    discountValue: nextDiscountValue
  });

  const fromDate =
    effectiveFrom !== undefined
      ? parseBundleDate(effectiveFrom)
      : variant.bundleEffectiveFrom ?? null;
  const untilDate =
    effectiveUntil !== undefined
      ? parseBundleDate(effectiveUntil)
      : variant.bundleEffectiveUntil ?? null;

  if (fromDate && untilDate && fromDate > untilDate) {
    const err = new Error('Effective From cannot be after Effective Until');
    err.code = 'VALIDATION';
    throw err;
  }

  const nextRevision = (Number(variant.bundleRevision) || 1) + 1;

  await ItemVariant.updateOne(
    { _id: bundleVariantId, organizationId },
    {
      $set: {
        pricingMode: validated.pricingMode,
        bundleType: validated.bundleType,
        minOptionalSelection: validated.minOptionalSelection,
        maxOptionalSelection: validated.maxOptionalSelection,
        bundleDiscountType: validated.discountType,
        bundleDiscountValue: validated.discountValue,
        bundleEffectiveFrom: fromDate,
        bundleEffectiveUntil: untilDate,
        bundleRevision: nextRevision,
        modifiedBy: userId
      }
    }
  );

  await ItemBundleComponent.deleteMany({ organizationId, bundleVariantId });

  if (normalized.length) {
    await ItemBundleComponent.insertMany(
      normalized.map((row, index) => ({
        organizationId,
        bundleVariantId,
        componentVariantId: row.componentVariantId,
        quantity: row.quantity,
        isOptional: row.isOptional,
        defaultSelected: row.defaultSelected,
        editableQuantity: row.editableQuantity,
        minQuantity: row.minQuantity,
        maxQuantity: row.maxQuantity,
        remarks: row.remarks || '',
        sortOrder: row.sortOrder ?? index,
        createdBy: userId,
        modifiedBy: userId
      }))
    );
  }

  return getBundleComponents(bundleVariantId, organizationId);
}

async function searchVariants(organizationId, { q = '', excludeVariantId = null, limit = 20 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const trimmedQ = String(q || '').trim();

  const activeItemIds = await Item.distinct('_id', {
    organizationId,
    deletedAt: null,
    item_type: { $ne: 'Bundle' }
  });
  if (!activeItemIds.length) return [];

  const filter = {
    organizationId,
    itemId: { $in: activeItemIds },
    lifecycle_state: { $in: CATALOG_SELLABLE_LIFECYCLE_STATES }
  };

  if (excludeVariantId) {
    filter._id = { $ne: excludeVariantId };
  }

  if (trimmedQ) {
    const regex = new RegExp(trimmedQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const nameItems = await Item.find({
      organizationId,
      deletedAt: null,
      item_type: { $ne: 'Bundle' },
      $or: [{ item_name: regex }, { item_code: regex }]
    })
      .select('_id')
      .limit(100)
      .lean();
    const nameItemIds = nameItems.map((i) => i._id);

    filter.$or = [
      { variant_code: regex },
      { barcode: regex },
      ...(nameItemIds.length ? [{ itemId: { $in: nameItemIds } }] : [])
    ];
  }

  const variants = await ItemVariant.find(filter)
    .sort({ is_default: -1, variant_code: 1 })
    .limit(cap)
    .lean();

  if (!variants.length) return [];

  const itemIds = [...new Set(variants.map((v) => v.itemId))];
  const items = await Item.find({
    organizationId,
    _id: { $in: itemIds },
    deletedAt: null
  })
    .select('item_name item_code item_type itemGroupId')
    .lean();
  const itemById = new Map(items.map((i) => [String(i._id), i]));

  return variants
    .filter((v) => itemById.has(String(v.itemId)))
    .map((v) => {
      const item = itemById.get(String(v.itemId));
      const itemGroupId = v.itemGroupId || item?.itemGroupId || null;
      return {
        _id: v._id,
        variant_code: v.variant_code,
        item_id: v.itemId,
        item_name: item?.item_name || null,
        item_code: item?.item_code || null,
        item_type: item?.item_type || null,
        itemGroupId,
        selling_price: v.selling_price ?? 0,
        currency: v.currency || 'USD',
        is_default: v.is_default
      };
    });
}

/**
 * Expand + price a bundle configuration.
 * @param {object} opts
 * @param {string[]|null} [opts.includedOptionalComponentVariantIds] — omit to use defaultSelected
 * @param {Record<string, number>|null} [opts.componentQuantities] — overrides for editable qty
 * @param {boolean} [opts.validate=true]
 */
async function expandBundlePreview({
  organizationId,
  bundleVariantId,
  priceBookId = null,
  quantity = 1,
  asOfDate = null,
  includedOptionalComponentVariantIds = undefined,
  componentQuantities = null,
  validate = true
}) {
  const { variant, item } = await assertBundleVariant(bundleVariantId, organizationId);
  const definition = await getBundleComponents(bundleVariantId, organizationId);
  const settings = {
    bundleType: definition.bundleType,
    pricingMode: definition.pricingMode,
    discountType: definition.discountType,
    discountValue: definition.discountValue,
    minOptionalSelection: definition.minOptionalSelection,
    maxOptionalSelection: definition.maxOptionalSelection,
    effectiveFrom: definition.effectiveFrom,
    effectiveUntil: definition.effectiveUntil,
    revision: definition.revision
  };

  if (validate) {
    assertBundleEffective({
      effectiveFrom: settings.effectiveFrom,
      effectiveUntil: settings.effectiveUntil,
      asOfDate
    });
    if (!definition.components.length) {
      const err = new Error('Bundle has no components');
      err.code = 'VALIDATION';
      err.details = { rule: 'empty_bundle' };
      throw err;
    }
  }

  const { includedIds, selectedOptionalCount } = resolveIncludedComponents(
    definition.components,
    includedOptionalComponentVariantIds === undefined
      ? null
      : includedOptionalComponentVariantIds
  );

  if (validate) {
    validateBundleConfiguration({
      bundleType: settings.bundleType,
      components: definition.components,
      includedIds,
      selectedOptionalCount,
      minOptionalSelection: settings.minOptionalSelection,
      maxOptionalSelection: settings.maxOptionalSelection,
      quantityOverrides: componentQuantities
    });
  }

  const lines = [];
  const includedLineTotals = [];

  for (const comp of definition.components) {
    const id = String(comp.componentVariantId);
    const included = includedIds.has(id);
    const unitQty =
      componentQuantities && componentQuantities[id] != null
        ? Number(componentQuantities[id])
        : Number(comp.quantity) || 0;
    const componentQty = unitQty * (Number(quantity) || 1);

    const resolved = await resolveCatalogPrice({
      organizationId,
      variantId: comp.componentVariantId,
      priceBookId,
      quantity: componentQty > 0 ? componentQty : unitQty || 1,
      asOfDate
    });
    const lineTotal = (Number(resolved.unitPrice) || 0) * unitQty;
    if (included) includedLineTotals.push(lineTotal);

    lines.push({
      componentVariantId: comp.componentVariantId,
      variant_code: comp.variant_code,
      item_name: comp.item_name,
      quantity: unitQty,
      isOptional: comp.isOptional === true,
      defaultSelected: comp.defaultSelected === true,
      editableQuantity: comp.editableQuantity === true,
      minQuantity: comp.minQuantity,
      maxQuantity: comp.maxQuantity,
      remarks: comp.remarks || '',
      included,
      unitPrice: resolved.unitPrice,
      currency: resolved.currency,
      lineTotal: included ? lineTotal : 0,
      priceSource: resolved.source
    });
  }

  const bundleResolved = await resolveCatalogPrice({
    organizationId,
    variantId: bundleVariantId,
    priceBookId,
    quantity,
    asOfDate
  });

  const priced = computeBundleUnitPrice({
    pricingMode: settings.pricingMode,
    fixedUnitPrice: bundleResolved.unitPrice,
    includedLineTotals,
    discountType: settings.discountType,
    discountValue: settings.discountValue
  });

  return {
    bundleVariantId,
    bundleItemName: item.item_name,
    bundleType: settings.bundleType,
    pricingMode: settings.pricingMode,
    revision: settings.revision,
    discountType: settings.discountType,
    discountValue: settings.discountValue,
    discountApplied: priced.discountApplied,
    minOptionalSelection: settings.minOptionalSelection,
    maxOptionalSelection: settings.maxOptionalSelection,
    effectiveFrom: settings.effectiveFrom,
    effectiveUntil: settings.effectiveUntil,
    selectedOptionalCount,
    bundleUnitPrice: priced.bundleUnitPrice,
    bundlePriceSource: priced.priceSource === 'fixed' ? bundleResolved.source : priced.priceSource,
    rollupComponentTotal: priced.rollupComponentTotal,
    currency: bundleResolved.currency,
    lines,
    valid: true
  };
}

/**
 * Validate a commercial configuration without full price expand.
 * Throws VALIDATION / NOT_FOUND errors.
 */
async function validateBundleForCommercial({
  organizationId,
  bundleVariantId,
  asOfDate = null,
  includedOptionalComponentVariantIds = undefined,
  componentQuantities = null
}) {
  const definition = await getBundleComponents(bundleVariantId, organizationId);
  assertBundleEffective({
    effectiveFrom: definition.effectiveFrom,
    effectiveUntil: definition.effectiveUntil,
    asOfDate
  });

  const { includedIds, selectedOptionalCount } = resolveIncludedComponents(
    definition.components,
    includedOptionalComponentVariantIds === undefined
      ? null
      : includedOptionalComponentVariantIds
  );

  validateBundleConfiguration({
    bundleType: definition.bundleType,
    components: definition.components,
    includedIds,
    selectedOptionalCount,
    minOptionalSelection: definition.minOptionalSelection,
    maxOptionalSelection: definition.maxOptionalSelection,
    quantityOverrides: componentQuantities
  });

  return {
    definition,
    includedIds,
    selectedOptionalCount
  };
}

function buildBundleSnapshot({ definition, preview, includedIds }) {
  return {
    bundleVariantId: String(definition.bundleVariantId),
    bundleType: definition.bundleType,
    pricingMode: definition.pricingMode,
    revision: definition.revision,
    discountType: definition.discountType,
    discountValue: definition.discountValue,
    discountApplied: preview?.discountApplied ?? 0,
    rollupComponentTotal: Number(preview?.rollupComponentTotal) || 0,
    minOptionalSelection: definition.minOptionalSelection,
    maxOptionalSelection: definition.maxOptionalSelection,
    components: (definition.components || []).map((c) => ({
      componentVariantId: String(c.componentVariantId),
      quantity: Number(c.quantity) || 0,
      isOptional: c.isOptional === true,
      defaultSelected: c.defaultSelected === true,
      editableQuantity: c.editableQuantity === true,
      minQuantity: c.minQuantity,
      maxQuantity: c.maxQuantity,
      remarks: c.remarks || '',
      sortOrder: Number(c.sortOrder) || 0,
      included: includedIds ? includedIds.has(String(c.componentVariantId)) : !c.isOptional
    }))
  };
}

module.exports = {
  getBundleComponents,
  replaceBundleComponents,
  searchVariants,
  expandBundlePreview,
  validateBundleForCommercial,
  resolveIncludedComponents,
  resolveComponentQuantity,
  buildBundleSnapshot,
  pickBundleSettings
};

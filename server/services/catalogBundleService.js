const Item = require('../models/Item');
const ItemVariant = require('../models/ItemVariant');
const ItemBundleComponent = require('../models/ItemBundleComponent');
const { getVariantById } = require('./itemVariantService');
const { resolve: resolveCatalogPrice } = require('./catalogPriceResolver');
const {
  isCatalogBundlePricingMode,
  CATALOG_BUNDLE_PRICING_DEFAULT
} = require('../constants/catalogBundle');

function normalizeComponentPayload(row) {
  const componentVariantId = row.componentVariantId;
  if (!componentVariantId) {
    const err = new Error('Each component requires componentVariantId');
    err.code = 'VALIDATION';
    throw err;
  }
  const quantity = Number(row.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    const err = new Error('Component quantity must be greater than zero');
    err.code = 'VALIDATION';
    throw err;
  }
  return {
    componentVariantId,
    quantity,
    isOptional: row.isOptional === true,
    sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : 0
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
    .select('item_type item_name')
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
  await assertBundleVariant(bundleVariantId, organizationId);

  const rows = await ItemBundleComponent.find({ organizationId, bundleVariantId })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const variant = await getVariantById(bundleVariantId, organizationId);
  const components = await enrichComponents(organizationId, rows);

  return {
    bundleVariantId,
    pricingMode: variant.pricingMode || CATALOG_BUNDLE_PRICING_DEFAULT,
    components
  };
}

async function replaceBundleComponents({
  bundleVariantId,
  organizationId,
  userId,
  components = [],
  pricingMode
}) {
  const { variant } = await assertBundleVariant(bundleVariantId, organizationId);

  const normalized = components.map(normalizeComponentPayload);
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

  if (pricingMode !== undefined) {
    if (!isCatalogBundlePricingMode(pricingMode)) {
      const err = new Error('pricingMode must be fixed or rollup');
      err.code = 'VALIDATION';
      throw err;
    }
    await ItemVariant.updateOne(
      { _id: bundleVariantId, organizationId },
      { $set: { pricingMode, modifiedBy: userId } }
    );
  }

  await ItemBundleComponent.deleteMany({ organizationId, bundleVariantId });

  if (normalized.length) {
    await ItemBundleComponent.insertMany(
      normalized.map((row, index) => ({
        organizationId,
        bundleVariantId,
        componentVariantId: row.componentVariantId,
        quantity: row.quantity,
        isOptional: row.isOptional,
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
  const filter = { organizationId };

  if (excludeVariantId) {
    filter._id = { $ne: excludeVariantId };
  }

  if (q && String(q).trim()) {
    const regex = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const items = await Item.find({
      organizationId,
      deletedAt: null,
      $or: [{ item_name: regex }, { item_code: regex }]
    }).select('_id').limit(100).lean();
    const itemIds = items.map((i) => i._id);

    filter.$or = [
      { variant_code: regex },
      { barcode: regex },
      ...(itemIds.length ? [{ itemId: { $in: itemIds } }] : [])
    ];
  }

  const variants = await ItemVariant.find(filter)
    .sort({ is_default: -1, variant_code: 1 })
    .limit(cap)
    .lean();

  if (!variants.length) return [];

  const itemIds = [...new Set(variants.map((v) => String(v.itemId)))];
  const items = await Item.find({
    organizationId,
    _id: { $in: itemIds },
    deletedAt: null
  }).select('item_name item_code item_type').lean();
  const itemById = new Map(items.map((i) => [String(i._id), i]));

  return variants.map((v) => {
    const item = itemById.get(String(v.itemId));
    return {
      _id: v._id,
      variant_code: v.variant_code,
      item_id: v.itemId,
      item_name: item?.item_name || null,
      item_code: item?.item_code || null,
      item_type: item?.item_type || null,
      selling_price: v.selling_price ?? 0,
      currency: v.currency || 'USD',
      is_default: v.is_default
    };
  });
}

async function expandBundlePreview({
  organizationId,
  bundleVariantId,
  priceBookId = null,
  quantity = 1,
  asOfDate = null
}) {
  const { variant, item } = await assertBundleVariant(bundleVariantId, organizationId);
  const { components, pricingMode } = await getBundleComponents(bundleVariantId, organizationId);

  const lines = [];
  let rollupTotal = 0;

  for (const comp of components) {
    const resolved = await resolveCatalogPrice({
      organizationId,
      variantId: comp.componentVariantId,
      priceBookId,
      quantity: comp.quantity * (Number(quantity) || 1),
      asOfDate
    });
    const lineTotal = resolved.unitPrice * comp.quantity;
    rollupTotal += lineTotal;
    lines.push({
      componentVariantId: comp.componentVariantId,
      variant_code: comp.variant_code,
      item_name: comp.item_name,
      quantity: comp.quantity,
      isOptional: comp.isOptional,
      unitPrice: resolved.unitPrice,
      currency: resolved.currency,
      lineTotal,
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

  const mode = pricingMode || variant.pricingMode || CATALOG_BUNDLE_PRICING_DEFAULT;
  const bundleUnitPrice = mode === 'rollup' ? rollupTotal : bundleResolved.unitPrice;

  return {
    bundleVariantId,
    bundleItemName: item.item_name,
    pricingMode: mode,
    bundleUnitPrice,
    bundlePriceSource: mode === 'rollup' ? 'rollup' : bundleResolved.source,
    rollupComponentTotal: rollupTotal,
    currency: bundleResolved.currency,
    lines
  };
}

module.exports = {
  getBundleComponents,
  replaceBundleComponents,
  searchVariants,
  expandBundlePreview
};

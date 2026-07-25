const Item = require('../models/Item');
const ItemVariant = require('../models/ItemVariant');
const {
  CATALOG_LIFECYCLE_DEFAULT,
  isCatalogLifecycleState,
  inferLifecycleStateFromLegacyStatus
} = require('../constants/catalogLifecycle');
const {
  isCatalogBarcodeType,
  inferBarcodeTypeFromValue
} = require('../constants/catalogBarcode');
const { isCatalogBundlePricingMode } = require('../constants/catalogBundle');
const { buildItemCompatFieldsFromVariant } = require('../constants/catalogFieldOwnership');

async function findBarcodeConflict(organizationId, barcode, excludeVariantId = null) {
  if (!barcode || !String(barcode).trim()) return null;
  const query = {
    organizationId,
    barcode: String(barcode).trim()
  };
  if (excludeVariantId) {
    query._id = { $ne: excludeVariantId };
  }
  return ItemVariant.findOne(query).select('_id variant_code itemId').lean();
}

async function listItemVariants(itemId, organizationId) {
  return ItemVariant.find({ organizationId, itemId })
    .sort({ is_default: -1, createdAt: 1 })
    .lean();
}

async function getVariantById(variantId, organizationId) {
  return ItemVariant.findOne({ _id: variantId, organizationId }).lean();
}

async function syncDefaultVariantLifecycleFromItem(item, userId) {
  if (!item?._id || !item.lifecycle_state) return;
  await ItemVariant.updateOne(
    {
      organizationId: item.organizationId,
      itemId: item._id,
      is_default: true
    },
    {
      $set: {
        lifecycle_state: item.lifecycle_state,
        modifiedBy: userId
      }
    }
  );
}

async function refreshItemVariantLinkage(itemId, organizationId) {
  const [defaultVariant, count] = await Promise.all([
    ItemVariant.findOne({ organizationId, itemId, is_default: true }).select('_id').lean(),
    ItemVariant.countDocuments({ organizationId, itemId })
  ]);

  await Item.updateOne(
    { _id: itemId, organizationId },
    {
      $set: {
        defaultVariantId: defaultVariant?._id || null,
        hasVariants: count > 1
      }
    }
  );
}

async function syncItemCompatFromDefaultVariant(item, userId) {
  const variant = await ItemVariant.findOne({
    organizationId: item.organizationId,
    itemId: item._id,
    is_default: true
  });

  if (!variant) return item;

  const compat = buildItemCompatFieldsFromVariant(variant);
  Object.assign(item, compat);
  item.defaultVariantId = variant._id;
  item.modifiedBy = userId;
  await item.save();
  await refreshItemVariantLinkage(item._id, item.organizationId);
  return item;
}

function sellableFieldsFromItem(item, variantPayload = {}) {
  const lifecycle = variantPayload.lifecycle_state && isCatalogLifecycleState(variantPayload.lifecycle_state)
    ? variantPayload.lifecycle_state
    : (item.lifecycle_state
      || inferLifecycleStateFromLegacyStatus(item.status, item.lifecycle_state)
      || CATALOG_LIFECYCLE_DEFAULT);

  const barcode = variantPayload.barcode !== undefined ? variantPayload.barcode : item.barcode;
  const barcodeType = variantPayload.barcode_type && isCatalogBarcodeType(variantPayload.barcode_type)
    ? variantPayload.barcode_type
    : (item.barcode_type && isCatalogBarcodeType(item.barcode_type)
      ? item.barcode_type
      : inferBarcodeTypeFromValue(barcode));

  return {
    variant_code: variantPayload.variant_code ?? item.item_code ?? item.item_id ?? String(item._id),
    lifecycle_state: lifecycle,
    unit_of_measure: variantPayload.unit_of_measure ?? item.unit_of_measure,
    selling_price: variantPayload.selling_price ?? item.selling_price ?? 0,
    cost_price: variantPayload.cost_price ?? item.cost_price ?? 0,
    currency: variantPayload.currency ?? item.currency ?? 'USD',
    tax_type: variantPayload.tax_type ?? item.tax_type ?? 'None',
    tax_percentage: variantPayload.tax_percentage ?? item.tax_percentage ?? 0,
    commission_rate: variantPayload.commission_rate ?? item.commission_rate ?? 0,
    barcode: barcode || undefined,
    barcode_type: barcodeType,
    qr_payload: variantPayload.qr_payload ?? item.qr_payload
  };
}

async function ensureDefaultVariant(item, userId) {
  if (!item?._id) return null;

  const existing = await ItemVariant.findOne({
    organizationId: item.organizationId,
    itemId: item._id,
    is_default: true
  });

  if (existing) {
    await refreshItemVariantLinkage(item._id, item.organizationId);
    return existing;
  }

  const fields = sellableFieldsFromItem(item, {});
  const variant = await ItemVariant.create({
    organizationId: item.organizationId,
    itemId: item._id,
    is_default: true,
    ...fields,
    createdBy: userId,
    modifiedBy: userId
  });

  await syncItemCompatFromDefaultVariant(item, userId);
  return variant;
}

async function upsertDefaultVariantFields({ item, userId, variantPayload = {} }) {
  if (!item?._id) return null;

  let variant = await ItemVariant.findOne({
    organizationId: item.organizationId,
    itemId: item._id,
    is_default: true
  });

  const fields = sellableFieldsFromItem(item, variantPayload);

  if (variant) {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        variant[key] = value;
      }
    }
    if (variantPayload.barcode !== undefined && variantPayload.barcode) {
      const conflict = await findBarcodeConflict(item.organizationId, variantPayload.barcode, variant._id);
      if (conflict) {
        const err = new Error('Barcode already assigned to another variant');
        err.code = 'BARCODE_CONFLICT';
        throw err;
      }
    }
    variant.modifiedBy = userId;
    await variant.save();
  } else {
    if (fields.barcode) {
      const conflict = await findBarcodeConflict(item.organizationId, fields.barcode);
      if (conflict) {
        const err = new Error('Barcode already assigned to another variant');
        err.code = 'BARCODE_CONFLICT';
        throw err;
      }
    }
    variant = await ItemVariant.create({
      organizationId: item.organizationId,
      itemId: item._id,
      is_default: true,
      ...fields,
      createdBy: userId,
      modifiedBy: userId
    });
  }

  await syncItemCompatFromDefaultVariant(item, userId);
  return variant;
}

async function createItemVariant({ item, userId, payload }) {
  const lifecycle = payload.lifecycle_state && isCatalogLifecycleState(payload.lifecycle_state)
    ? payload.lifecycle_state
    : (item.lifecycle_state || CATALOG_LIFECYCLE_DEFAULT);

  if (payload.barcode) {
    const conflict = await findBarcodeConflict(item.organizationId, payload.barcode);
    if (conflict) {
      const err = new Error('Barcode already assigned to another variant');
      err.code = 'BARCODE_CONFLICT';
      throw err;
    }
  }

  const barcodeType = payload.barcode_type && isCatalogBarcodeType(payload.barcode_type)
    ? payload.barcode_type
    : inferBarcodeTypeFromValue(payload.barcode);

  const variant = await ItemVariant.create({
    organizationId: item.organizationId,
    itemId: item._id,
    variant_code: payload.variant_code || `${item.item_code || item.item_id || 'VAR'}-${Date.now()}`,
    barcode: payload.barcode || undefined,
    barcode_type: barcodeType,
    qr_payload: payload.qr_payload,
    is_default: false,
    lifecycle_state: lifecycle,
    unit_of_measure: payload.unit_of_measure || item.unit_of_measure,
    selling_price: payload.selling_price ?? item.selling_price ?? 0,
    cost_price: payload.cost_price ?? item.cost_price ?? 0,
    currency: payload.currency || item.currency || 'USD',
    tax_type: payload.tax_type || item.tax_type || 'None',
    tax_percentage: payload.tax_percentage ?? item.tax_percentage ?? 0,
    commission_rate: payload.commission_rate ?? item.commission_rate ?? 0,
    createdBy: userId,
    modifiedBy: userId
  });

  await refreshItemVariantLinkage(item._id, item.organizationId);
  try {
    const { enqueueAfterItemVariantSave } = require('./connectors/tally/tallyOutboxHooks');
    await enqueueAfterItemVariantSave({
      organizationId: item.organizationId,
      variant,
    });
  } catch (err) {
    console.warn('[itemVariantService] tally outbox hook failed', err.message);
  }
  return variant;
}

async function updateItemVariant({ variantId, organizationId, userId, payload }) {
  const variant = await ItemVariant.findOne({ _id: variantId, organizationId });
  if (!variant) return null;

  if (payload.barcode !== undefined && payload.barcode) {
    const conflict = await findBarcodeConflict(organizationId, payload.barcode, variantId);
    if (conflict) {
      const err = new Error('Barcode already assigned to another variant');
      err.code = 'BARCODE_CONFLICT';
      throw err;
    }
    variant.barcode = String(payload.barcode).trim();
    if (!payload.barcode_type) {
      variant.barcode_type = inferBarcodeTypeFromValue(variant.barcode);
    }
  }

  if (payload.barcode_type && isCatalogBarcodeType(payload.barcode_type)) {
    variant.barcode_type = payload.barcode_type;
  }
  if (payload.qr_payload !== undefined) variant.qr_payload = payload.qr_payload;
  if (payload.variant_code !== undefined) variant.variant_code = payload.variant_code;
  if (payload.lifecycle_state && isCatalogLifecycleState(payload.lifecycle_state)) {
    variant.lifecycle_state = payload.lifecycle_state;
  }
  if (payload.unit_of_measure !== undefined) {
    const nextUom = typeof payload.unit_of_measure === 'string'
      ? payload.unit_of_measure.trim()
      : payload.unit_of_measure;
    // Treat empty string as "unset/no change" so we don't violate Item/Variant enums.
    if (nextUom !== '') {
      variant.unit_of_measure = nextUom;
    }
  }
  if (payload.selling_price !== undefined) variant.selling_price = payload.selling_price;
  if (payload.cost_price !== undefined) variant.cost_price = payload.cost_price;
  if (payload.currency !== undefined) variant.currency = payload.currency;
  if (payload.tax_type !== undefined) variant.tax_type = payload.tax_type;
  if (payload.tax_percentage !== undefined) variant.tax_percentage = payload.tax_percentage;
  if (payload.commission_rate !== undefined) variant.commission_rate = payload.commission_rate;
  if (payload.pricingMode !== undefined && isCatalogBundlePricingMode(payload.pricingMode)) {
    variant.pricingMode = payload.pricingMode;
  }

  variant.modifiedBy = userId;
  await variant.save();

  try {
    const { enqueueAfterItemVariantSave } = require('./connectors/tally/tallyOutboxHooks');
    await enqueueAfterItemVariantSave({
      organizationId,
      variant,
    });
  } catch (err) {
    console.warn('[itemVariantService] tally outbox hook (update) failed', err.message);
  }

  if (variant.is_default) {
    const item = await Item.findOne({ _id: variant.itemId, organizationId, deletedAt: null });
    if (item) {
      await syncItemCompatFromDefaultVariant(item, userId);
    }
  }

  return variant;
}

module.exports = {
  findBarcodeConflict,
  listItemVariants,
  getVariantById,
  ensureDefaultVariant,
  upsertDefaultVariantFields,
  syncItemCompatFromDefaultVariant,
  syncDefaultVariantLifecycleFromItem,
  refreshItemVariantLinkage,
  createItemVariant,
  updateItemVariant
};

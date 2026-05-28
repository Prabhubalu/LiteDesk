const Item = require('../models/Item');
const {
  splitItemPayload,
  hasVariantPayloadFields,
  buildItemCompatFieldsFromVariant
} = require('../constants/catalogFieldOwnership');
const {
  ensureDefaultVariant,
  upsertDefaultVariantFields,
  syncItemCompatFromDefaultVariant,
  refreshItemVariantLinkage,
  syncDefaultVariantLifecycleFromItem
} = require('./itemVariantService');

/**
 * After item create/update: persist sellable fields on default variant and dual-write compat on Item.
 */
async function applyVariantWriteAfterItemSave({ item, userId, rawPayload = {} }) {
  if (!item?._id) return null;

  const { variantPayload } = splitItemPayload(rawPayload);
  let variant;

  if (hasVariantPayloadFields(variantPayload)) {
    variant = await upsertDefaultVariantFields({ item, userId, variantPayload });
  } else {
    variant = await ensureDefaultVariant(item, userId);
    await syncDefaultVariantLifecycleFromItem(item, userId);
    await syncItemCompatFromDefaultVariant(item, userId);
  }

  await refreshItemVariantLinkage(item._id, item.organizationId);
  return variant;
}

async function applyVariantWriteOnItemUpdate({ itemId, organizationId, userId, rawPayload = {} }) {
  const item = await Item.findOne({ _id: itemId, organizationId, deletedAt: null });
  if (!item) return null;

  const { variantPayload } = splitItemPayload(rawPayload);
  if (!hasVariantPayloadFields(variantPayload)) {
    return null;
  }

  const variant = await upsertDefaultVariantFields({ item, userId, variantPayload });
  await refreshItemVariantLinkage(item._id, organizationId);
  return variant;
}

function setCatalogApiVersionHeader(res) {
  if (res?.set) {
    res.set('X-Catalog-Api-Version', '2');
  }
}

module.exports = {
  applyVariantWriteAfterItemSave,
  applyVariantWriteOnItemUpdate,
  setCatalogApiVersionHeader,
  buildItemCompatFieldsFromVariant
};

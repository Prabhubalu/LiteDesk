/**
 * Stockroom add-on activation — Primary Stockroom + settings marker (idempotent).
 * No multi-doc transactions: safe on standalone Mongo (local) and replica sets.
 */

const InventoryLocation = require('../models/InventoryLocation');
const ItemInventory = require('../models/ItemInventory');
const OrganizationInventorySettings = require('../models/OrganizationInventorySettings');
const { ensureMainWarehouse } = require('./inventoryLocationService');
const {
  DEFAULT_MAIN_WAREHOUSE_CODE,
  DEFAULT_MAIN_WAREHOUSE_NAME
} = require('../constants/inventoryLifecycle');

/**
 * Activate multi-stockroom support: ensure Primary/Main warehouse exists,
 * mark systemGenerated, set org stockroomAddonActivatedAt (idempotent).
 */
async function activateStockroomAddon({ organizationId, userId = null, primaryName = null }) {
  let primary = await InventoryLocation.findOne({
    organizationId,
    locationCode: DEFAULT_MAIN_WAREHOUSE_CODE
  });

  if (!primary) {
    const created = await ensureMainWarehouse(organizationId, userId);
    primary = await InventoryLocation.findOne({
      organizationId,
      inventoryLocationId: created.inventoryLocationId
    });
  }

  if (!primary) {
    throw Object.assign(new Error('Failed to create primary stockroom'), { code: 'ACTIVATION_FAILED' });
  }

  let changed = false;
  if (!primary.systemGenerated) {
    primary.systemGenerated = true;
    changed = true;
  }
  if (!primary.isDefault) {
    primary.isDefault = true;
    changed = true;
  }
  if (primaryName && String(primaryName).trim() && primary.name !== String(primaryName).trim()) {
    primary.name = String(primaryName).trim();
    changed = true;
  } else if (!primary.name) {
    primary.name = DEFAULT_MAIN_WAREHOUSE_NAME;
    changed = true;
  }
  if (changed) {
    primary.modifiedBy = userId;
    await primary.save();
  }

  let settings = await OrganizationInventorySettings.findOne({ organizationId });
  if (!settings) {
    settings = await OrganizationInventorySettings.create({
      organizationId,
      defaultInventoryLocationId: primary.inventoryLocationId,
      stockroomAddonActivatedAt: new Date()
    });
  } else if (!settings.stockroomAddonActivatedAt) {
    settings.stockroomAddonActivatedAt = new Date();
    settings.defaultInventoryLocationId = primary.inventoryLocationId;
    await settings.save();
  } else if (
    !settings.defaultInventoryLocationId ||
    String(settings.defaultInventoryLocationId) !== String(primary.inventoryLocationId)
  ) {
    settings.defaultInventoryLocationId = primary.inventoryLocationId;
    await settings.save();
  }

  const balanceCount = await ItemInventory.countDocuments({
    organizationId,
    inventoryLocationId: primary.inventoryLocationId
  });

  return {
    primaryStockroom: primary.toObject(),
    balanceCount,
    activated: true,
    activatedAt: settings.stockroomAddonActivatedAt
  };
}

module.exports = {
  activateStockroomAddon
};

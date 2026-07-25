/**
 * INV0 — Inventory locations + Main Warehouse bootstrap.
 */

const InventoryLocation = require('../models/InventoryLocation');
const OrganizationInventorySettings = require('../models/OrganizationInventorySettings');
const {
  DEFAULT_MAIN_WAREHOUSE_CODE,
  DEFAULT_MAIN_WAREHOUSE_NAME,
  INVENTORY_LOCATION_STATUS_DEFAULT
} = require('../constants/inventoryLifecycle');
const { writeInventoryActivity } = require('./inventoryActivityService');

async function ensureMainWarehouse(organizationId, userId = null) {
  let location = await InventoryLocation.findOne({
    organizationId,
    locationCode: DEFAULT_MAIN_WAREHOUSE_CODE
  });

  if (!location) {
    location = await InventoryLocation.create({
      organizationId,
      locationCode: DEFAULT_MAIN_WAREHOUSE_CODE,
      name: DEFAULT_MAIN_WAREHOUSE_NAME,
      locationType: 'warehouse',
      status: INVENTORY_LOCATION_STATUS_DEFAULT,
      isDefault: true,
      systemGenerated: true,
      createdBy: userId || null,
      modifiedBy: userId || null
    });

    await writeInventoryActivity({
      organizationId,
      recordId: location.inventoryLocationId,
      userId,
      action: 'inventory_location_created',
      message: `Default location ${DEFAULT_MAIN_WAREHOUSE_NAME} created`,
      details: { inventoryLocationId: location.inventoryLocationId, locationCode: location.locationCode }
    });
  }

  const settings = await OrganizationInventorySettings.findOne({ organizationId });
  if (!settings) {
    await OrganizationInventorySettings.create({
      organizationId,
      defaultInventoryLocationId: location.inventoryLocationId
    });
  } else if (!settings.defaultInventoryLocationId) {
    settings.defaultInventoryLocationId = location.inventoryLocationId;
    await settings.save();
  }

  return location.toObject();
}

async function getDefaultLocation(organizationId, userId = null) {
  const settings = await OrganizationInventorySettings.findOne({ organizationId }).lean();
  if (settings?.defaultInventoryLocationId) {
    const byId = await InventoryLocation.findOne({
      organizationId,
      inventoryLocationId: settings.defaultInventoryLocationId,
      status: 'active'
    }).lean();
    if (byId) return byId;
  }

  const defaultLoc = await InventoryLocation.findOne({
    organizationId,
    isDefault: true,
    status: 'active'
  }).lean();

  if (defaultLoc) return defaultLoc;

  return ensureMainWarehouse(organizationId, userId);
}

async function listLocations({ organizationId, status = null }) {
  await ensureMainWarehouse(organizationId);
  const query = { organizationId };
  if (status) query.status = status;
  return InventoryLocation.find(query).sort({ isDefault: -1, name: 1 }).lean();
}

async function createLocation({
  organizationId,
  userId,
  locationCode,
  name,
  locationType = 'warehouse',
  allowNegative = false,
  isDefault = false
}) {
  await ensureMainWarehouse(organizationId, userId);

  if (isDefault) {
    await InventoryLocation.updateMany(
      { organizationId, isDefault: true },
      { $set: { isDefault: false } }
    );
  }

  const location = await InventoryLocation.create({
    organizationId,
    locationCode: String(locationCode || '').trim().toUpperCase(),
    name: String(name || '').trim(),
    locationType,
    allowNegative: Boolean(allowNegative),
    isDefault: Boolean(isDefault),
    createdBy: userId || null,
    modifiedBy: userId || null
  });

  if (location.isDefault) {
    await OrganizationInventorySettings.updateOne(
      { organizationId },
      { $set: { defaultInventoryLocationId: location.inventoryLocationId } },
      { upsert: true }
    );
  }

  await writeInventoryActivity({
    organizationId,
    recordId: location.inventoryLocationId,
    userId,
    action: 'inventory_location_created',
    message: `Location ${location.name} created`,
    details: { inventoryLocationId: location.inventoryLocationId }
  });

  return location.toObject();
}

async function getLocationById({ organizationId, inventoryLocationId }) {
  return InventoryLocation.findOne({ organizationId, inventoryLocationId }).lean();
}

async function assertActiveLocation({ organizationId, inventoryLocationId }) {
  const location = await getLocationById({ organizationId, inventoryLocationId });
  if (!location) {
    const err = new Error('Inventory location not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (location.status !== 'active') {
    const err = new Error('Inventory location is not active');
    err.code = 'LOCATION_INACTIVE';
    throw err;
  }
  return location;
}

module.exports = {
  ensureMainWarehouse,
  getDefaultLocation,
  listLocations,
  createLocation,
  getLocationById,
  assertActiveLocation
};

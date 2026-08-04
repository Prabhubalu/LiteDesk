/**
 * INV0 — Inventory locations + Main Warehouse bootstrap.
 */

const mongoose = require('mongoose');
const InventoryLocation = require('../models/InventoryLocation');
const OrganizationInventorySettings = require('../models/OrganizationInventorySettings');
const {
  DEFAULT_MAIN_WAREHOUSE_CODE,
  DEFAULT_MAIN_WAREHOUSE_NAME,
  INVENTORY_LOCATION_STATUS_DEFAULT,
  INVENTORY_LOCATION_TYPES,
  INVENTORY_LOCATION_STATUSES
} = require('../constants/inventoryLifecycle');
const { writeInventoryActivity } = require('./inventoryActivityService');

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

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

async function listLocations({ organizationId, status = null, isDefault = null }) {
  await ensureMainWarehouse(organizationId);
  const query = { organizationId };
  if (status) query.status = status;
  if (isDefault === true || isDefault === 'true' || isDefault === 1 || isDefault === '1') {
    query.isDefault = true;
  } else if (isDefault === false || isDefault === 'false' || isDefault === 0 || isDefault === '0') {
    query.isDefault = false;
  }
  return InventoryLocation.find(query).sort({ isDefault: -1, name: 1 }).lean();
}

async function createLocation({
  organizationId,
  userId,
  locationCode,
  name,
  locationType = 'warehouse',
  allowNegative = false,
  isDefault = false,
  description = null
}) {
  await ensureMainWarehouse(organizationId, userId);

  const code = String(locationCode || '').trim().toUpperCase();
  const displayName = String(name || '').trim();
  if (!code) throw validationError('locationCode is required');
  if (!displayName) throw validationError('name is required');

  const type = String(locationType || 'warehouse').trim();
  if (!INVENTORY_LOCATION_TYPES.includes(type)) {
    throw validationError(`locationType must be one of: ${INVENTORY_LOCATION_TYPES.join(', ')}`);
  }

  if (isDefault) {
    await InventoryLocation.updateMany(
      { organizationId, isDefault: true },
      { $set: { isDefault: false } }
    );
  }

  let location;
  try {
    location = await InventoryLocation.create({
      organizationId,
      locationCode: code,
      name: displayName,
      locationType: type,
      allowNegative: Boolean(allowNegative),
      isDefault: Boolean(isDefault),
      description: description != null && String(description).trim() ? String(description).trim() : null,
      createdBy: userId || null,
      modifiedBy: userId || null
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw validationError('A stockroom with this code already exists');
    }
    throw err;
  }

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

/**
 * Update a stockroom (location). Code is immutable. Cannot clear the sole default
 * without assigning another, and cannot deactivate the default location.
 */
async function updateLocation({
  organizationId,
  userId,
  inventoryLocationId,
  payload = {}
}) {
  const uuid = await resolveInventoryLocationUuid({
    organizationId,
    locationRef: inventoryLocationId
  });
  const location = await InventoryLocation.findOne({ organizationId, inventoryLocationId: uuid });
  if (!location) {
    const err = new Error('Inventory location not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const next = payload || {};
  let changed = false;

  if (next.name !== undefined) {
    const displayName = String(next.name || '').trim();
    if (!displayName) throw validationError('name is required');
    if (location.name !== displayName) {
      location.name = displayName;
      changed = true;
    }
  }

  if (next.locationType !== undefined) {
    const type = String(next.locationType || '').trim();
    if (!INVENTORY_LOCATION_TYPES.includes(type)) {
      throw validationError(`locationType must be one of: ${INVENTORY_LOCATION_TYPES.join(', ')}`);
    }
    if (location.locationType !== type) {
      location.locationType = type;
      changed = true;
    }
  }

  if (next.description !== undefined) {
    const desc =
      next.description != null && String(next.description).trim()
        ? String(next.description).trim()
        : null;
    if (location.description !== desc) {
      location.description = desc;
      changed = true;
    }
  }

  if (next.allowNegative !== undefined) {
    const allow = Boolean(next.allowNegative);
    if (location.allowNegative !== allow) {
      location.allowNegative = allow;
      changed = true;
    }
  }

  if (next.status !== undefined) {
    const status = String(next.status || '').trim();
    if (!INVENTORY_LOCATION_STATUSES.includes(status)) {
      throw validationError(`status must be one of: ${INVENTORY_LOCATION_STATUSES.join(', ')}`);
    }
    if (status === 'inactive' && location.isDefault) {
      throw validationError('Cannot deactivate the default stockroom. Set another default first.');
    }
    if (location.status !== status) {
      location.status = status;
      changed = true;
    }
  }

  if (next.isDefault === true && !location.isDefault) {
    await InventoryLocation.updateMany(
      { organizationId, isDefault: true, inventoryLocationId: { $ne: uuid } },
      { $set: { isDefault: false } }
    );
    location.isDefault = true;
    if (location.status !== 'active') {
      location.status = 'active';
    }
    changed = true;
    await OrganizationInventorySettings.updateOne(
      { organizationId },
      { $set: { defaultInventoryLocationId: location.inventoryLocationId } },
      { upsert: true }
    );
  } else if (next.isDefault === false && location.isDefault) {
    throw validationError('Cannot unset the default stockroom. Set another location as default instead.');
  }

  if (!changed) {
    return location.toObject();
  }

  location.modifiedBy = userId || null;
  await location.save();

  await writeInventoryActivity({
    organizationId,
    recordId: location.inventoryLocationId,
    userId,
    action: 'inventory_location_updated',
    message: `Location ${location.name} updated`,
    details: { inventoryLocationId: location.inventoryLocationId }
  });

  return location.toObject();
}

async function getLocationById({ organizationId, inventoryLocationId }) {
  try {
    const uuid = await resolveInventoryLocationUuid({
      organizationId,
      locationRef: inventoryLocationId
    });
    return InventoryLocation.findOne({ organizationId, inventoryLocationId: uuid }).lean();
  } catch (err) {
    if (err?.code === 'NOT_FOUND' || err?.code === 'VALIDATION') return null;
    throw err;
  }
}

/**
 * Resolve either a public UUID (`inventoryLocationId`) or Mongo `_id` to the UUID
 * used by the inventory ledger. Fulfillment/procurement docs historically stored ObjectId.
 */
async function resolveInventoryLocationUuid({ organizationId, locationRef }) {
  const raw = locationRef == null ? '' : String(locationRef).trim();
  if (!raw) {
    const err = new Error('inventoryLocationId is required');
    err.code = 'VALIDATION';
    throw err;
  }

  let location = await InventoryLocation.findOne({ organizationId, inventoryLocationId: raw }).lean();
  if (!location && mongoose.Types.ObjectId.isValid(raw)) {
    location = await InventoryLocation.findOne({ organizationId, _id: raw }).lean();
  }
  if (!location) {
    const err = new Error('Inventory location not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return location.inventoryLocationId;
}

async function assertActiveLocation({ organizationId, inventoryLocationId }) {
  const uuid = await resolveInventoryLocationUuid({
    organizationId,
    locationRef: inventoryLocationId
  });
  const location = await getLocationById({ organizationId, inventoryLocationId: uuid });
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
  updateLocation,
  getLocationById,
  resolveInventoryLocationUuid,
  assertActiveLocation
};

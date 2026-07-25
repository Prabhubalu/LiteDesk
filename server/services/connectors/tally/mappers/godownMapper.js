'use strict';

/**
 * InventoryLocation ↔ Tally Godown
 */

function addressFromLocation(location = {}) {
  const snap = location.addressSnapshot;
  if (!snap) return location.description || null;
  if (typeof snap === 'string') return snap;
  return [snap.line1, snap.line2, snap.city, snap.state, snap.postalCode, snap.country]
    .filter(Boolean)
    .join(', ') || null;
}

/**
 * @param {object} location - InventoryLocation
 */
function toTally(location = {}) {
  return {
    masterType: 'GODOWN',
    name: location.name || location.locationCode || null,
    parent: location.parentLocationId ? String(location.parentLocationId) : 'Primary',
    address: addressFromLocation(location),
    locationCode: location.locationCode || null,
    locationType: location.locationType || null,
    isDefault: Boolean(location.isDefault),
    arivuId: location._id
      ? String(location._id)
      : location.inventoryLocationId
        ? String(location.inventoryLocationId)
        : null,
    inventoryLocationId: location.inventoryLocationId || null,
  };
}

/**
 * @param {object} godown - Tally godown fields
 */
function fromTally(godown = {}) {
  return {
    name: godown.name || godown.NAME || null,
    locationCode: godown.locationCode || godown.name || godown.NAME || null,
    description: godown.address || godown.ADDRESS || null,
    parentLocationId: godown.parent && godown.parent !== 'Primary' ? String(godown.parent) : null,
    externalReferenceId: godown.masterId || godown.MASTERID || godown.guid || godown.GUID || null,
  };
}

module.exports = {
  toTally,
  fromTally,
  addressFromLocation,
};

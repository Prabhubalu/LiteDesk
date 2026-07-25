const OrganizationChargeSettings = require('../models/OrganizationChargeSettings');
const Charge = require('../models/Charge');
const { CHARGE_STATUSES } = require('../constants/chargeConstants');
const { getActiveChargesByIds } = require('./chargeService');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function assertActiveIds(chargeIds, organizationId) {
  const ids = Array.isArray(chargeIds) ? chargeIds.filter(Boolean) : [];
  if (!ids.length) return [];
  const active = await getActiveChargesByIds(ids, organizationId);
  if (active.length !== ids.length) {
    throw validationError('Only Active charges can be selected', 'INACTIVE_CHARGE');
  }
  return active.map((c) => c._id);
}

async function getOrCreateChargeSettings(organizationId) {
  let settings = await OrganizationChargeSettings.findOne({ organizationId });
  if (settings) return settings;
  settings = await OrganizationChargeSettings.create({
    organizationId,
    defaultPurchaseChargeIds: [],
    defaultSalesChargeIds: [],
    defaultItemChargeIds: []
  });
  return settings;
}

async function getChargeDefaults(organizationId) {
  const settings = await getOrCreateChargeSettings(organizationId);
  return settings.toObject ? settings.toObject() : settings;
}

async function updateChargeDefaults({ organizationId, userId, payload }) {
  const settings = await getOrCreateChargeSettings(organizationId);
  if (payload.defaultPurchaseChargeIds !== undefined) {
    settings.defaultPurchaseChargeIds = await assertActiveIds(payload.defaultPurchaseChargeIds, organizationId);
  }
  if (payload.defaultSalesChargeIds !== undefined) {
    settings.defaultSalesChargeIds = await assertActiveIds(payload.defaultSalesChargeIds, organizationId);
  }
  if (payload.defaultItemChargeIds !== undefined) {
    settings.defaultItemChargeIds = await assertActiveIds(payload.defaultItemChargeIds, organizationId);
  }
  settings.modifiedBy = userId;
  await settings.save();
  return settings.toObject ? settings.toObject() : settings;
}

async function resolveDefaultsForDocument(organizationId, { side = 'SALES', lineKind = null } = {}) {
  const settings = await getChargeDefaults(organizationId);
  const idSet = new Set();
  const pushIds = (ids) => {
    for (const id of ids || []) idSet.add(String(id));
  };
  if (side === 'PURCHASE') pushIds(settings.defaultPurchaseChargeIds);
  else pushIds(settings.defaultSalesChargeIds);
  if (lineKind === 'ITEM') pushIds(settings.defaultItemChargeIds);

  const chargeIds = Array.from(idSet);
  const charges = await Charge.find({
    _id: { $in: chargeIds },
    organizationId,
    status: CHARGE_STATUSES.ACTIVE
  }).lean();

  return { settings, charges };
}

module.exports = {
  getOrCreateChargeSettings,
  getChargeDefaults,
  updateChargeDefaults,
  resolveDefaultsForDocument
};

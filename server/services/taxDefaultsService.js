const OrganizationTaxSettings = require('../models/OrganizationTaxSettings');
const Tax = require('../models/Tax');
const TaxGroup = require('../models/TaxGroup');
const { TAX_STATUSES } = require('../constants/taxConstants');
const { getActiveTaxesByIds } = require('./taxService');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function assertActiveIds(taxIds, organizationId) {
  const ids = Array.isArray(taxIds) ? taxIds.filter(Boolean) : [];
  if (!ids.length) return [];
  const active = await getActiveTaxesByIds(ids, organizationId);
  if (active.length !== ids.length) {
    throw validationError('Only Active taxes can be selected', 'INACTIVE_TAX');
  }
  return active.map((t) => t._id);
}

async function assertActiveGroup(taxGroupId, organizationId) {
  if (!taxGroupId) return null;
  const group = await TaxGroup.findOne({
    _id: taxGroupId,
    organizationId,
    status: TAX_STATUSES.ACTIVE
  }).lean();
  if (!group) throw validationError('Tax group not found or inactive', 'NOT_FOUND');
  return group._id;
}

async function getOrCreateTaxSettings(organizationId) {
  let settings = await OrganizationTaxSettings.findOne({ organizationId });
  if (settings) return settings;
  settings = await OrganizationTaxSettings.create({
    organizationId,
    defaultPurchaseTaxIds: [],
    defaultSalesTaxIds: [],
    defaultItemTaxIds: [],
    defaultServiceTaxIds: [],
    defaultPurchaseTaxGroupId: null,
    defaultSalesTaxGroupId: null
  });
  return settings;
}

async function getTaxDefaults(organizationId) {
  const settings = await getOrCreateTaxSettings(organizationId);
  return settings.toObject ? settings.toObject() : settings;
}

async function updateTaxDefaults({ organizationId, userId, payload }) {
  const settings = await getOrCreateTaxSettings(organizationId);

  if (payload.defaultPurchaseTaxIds !== undefined) {
    settings.defaultPurchaseTaxIds = await assertActiveIds(payload.defaultPurchaseTaxIds, organizationId);
  }
  if (payload.defaultSalesTaxIds !== undefined) {
    settings.defaultSalesTaxIds = await assertActiveIds(payload.defaultSalesTaxIds, organizationId);
  }
  if (payload.defaultItemTaxIds !== undefined) {
    settings.defaultItemTaxIds = await assertActiveIds(payload.defaultItemTaxIds, organizationId);
  }
  if (payload.defaultServiceTaxIds !== undefined) {
    settings.defaultServiceTaxIds = await assertActiveIds(payload.defaultServiceTaxIds, organizationId);
  }
  if (payload.defaultPurchaseTaxGroupId !== undefined) {
    settings.defaultPurchaseTaxGroupId = await assertActiveGroup(
      payload.defaultPurchaseTaxGroupId,
      organizationId
    );
  }
  if (payload.defaultSalesTaxGroupId !== undefined) {
    settings.defaultSalesTaxGroupId = await assertActiveGroup(
      payload.defaultSalesTaxGroupId,
      organizationId
    );
  }

  settings.modifiedBy = userId;
  await settings.save();
  return settings.toObject ? settings.toObject() : settings;
}

/**
 * Resolve default taxes for document creation (consumer helper).
 * @param {'PURCHASE'|'SALES'} side
 * @param {'ITEM'|'SERVICE'|null} lineKind
 */
async function resolveDefaultsForDocument(organizationId, { side = 'SALES', lineKind = null } = {}) {
  const settings = await getTaxDefaults(organizationId);
  const taxIdSet = new Set();

  const pushIds = (ids) => {
    for (const id of ids || []) taxIdSet.add(String(id));
  };

  if (side === 'PURCHASE') pushIds(settings.defaultPurchaseTaxIds);
  else pushIds(settings.defaultSalesTaxIds);

  if (lineKind === 'SERVICE') pushIds(settings.defaultServiceTaxIds);
  else if (lineKind === 'ITEM') pushIds(settings.defaultItemTaxIds);

  const groupId = side === 'PURCHASE'
    ? settings.defaultPurchaseTaxGroupId
    : settings.defaultSalesTaxGroupId;

  if (groupId) {
    const group = await TaxGroup.findOne({
      _id: groupId,
      organizationId,
      status: TAX_STATUSES.ACTIVE
    }).lean();
    if (group) pushIds(group.taxIds);
  }

  const taxIds = Array.from(taxIdSet);
  const taxes = await Tax.find({
    _id: { $in: taxIds },
    organizationId,
    status: TAX_STATUSES.ACTIVE
  }).lean();

  return { settings, taxes };
}

module.exports = {
  getOrCreateTaxSettings,
  getTaxDefaults,
  updateTaxDefaults,
  resolveDefaultsForDocument
};

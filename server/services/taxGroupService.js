const Tax = require('../models/Tax');
const TaxGroup = require('../models/TaxGroup');
const { TAX_STATUSES, TAX_STATUS_VALUES } = require('../constants/taxConstants');
const { getActiveTaxesByIds } = require('./taxService');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function assertActiveTaxIds(taxIds, organizationId) {
  const ids = Array.isArray(taxIds) ? taxIds.filter(Boolean) : [];
  if (!ids.length) return [];
  const active = await getActiveTaxesByIds(ids, organizationId);
  if (active.length !== ids.length) {
    throw validationError('Tax Groups can only contain Active taxes', 'INACTIVE_TAX');
  }
  return active.map((t) => t._id);
}

async function listTaxGroups(organizationId, { includeInactive = false } = {}) {
  const query = { organizationId };
  if (!includeInactive) query.status = TAX_STATUSES.ACTIVE;
  const groups = await TaxGroup.find(query).sort({ name: 1 }).lean();
  return groups;
}

async function getTaxGroupById(taxGroupId, organizationId, { hydrate = false } = {}) {
  const group = await TaxGroup.findOne({ _id: taxGroupId, organizationId }).lean();
  if (!group) return null;
  if (!hydrate) return group;
  const taxes = await Tax.find({
    _id: { $in: group.taxIds || [] },
    organizationId
  }).lean();
  return { ...group, taxes };
}

async function createTaxGroup({ organizationId, userId, payload }) {
  const name = String(payload.name || '').trim();
  if (!name) throw validationError('Group name is required');
  const taxIds = await assertActiveTaxIds(payload.taxIds, organizationId);
  const status = payload.status && TAX_STATUS_VALUES.includes(payload.status)
    ? payload.status
    : TAX_STATUSES.ACTIVE;

  return TaxGroup.create({
    organizationId,
    name,
    description: payload.description ? String(payload.description).trim() : null,
    taxIds,
    status,
    createdBy: userId,
    modifiedBy: userId
  });
}

async function updateTaxGroup({ taxGroupId, organizationId, userId, payload }) {
  const group = await TaxGroup.findOne({ _id: taxGroupId, organizationId });
  if (!group) return null;

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) throw validationError('Group name is required');
    group.name = name;
  }
  if (payload.description !== undefined) {
    group.description = payload.description ? String(payload.description).trim() : null;
  }
  if (payload.taxIds !== undefined) {
    group.taxIds = await assertActiveTaxIds(payload.taxIds, organizationId);
  }
  if (payload.status !== undefined) {
    if (!TAX_STATUS_VALUES.includes(payload.status)) throw validationError('Invalid status');
    group.status = payload.status;
  }
  group.modifiedBy = userId;
  await group.save();
  return group;
}

async function deleteTaxGroup({ taxGroupId, organizationId }) {
  const group = await TaxGroup.findOne({ _id: taxGroupId, organizationId });
  if (!group) return null;
  await TaxGroup.deleteOne({ _id: group._id });
  return group;
}

module.exports = {
  listTaxGroups,
  getTaxGroupById,
  createTaxGroup,
  updateTaxGroup,
  deleteTaxGroup
};

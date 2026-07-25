const TaxRegionalAssignment = require('../models/TaxRegionalAssignment');
const Tax = require('../models/Tax');
const TaxGroup = require('../models/TaxGroup');
const {
  TAX_REGION_LEVELS,
  TAX_REGION_LEVEL_VALUES,
  TAX_STATUSES,
  TAX_STATUS_VALUES
} = require('../constants/taxConstants');
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
    throw validationError('Only Active taxes can be selected', 'INACTIVE_TAX');
  }
  return active.map((t) => t._id);
}

async function assertActiveGroupIds(taxGroupIds, organizationId) {
  const ids = Array.isArray(taxGroupIds) ? taxGroupIds.filter(Boolean) : [];
  if (!ids.length) return [];
  const groups = await TaxGroup.find({
    _id: { $in: ids },
    organizationId,
    status: TAX_STATUSES.ACTIVE
  }).lean();
  if (groups.length !== ids.length) {
    throw validationError('Only Active tax groups can be selected', 'INACTIVE_GROUP');
  }
  return groups.map((g) => g._id);
}

async function listRegionalAssignments(organizationId, { includeInactive = false } = {}) {
  const query = { organizationId };
  if (!includeInactive) query.status = TAX_STATUSES.ACTIVE;
  return TaxRegionalAssignment.find(query).sort({ countryCode: 1, stateCode: 1, region: 1 }).lean();
}

async function createRegionalAssignment({ organizationId, userId, payload }) {
  const countryCode = String(payload.countryCode || '').trim().toUpperCase();
  if (!countryCode) throw validationError('Country code is required');

  const level = payload.level || TAX_REGION_LEVELS.COUNTRY;
  if (!TAX_REGION_LEVEL_VALUES.includes(level)) throw validationError('Invalid region level');

  const stateCode = payload.stateCode
    ? String(payload.stateCode).trim().toUpperCase()
    : null;
  const region = payload.region ? String(payload.region).trim() : null;

  if (level === TAX_REGION_LEVELS.STATE && !stateCode) {
    throw validationError('State code is required for STATE level');
  }
  if (level === TAX_REGION_LEVELS.REGION && !region) {
    throw validationError('Region is required for REGION level');
  }

  const taxIds = await assertActiveTaxIds(payload.taxIds, organizationId);
  const taxGroupIds = await assertActiveGroupIds(payload.taxGroupIds, organizationId);
  const status = payload.status && TAX_STATUS_VALUES.includes(payload.status)
    ? payload.status
    : TAX_STATUSES.ACTIVE;

  return TaxRegionalAssignment.create({
    organizationId,
    level,
    countryCode,
    stateCode,
    region,
    taxIds,
    taxGroupIds,
    status,
    createdBy: userId,
    modifiedBy: userId
  });
}

async function updateRegionalAssignment({ assignmentId, organizationId, userId, payload }) {
  const row = await TaxRegionalAssignment.findOne({ _id: assignmentId, organizationId });
  if (!row) return null;

  if (payload.level !== undefined) {
    if (!TAX_REGION_LEVEL_VALUES.includes(payload.level)) throw validationError('Invalid region level');
    row.level = payload.level;
  }
  if (payload.countryCode !== undefined) {
    const countryCode = String(payload.countryCode || '').trim().toUpperCase();
    if (!countryCode) throw validationError('Country code is required');
    row.countryCode = countryCode;
  }
  if (payload.stateCode !== undefined) {
    row.stateCode = payload.stateCode ? String(payload.stateCode).trim().toUpperCase() : null;
  }
  if (payload.region !== undefined) {
    row.region = payload.region ? String(payload.region).trim() : null;
  }
  if (payload.taxIds !== undefined) {
    row.taxIds = await assertActiveTaxIds(payload.taxIds, organizationId);
  }
  if (payload.taxGroupIds !== undefined) {
    row.taxGroupIds = await assertActiveGroupIds(payload.taxGroupIds, organizationId);
  }
  if (payload.status !== undefined) {
    if (!TAX_STATUS_VALUES.includes(payload.status)) throw validationError('Invalid status');
    row.status = payload.status;
  }
  row.modifiedBy = userId;
  await row.save();
  return row;
}

async function deleteRegionalAssignment({ assignmentId, organizationId }) {
  const row = await TaxRegionalAssignment.findOne({ _id: assignmentId, organizationId });
  if (!row) return null;
  await TaxRegionalAssignment.deleteOne({ _id: row._id });
  return row;
}

/**
 * Suggest taxes for a location (most specific match wins, then merge group members).
 */
async function suggestTaxesForRegion(organizationId, { countryCode, stateCode = null, region = null } = {}) {
  const cc = String(countryCode || '').trim().toUpperCase();
  if (!cc) return { assignments: [], taxes: [] };

  const candidates = await TaxRegionalAssignment.find({
    organizationId,
    countryCode: cc,
    status: TAX_STATUSES.ACTIVE
  }).lean();

  const score = (row) => {
    let s = 0;
    if (row.level === TAX_REGION_LEVELS.COUNTRY) s = 1;
    if (row.level === TAX_REGION_LEVELS.STATE && stateCode
      && row.stateCode === String(stateCode).toUpperCase()) s = 2;
    if (row.level === TAX_REGION_LEVELS.REGION && region
      && row.region && row.region.toLowerCase() === String(region).toLowerCase()) s = 3;
    return s;
  };

  const ranked = candidates
    .map((row) => ({ row, s: score(row) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const taxIdSet = new Set();
  const groupIdSet = new Set();
  for (const { row } of ranked) {
    for (const id of row.taxIds || []) taxIdSet.add(String(id));
    for (const id of row.taxGroupIds || []) groupIdSet.add(String(id));
  }

  if (groupIdSet.size) {
    const groups = await TaxGroup.find({
      _id: { $in: Array.from(groupIdSet) },
      organizationId,
      status: TAX_STATUSES.ACTIVE
    }).lean();
    for (const g of groups) {
      for (const id of g.taxIds || []) taxIdSet.add(String(id));
    }
  }

  const taxes = await Tax.find({
    _id: { $in: Array.from(taxIdSet) },
    organizationId,
    status: TAX_STATUSES.ACTIVE
  }).lean();

  return {
    assignments: ranked.map((x) => x.row),
    taxes
  };
}

module.exports = {
  listRegionalAssignments,
  createRegionalAssignment,
  updateRegionalAssignment,
  deleteRegionalAssignment,
  suggestTaxesForRegion
};

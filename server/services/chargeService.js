const Charge = require('../models/Charge');
const {
  CHARGE_TYPES,
  CHARGE_TYPE_VALUES,
  CHARGE_SCOPES,
  CHARGE_SCOPE_VALUES,
  CHARGE_APPLICABLE_ON,
  CHARGE_APPLICABLE_ON_VALUES,
  CHARGE_STATUSES,
  CHARGE_STATUS_VALUES
} = require('../constants/chargeConstants');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

function normalizeOptionalString(value, max) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  if (max && s.length > max) throw validationError(`Value exceeds max length ${max}`);
  return s;
}

function validateChargeValue(chargeType, chargeValue) {
  const n = Number(chargeValue);
  if (!Number.isFinite(n) || n < 0) throw validationError('Charge value cannot be negative');
  if (chargeType === CHARGE_TYPES.PERCENTAGE && n > 100) {
    throw validationError('Percentage charges must be between 0 and 100');
  }
  return n;
}

async function listCharges(organizationId, {
  includeInactive = false,
  q = null,
  applicableOn = null,
  scope = null,
  status = null
} = {}) {
  const query = { organizationId };
  if (status && CHARGE_STATUS_VALUES.includes(status)) {
    query.status = status;
  } else if (!includeInactive) {
    query.status = CHARGE_STATUSES.ACTIVE;
  }
  if (applicableOn && CHARGE_APPLICABLE_ON_VALUES.includes(applicableOn)) {
    query.applicableOn = { $in: [applicableOn, CHARGE_APPLICABLE_ON.BOTH] };
  }
  if (scope && CHARGE_SCOPE_VALUES.includes(scope)) {
    if (scope === CHARGE_SCOPES.ITEM) {
      query.scope = { $in: [CHARGE_SCOPES.ITEM, CHARGE_SCOPES.BOTH] };
    } else if (scope === CHARGE_SCOPES.TRANSACTION) {
      query.scope = { $in: [CHARGE_SCOPES.TRANSACTION, CHARGE_SCOPES.BOTH] };
    } else {
      query.scope = scope;
    }
  }
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: rx }, { code: rx }];
  }
  return Charge.find(query).sort({ isDefault: -1, name: 1 }).lean();
}

async function getChargeById(chargeId, organizationId) {
  return Charge.findOne({ _id: chargeId, organizationId }).lean();
}

async function getActiveChargesByIds(chargeIds, organizationId) {
  if (!Array.isArray(chargeIds) || !chargeIds.length) return [];
  return Charge.find({
    _id: { $in: chargeIds },
    organizationId,
    status: CHARGE_STATUSES.ACTIVE
  }).lean();
}

async function createCharge({ organizationId, userId, payload }) {
  const name = String(payload.name || '').trim();
  if (!name) throw validationError('Charge name is required');

  const chargeType = payload.chargeType || CHARGE_TYPES.FIXED_AMOUNT;
  if (!CHARGE_TYPE_VALUES.includes(chargeType)) throw validationError('Invalid charge type');

  const scope = payload.scope || CHARGE_SCOPES.TRANSACTION;
  if (!CHARGE_SCOPE_VALUES.includes(scope)) throw validationError('Invalid charge scope');

  const applicableOn = payload.applicableOn || CHARGE_APPLICABLE_ON.BOTH;
  if (!CHARGE_APPLICABLE_ON_VALUES.includes(applicableOn)) {
    throw validationError('Invalid applicableOn');
  }

  const chargeValue = validateChargeValue(chargeType, payload.chargeValue);
  const isDefault = payload.isDefault === true;
  const status = payload.status || CHARGE_STATUSES.ACTIVE;
  if (isDefault && status !== CHARGE_STATUSES.ACTIVE) {
    throw validationError('Default charges must always be Active', 'DEFAULT_MUST_BE_ACTIVE');
  }

  const doc = await Charge.create({
    organizationId,
    name,
    code: normalizeOptionalString(payload.code, 64),
    description: normalizeOptionalString(payload.description, 2000),
    chargeType,
    chargeValue,
    scope,
    applicableOn,
    isDefault,
    status,
    createdBy: userId,
    modifiedBy: userId
  });
  return doc.toObject();
}

async function updateCharge({ chargeId, organizationId, userId, payload }) {
  const charge = await Charge.findOne({ _id: chargeId, organizationId });
  if (!charge) throw validationError('Charge not found', 'NOT_FOUND');

  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (!name) throw validationError('Charge name is required');
    charge.name = name;
  }
  if (payload.code !== undefined) charge.code = normalizeOptionalString(payload.code, 64);
  if (payload.description !== undefined) {
    charge.description = normalizeOptionalString(payload.description, 2000);
  }
  if (payload.chargeType !== undefined) {
    if (!CHARGE_TYPE_VALUES.includes(payload.chargeType)) throw validationError('Invalid charge type');
    charge.chargeType = payload.chargeType;
  }
  if (payload.chargeValue !== undefined || payload.chargeType !== undefined) {
    charge.chargeValue = validateChargeValue(charge.chargeType, payload.chargeValue ?? charge.chargeValue);
  }
  if (payload.scope !== undefined) {
    if (!CHARGE_SCOPE_VALUES.includes(payload.scope)) throw validationError('Invalid charge scope');
    charge.scope = payload.scope;
  }
  if (payload.applicableOn !== undefined) {
    if (!CHARGE_APPLICABLE_ON_VALUES.includes(payload.applicableOn)) {
      throw validationError('Invalid applicableOn');
    }
    charge.applicableOn = payload.applicableOn;
  }
  if (payload.isDefault !== undefined) charge.isDefault = payload.isDefault === true;
  if (payload.status !== undefined) {
    if (!CHARGE_STATUS_VALUES.includes(payload.status)) throw validationError('Invalid status');
    charge.status = payload.status;
  }
  if (charge.isDefault && charge.status !== CHARGE_STATUSES.ACTIVE) {
    throw validationError('Default charges must always be Active', 'DEFAULT_MUST_BE_ACTIVE');
  }

  charge.modifiedBy = userId;
  await charge.save();
  return charge.toObject();
}

async function setChargeStatus({ chargeId, organizationId, userId, status }) {
  if (!CHARGE_STATUS_VALUES.includes(status)) throw validationError('Invalid status');
  const charge = await Charge.findOne({ _id: chargeId, organizationId });
  if (!charge) throw validationError('Charge not found', 'NOT_FOUND');
  if (charge.isDefault && status !== CHARGE_STATUSES.ACTIVE) {
    throw validationError('Default charges must always be Active', 'DEFAULT_MUST_BE_ACTIVE');
  }
  charge.status = status;
  charge.modifiedBy = userId;
  await charge.save();
  return charge.toObject();
}

async function deleteCharge({ chargeId, organizationId }) {
  const result = await Charge.deleteOne({ _id: chargeId, organizationId });
  if (!result.deletedCount) throw validationError('Charge not found', 'NOT_FOUND');
  return { deleted: true };
}

module.exports = {
  listCharges,
  getChargeById,
  getActiveChargesByIds,
  createCharge,
  updateCharge,
  setChargeStatus,
  deleteCharge
};

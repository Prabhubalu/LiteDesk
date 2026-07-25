const Tax = require('../models/Tax');
const TaxGroup = require('../models/TaxGroup');
const {
  TAX_TYPES,
  TAX_TYPE_VALUES,
  TAX_SCOPES,
  TAX_SCOPE_VALUES,
  TAX_APPLICABLE_ON,
  TAX_APPLICABLE_ON_VALUES,
  TAX_STATUSES,
  TAX_STATUS_VALUES
} = require('../constants/taxConstants');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

function normalizeOptionalString(value, max) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  if (max && s.length > max) {
    throw validationError(`Value exceeds max length ${max}`);
  }
  return s;
}

function validateTaxValue(taxType, taxValue) {
  const n = Number(taxValue);
  if (!Number.isFinite(n) || n < 0) {
    throw validationError('Tax value cannot be negative');
  }
  if (taxType === TAX_TYPES.PERCENTAGE && n > 100) {
    throw validationError('Percentage taxes must be between 0 and 100');
  }
  return n;
}

async function listTaxes(organizationId, {
  includeInactive = false,
  q = null,
  applicableOn = null,
  scope = null,
  status = null
} = {}) {
  const query = { organizationId };
  if (status && TAX_STATUS_VALUES.includes(status)) {
    query.status = status;
  } else if (!includeInactive) {
    query.status = TAX_STATUSES.ACTIVE;
  }
  if (applicableOn && TAX_APPLICABLE_ON_VALUES.includes(applicableOn)) {
    query.applicableOn = { $in: [applicableOn, TAX_APPLICABLE_ON.BOTH] };
  }
  if (scope && TAX_SCOPE_VALUES.includes(scope)) {
    if (scope === TAX_SCOPES.ITEM) {
      query.scope = { $in: [TAX_SCOPES.ITEM, TAX_SCOPES.BOTH] };
    } else if (scope === TAX_SCOPES.TRANSACTION) {
      query.scope = { $in: [TAX_SCOPES.TRANSACTION, TAX_SCOPES.BOTH] };
    } else {
      query.scope = scope;
    }
  }
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: rx }, { code: rx }];
  }
  return Tax.find(query).sort({ isDefault: -1, name: 1 }).lean();
}

async function getTaxById(taxId, organizationId) {
  return Tax.findOne({ _id: taxId, organizationId }).lean();
}

async function getActiveTaxesByIds(taxIds, organizationId) {
  if (!Array.isArray(taxIds) || !taxIds.length) return [];
  return Tax.find({
    _id: { $in: taxIds },
    organizationId,
    status: TAX_STATUSES.ACTIVE
  }).lean();
}

async function createTax({ organizationId, userId, payload }) {
  const name = String(payload.name || '').trim();
  if (!name) throw validationError('Tax name is required');

  const taxType = payload.taxType || TAX_TYPES.PERCENTAGE;
  if (!TAX_TYPE_VALUES.includes(taxType)) {
    throw validationError('Invalid tax type');
  }

  const scope = payload.scope || TAX_SCOPES.ITEM;
  if (!TAX_SCOPE_VALUES.includes(scope)) {
    throw validationError('Invalid tax scope');
  }

  const applicableOn = payload.applicableOn || TAX_APPLICABLE_ON.BOTH;
  if (!TAX_APPLICABLE_ON_VALUES.includes(applicableOn)) {
    throw validationError('Invalid applicableOn');
  }

  const taxValue = validateTaxValue(taxType, payload.taxValue);
  const status = payload.status && TAX_STATUS_VALUES.includes(payload.status)
    ? payload.status
    : TAX_STATUSES.ACTIVE;

  const isDefault = payload.isDefault === true;
  if (isDefault && status !== TAX_STATUSES.ACTIVE) {
    throw validationError('Default taxes must always be Active', 'DEFAULT_MUST_BE_ACTIVE');
  }

  if (isDefault) {
    await Tax.updateMany(
      { organizationId, isDefault: true },
      { $set: { isDefault: false } }
    );
  }

  const tax = await Tax.create({
    organizationId,
    name,
    code: normalizeOptionalString(payload.code, 64),
    description: normalizeOptionalString(payload.description, 2000),
    taxType,
    taxValue,
    scope,
    applicableOn,
    isDefault,
    status,
    isInclusive: payload.isInclusive === true,
    createdBy: userId,
    modifiedBy: userId
  });

  if (payload.taxGroupId) {
    await addTaxToGroup({
      organizationId,
      userId,
      taxGroupId: payload.taxGroupId,
      taxId: tax._id
    });
  }

  return tax.toObject ? tax.toObject() : tax;
}

async function updateTax({ taxId, organizationId, userId, payload }) {
  const tax = await Tax.findOne({ _id: taxId, organizationId });
  if (!tax) return null;

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) throw validationError('Tax name is required');
    tax.name = name;
  }
  if (payload.code !== undefined) tax.code = normalizeOptionalString(payload.code, 64);
  if (payload.description !== undefined) {
    tax.description = normalizeOptionalString(payload.description, 2000);
  }
  if (payload.taxType !== undefined) {
    if (!TAX_TYPE_VALUES.includes(payload.taxType)) throw validationError('Invalid tax type');
    tax.taxType = payload.taxType;
  }
  if (payload.taxValue !== undefined) {
    tax.taxValue = validateTaxValue(tax.taxType, payload.taxValue);
  }
  if (payload.scope !== undefined) {
    if (!TAX_SCOPE_VALUES.includes(payload.scope)) throw validationError('Invalid tax scope');
    tax.scope = payload.scope;
  }
  if (payload.applicableOn !== undefined) {
    if (!TAX_APPLICABLE_ON_VALUES.includes(payload.applicableOn)) {
      throw validationError('Invalid applicableOn');
    }
    tax.applicableOn = payload.applicableOn;
  }
  if (payload.status !== undefined) {
    if (!TAX_STATUS_VALUES.includes(payload.status)) throw validationError('Invalid status');
    if (payload.status === TAX_STATUSES.INACTIVE && (payload.isDefault === true || tax.isDefault)) {
      throw validationError('Default taxes must always be Active', 'DEFAULT_MUST_BE_ACTIVE');
    }
    tax.status = payload.status;
  }
  if (payload.isDefault === true) {
    if (tax.status !== TAX_STATUSES.ACTIVE) {
      throw validationError('Default taxes must always be Active', 'DEFAULT_MUST_BE_ACTIVE');
    }
    await Tax.updateMany(
      { organizationId, _id: { $ne: tax._id } },
      { $set: { isDefault: false } }
    );
    tax.isDefault = true;
  } else if (payload.isDefault === false) {
    tax.isDefault = false;
  }
  if (payload.isInclusive !== undefined) tax.isInclusive = payload.isInclusive === true;

  tax.modifiedBy = userId;
  await tax.save();

  if (payload.taxGroupId) {
    await addTaxToGroup({
      organizationId,
      userId,
      taxGroupId: payload.taxGroupId,
      taxId: tax._id
    });
  }

  return tax.toObject ? tax.toObject() : tax;
}

async function setTaxStatus({ taxId, organizationId, userId, status }) {
  if (!TAX_STATUS_VALUES.includes(status)) throw validationError('Invalid status');
  const tax = await Tax.findOne({ _id: taxId, organizationId });
  if (!tax) return null;
  if (status === TAX_STATUSES.INACTIVE && tax.isDefault) {
    throw validationError('Default taxes must always be Active', 'DEFAULT_MUST_BE_ACTIVE');
  }
  tax.status = status;
  tax.modifiedBy = userId;
  await tax.save();
  return tax.toObject ? tax.toObject() : tax;
}

async function deleteTax({ taxId, organizationId }) {
  const tax = await Tax.findOne({ _id: taxId, organizationId });
  if (!tax) return null;
  if (tax.isDefault) {
    throw validationError('Cannot delete the default tax; unset default first', 'DEFAULT_PROTECTED');
  }
  await TaxGroup.updateMany(
    { organizationId, taxIds: tax._id },
    { $pull: { taxIds: tax._id } }
  );
  await Tax.deleteOne({ _id: tax._id });
  return tax;
}

async function addTaxToGroup({ organizationId, userId, taxGroupId, taxId }) {
  const group = await TaxGroup.findOne({ _id: taxGroupId, organizationId });
  if (!group) throw validationError('Tax group not found', 'NOT_FOUND');
  const tax = await Tax.findOne({ _id: taxId, organizationId, status: TAX_STATUSES.ACTIVE });
  if (!tax) throw validationError('Only Active taxes can be added to a group', 'INACTIVE_TAX');
  const exists = group.taxIds.some((id) => String(id) === String(taxId));
  if (!exists) {
    group.taxIds.push(tax._id);
    group.modifiedBy = userId;
    await group.save();
  }
  return group;
}

module.exports = {
  listTaxes,
  getTaxById,
  getActiveTaxesByIds,
  createTax,
  updateTax,
  setTaxStatus,
  deleteTax,
  addTaxToGroup,
  validateTaxValue
};

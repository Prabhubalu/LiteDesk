const {
  listTaxes,
  getTaxById,
  createTax,
  updateTax,
  setTaxStatus,
  deleteTax
} = require('../services/taxService');
const {
  listTaxGroups,
  getTaxGroupById,
  createTaxGroup,
  updateTaxGroup,
  deleteTaxGroup
} = require('../services/taxGroupService');
const {
  getTaxDefaults,
  updateTaxDefaults,
  resolveDefaultsForDocument
} = require('../services/taxDefaultsService');
const {
  listRegionalAssignments,
  createRegionalAssignment,
  updateRegionalAssignment,
  deleteRegionalAssignment,
  suggestTaxesForRegion
} = require('../services/taxRegionalService');
const { calculateDocumentTaxes } = require('../services/taxCalculationService');
const { TAX_STATUSES } = require('../constants/taxConstants');

function statusFromError(err) {
  if (!err) return 500;
  if (err.code === 'NOT_FOUND') return 404;
  if (err.code === 'DEFAULT_PROTECTED' || err.code === 'DEFAULT_MUST_BE_ACTIVE') return 400;
  if (err.code === 'INACTIVE_TAX' || err.code === 'INACTIVE_GROUP') return 400;
  if (err.code === 'TAX_SCOPE_INVALID' || err.code === 'TAX_TYPE_UNSUPPORTED' || err.code === 'TAX_VALUE_INVALID') {
    return 400;
  }
  if (err.code === 'VALIDATION') return 400;
  if (err.name === 'ValidationError' || err.code === 11000) return 400;
  return 500;
}

exports.listTaxes = async (req, res) => {
  try {
    const data = await listTaxes(req.user.organizationId, {
      includeInactive: req.query.includeInactive === 'true',
      q: req.query.q || null,
      applicableOn: req.query.applicableOn || null,
      scope: req.query.scope || null,
      status: req.query.status || null
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('listTaxes error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.getTax = async (req, res) => {
  try {
    const data = await getTaxById(req.params.id, req.user.organizationId);
    if (!data) return res.status(404).json({ success: false, message: 'Tax not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error('getTax error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.createTax = async (req, res) => {
  try {
    const data = await createTax({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('createTax error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.updateTax = async (req, res) => {
  try {
    const data = await updateTax({
      taxId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    if (!data) return res.status(404).json({ success: false, message: 'Tax not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error('updateTax error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.setTaxStatus = async (req, res) => {
  try {
    const status = req.body?.status;
    if (status !== TAX_STATUSES.ACTIVE && status !== TAX_STATUSES.INACTIVE) {
      return res.status(400).json({ success: false, message: 'status must be ACTIVE or INACTIVE' });
    }
    const data = await setTaxStatus({
      taxId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      status
    });
    if (!data) return res.status(404).json({ success: false, message: 'Tax not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error('setTaxStatus error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.deleteTax = async (req, res) => {
  try {
    const removed = await deleteTax({
      taxId: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!removed) return res.status(404).json({ success: false, message: 'Tax not found' });
    res.json({ success: true, message: 'Tax deleted' });
  } catch (err) {
    console.error('deleteTax error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.listTaxGroups = async (req, res) => {
  try {
    const data = await listTaxGroups(req.user.organizationId, {
      includeInactive: req.query.includeInactive === 'true'
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('listTaxGroups error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.getTaxGroup = async (req, res) => {
  try {
    const data = await getTaxGroupById(req.params.id, req.user.organizationId, { hydrate: true });
    if (!data) return res.status(404).json({ success: false, message: 'Tax group not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error('getTaxGroup error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.createTaxGroup = async (req, res) => {
  try {
    const data = await createTaxGroup({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('createTaxGroup error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.updateTaxGroup = async (req, res) => {
  try {
    const data = await updateTaxGroup({
      taxGroupId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    if (!data) return res.status(404).json({ success: false, message: 'Tax group not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error('updateTaxGroup error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.deleteTaxGroup = async (req, res) => {
  try {
    const removed = await deleteTaxGroup({
      taxGroupId: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!removed) return res.status(404).json({ success: false, message: 'Tax group not found' });
    res.json({ success: true, message: 'Tax group deleted' });
  } catch (err) {
    console.error('deleteTaxGroup error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.getTaxDefaults = async (req, res) => {
  try {
    const data = await getTaxDefaults(req.user.organizationId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getTaxDefaults error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.updateTaxDefaults = async (req, res) => {
  try {
    const data = await updateTaxDefaults({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('updateTaxDefaults error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.resolveTaxDefaults = async (req, res) => {
  try {
    const side = (req.query.side || req.body?.side || 'SALES').toUpperCase();
    const lineKind = req.query.lineKind || req.body?.lineKind || null;
    const data = await resolveDefaultsForDocument(req.user.organizationId, { side, lineKind });
    res.json({ success: true, data });
  } catch (err) {
    console.error('resolveTaxDefaults error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.listRegionalAssignments = async (req, res) => {
  try {
    const data = await listRegionalAssignments(req.user.organizationId, {
      includeInactive: req.query.includeInactive === 'true'
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('listRegionalAssignments error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.createRegionalAssignment = async (req, res) => {
  try {
    const data = await createRegionalAssignment({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('createRegionalAssignment error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.updateRegionalAssignment = async (req, res) => {
  try {
    const data = await updateRegionalAssignment({
      assignmentId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    if (!data) return res.status(404).json({ success: false, message: 'Regional assignment not found' });
    res.json({ success: true, data });
  } catch (err) {
    console.error('updateRegionalAssignment error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.deleteRegionalAssignment = async (req, res) => {
  try {
    const removed = await deleteRegionalAssignment({
      assignmentId: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!removed) return res.status(404).json({ success: false, message: 'Regional assignment not found' });
    res.json({ success: true, message: 'Regional assignment deleted' });
  } catch (err) {
    console.error('deleteRegionalAssignment error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.suggestRegionalTaxes = async (req, res) => {
  try {
    const data = await suggestTaxesForRegion(req.user.organizationId, {
      countryCode: req.query.countryCode || req.body?.countryCode,
      stateCode: req.query.stateCode || req.body?.stateCode || null,
      region: req.query.region || req.body?.region || null
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('suggestRegionalTaxes error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

exports.calculateTaxes = async (req, res) => {
  try {
    const data = calculateDocumentTaxes(req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    console.error('calculateTaxes error:', err);
    res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
};

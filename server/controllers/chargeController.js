const chargeService = require('../services/chargeService');
const chargeDefaultsService = require('../services/chargeDefaultsService');
const { calculateDocumentCharges } = require('../services/chargeCalculationService');

function statusFromError(err) {
  if (err?.code === 'NOT_FOUND') return 404;
  if (err?.code === 'VALIDATION' || err?.code === 'DEFAULT_MUST_BE_ACTIVE' || err?.code === 'INACTIVE_CHARGE') {
    return 400;
  }
  return 500;
}

async function listCharges(req, res) {
  try {
    const data = await chargeService.listCharges(req.user.organizationId, {
      includeInactive: req.query.includeInactive === 'true',
      q: req.query.q || null,
      applicableOn: req.query.applicableOn || null,
      scope: req.query.scope || null,
      status: req.query.status || null
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getCharge(req, res) {
  try {
    const data = await chargeService.getChargeById(req.params.id, req.user.organizationId);
    if (!data) return res.status(404).json({ success: false, message: 'Charge not found', code: 'NOT_FOUND' });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function createCharge(req, res) {
  try {
    const data = await chargeService.createCharge({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function updateCharge(req, res) {
  try {
    const data = await chargeService.updateCharge({
      chargeId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function setChargeStatus(req, res) {
  try {
    const data = await chargeService.setChargeStatus({
      chargeId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      status: req.body?.status
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function deleteCharge(req, res) {
  try {
    const data = await chargeService.deleteCharge({
      chargeId: req.params.id,
      organizationId: req.user.organizationId
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getChargeDefaults(req, res) {
  try {
    const data = await chargeDefaultsService.getChargeDefaults(req.user.organizationId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function updateChargeDefaults(req, res) {
  try {
    const data = await chargeDefaultsService.updateChargeDefaults({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function resolveChargeDefaults(req, res) {
  try {
    const data = await chargeDefaultsService.resolveDefaultsForDocument(req.user.organizationId, {
      side: req.query.side || 'SALES',
      lineKind: req.query.lineKind || null
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function calculateCharges(req, res) {
  try {
    const data = calculateDocumentCharges(req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(statusFromError(err)).json({ success: false, message: err.message, code: err.code });
  }
}

module.exports = {
  listCharges,
  getCharge,
  createCharge,
  updateCharge,
  setChargeStatus,
  deleteCharge,
  getChargeDefaults,
  updateChargeDefaults,
  resolveChargeDefaults,
  calculateCharges
};

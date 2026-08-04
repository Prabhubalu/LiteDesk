const deliveryReturnService = require('../services/deliveryReturnService');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireInventoryApp } = require('../middleware/requireInventoryAppMiddleware');
const express = require('express');

function sendError(res, err) {
  const status = err?.code === 'NOT_FOUND' ? 404 : err?.code === 'VALIDATION' ? 400 : 500;
  return res.status(status).json({ success: false, message: err.message, code: err.code || 'UNKNOWN' });
}

function hydratePopulatedRef(ref) {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return ref;
  if (ref.name) return ref;
  const name = [ref.firstName || ref.first_name, ref.lastName || ref.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || ref.email || '';
  return name ? { ...ref, name } : ref;
}

/** Flatten for GenericModule / ModuleRecordPage. */
function flattenDrResult(result) {
  if (!result?.deliveryReturn) return result;
  const lines = (result.lines || []).map((line) => ({
    ...line,
    quantity: line.quantityReturned,
    deliveryReturnLineId: line._id
  }));
  const dr = { ...result.deliveryReturn };
  if (dr.customerId) dr.customerId = hydratePopulatedRef(dr.customerId);
  if (dr.contactPersonId) dr.contactPersonId = hydratePopulatedRef(dr.contactPersonId);
  if (dr.ownerId) dr.ownerId = hydratePopulatedRef(dr.ownerId);
  if (dr.createdBy) dr.createdBy = hydratePopulatedRef(dr.createdBy);
  if (dr.modifiedBy) dr.modifiedBy = hydratePopulatedRef(dr.modifiedBy);
  return { ...dr, lines };
}

const router = express.Router();
router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireInventoryApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/', checkPermission('inventory', 'view'), async (req, res) => {
  try {
    const result = await deliveryReturnService.listDeliveryReturns({
      organizationId: req.user.organizationId,
      status: req.query.status || null,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      search: req.query.search || req.query.q || null
    });
    return res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/eligible-sources', checkPermission('inventory', 'view'), async (req, res) => {
  try {
    const deliveryNoteIds = req.query.deliveryNoteIds
      ? String(req.query.deliveryNoteIds).split(',').filter(Boolean)
      : null;
    const invoiceIds = req.query.invoiceIds
      ? String(req.query.invoiceIds).split(',').filter(Boolean)
      : null;
    const data = await deliveryReturnService.listEligibleReturnSources({
      organizationId: req.user.organizationId,
      customerId: req.query.customerId,
      deliveryNoteIds,
      invoiceIds
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.createDeliveryReturn({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/:id', checkPermission('inventory', 'view'), async (req, res) => {
  try {
    const data = await deliveryReturnService.getDeliveryReturn({
      organizationId: req.user.organizationId,
      id: req.params.id
    });
    return res.json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/:id', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.updateDeliveryReturn({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/:id/lines/:lineId', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.updateDeliveryReturnLine({
      organizationId: req.user.organizationId,
      id: req.params.id,
      lineId: req.params.lineId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/:id/lines/:lineId', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.deleteDeliveryReturnLine({
      organizationId: req.user.organizationId,
      id: req.params.id,
      lineId: req.params.lineId,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/lines/from-sources', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.addDeliveryReturnLinesFromSources({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/approve', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.approveDeliveryReturn({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/receive', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.markDeliveryReturnReceived({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/inspect', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.markDeliveryReturnInspected({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/restock', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.markDeliveryReturnRestocked({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/send-email', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const { sendDeliveryReturnEmail } = require('../services/deliveryReturnEmailService');
    const data = await sendDeliveryReturnEmail({
      organizationId: req.user.organizationId,
      deliveryReturnId: req.params.id,
      userId: req.user._id,
      body: req.body || {},
      req
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status =
      err?.code === 'NOT_FOUND'
        ? 404
        : err?.code === 'EMAIL_NOT_CONFIGURED' ||
            err?.code === 'MISSING_RECIPIENT' ||
            err?.code === 'DR_NOT_EMAILABLE'
          ? 400
          : err?.code === 'EMAIL_SEND_FAILED'
            ? 502
            : 500;
    return res.status(status).json({
      success: false,
      message: err.message,
      code: err.code || 'UNKNOWN'
    });
  }
});

router.post('/:id/cancel', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.cancelDeliveryReturn({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/duplicate', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryReturnService.duplicateDeliveryReturn({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.status(201).json({ success: true, data: flattenDrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;

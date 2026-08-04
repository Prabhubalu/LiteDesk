const deliveryNoteService = require('../services/deliveryNoteService');
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
  const name =
    [ref.firstName || ref.first_name, ref.lastName || ref.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    ref.email ||
    '';
  return name ? { ...ref, name } : ref;
}

/** Flatten for GenericModule / ModuleRecordPage. */
function flattenDnResult(result) {
  if (!result?.deliveryNote) return result;
  const lines = (result.lines || []).map((line) => ({
    ...line,
    quantity: line.quantityDelivered,
    deliveryNoteLineId: line._id
  }));
  const dn = { ...result.deliveryNote };
  if (dn.customerId) dn.customerId = hydratePopulatedRef(dn.customerId);
  if (dn.contactPersonId) dn.contactPersonId = hydratePopulatedRef(dn.contactPersonId);
  if (dn.ownerId) dn.ownerId = hydratePopulatedRef(dn.ownerId);
  if (dn.createdBy) dn.createdBy = hydratePopulatedRef(dn.createdBy);
  if (dn.modifiedBy) dn.modifiedBy = hydratePopulatedRef(dn.modifiedBy);
  return { ...dn, lines };
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
    const result = await deliveryNoteService.listDeliveryNotes({
      organizationId: req.user.organizationId,
      status: req.query.status || null,
      salesOrderId: req.query.salesOrderId || null,
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
    const salesOrderIds = req.query.salesOrderIds
      ? String(req.query.salesOrderIds).split(',').filter(Boolean)
      : null;
    const data = await deliveryNoteService.listEligibleDeliverySources({
      organizationId: req.user.organizationId,
      customerId: req.query.customerId,
      salesOrderIds
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const body = req.body || {};
    // Legacy MVP create only sent salesOrderId + inventoryLocationId (no subject)
    const isLegacy =
      body.salesOrderId && !body.subject && !body.customerId && !body.salesOrderIds;
    const data = isLegacy
      ? await deliveryNoteService.createDeliveryNoteLegacy({
          organizationId: req.user.organizationId,
          userId: req.user._id,
          payload: body
        })
      : await deliveryNoteService.createDeliveryNote({
          organizationId: req.user.organizationId,
          userId: req.user._id,
          payload: body
        });
    return res.status(201).json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/:id', checkPermission('inventory', 'view'), async (req, res) => {
  try {
    const data = await deliveryNoteService.getDeliveryNote({
      organizationId: req.user.organizationId,
      id: req.params.id
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/:id', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.updateDeliveryNote({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/:id/lines/:lineId', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.updateDeliveryNoteLine({
      organizationId: req.user.organizationId,
      id: req.params.id,
      lineId: req.params.lineId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/:id/lines/:lineId', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.deleteDeliveryNoteLine({
      organizationId: req.user.organizationId,
      id: req.params.id,
      lineId: req.params.lineId,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/lines/from-sources', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.addDeliveryNoteLinesFromSources({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/approve', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.approveDeliveryNote({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/pick', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.markDeliveryNotePicked({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/pack', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.markDeliveryNotePacked({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/dispatch', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.markDeliveryNoteDispatched({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/deliver', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.markDeliveryNoteDelivered({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/confirm', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.confirmDeliveryNote({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/send-email', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const { sendDeliveryNoteEmail } = require('../services/deliveryNoteEmailService');
    const data = await sendDeliveryNoteEmail({
      organizationId: req.user.organizationId,
      deliveryNoteId: req.params.id,
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
            err?.code === 'DN_NOT_EMAILABLE'
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
    const data = await deliveryNoteService.cancelDeliveryNote({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/duplicate', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await deliveryNoteService.duplicateDeliveryNote({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.status(201).json({ success: true, data: flattenDnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;

const procurementService = require('../services/procurementService');
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
  const name = [
    ref.firstName || ref.first_name,
    ref.lastName || ref.last_name
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || ref.email || '';
  return name ? { ...ref, name } : ref;
}

/** Flatten for GenericModule / ModuleRecordPage. */
function flattenPrResult(result) {
  if (!result?.purchaseReturn) return result;
  const lines = (result.lines || []).map((line) => ({
    ...line,
    quantity: line.quantityReturned,
    purchaseReturnLineId: line._id
  }));
  const pr = { ...result.purchaseReturn };
  if (pr.vendorId) pr.vendorId = hydratePopulatedRef(pr.vendorId);
  if (pr.vendorContactId) pr.vendorContactId = hydratePopulatedRef(pr.vendorContactId);
  if (pr.ownerId) pr.ownerId = hydratePopulatedRef(pr.ownerId);
  if (pr.createdBy) pr.createdBy = hydratePopulatedRef(pr.createdBy);
  if (pr.modifiedBy) pr.modifiedBy = hydratePopulatedRef(pr.modifiedBy);
  return { ...pr, lines };
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
    const result = await procurementService.listPurchaseReturns({
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
    const receiptNoteIds = req.query.receiptNoteIds
      ? String(req.query.receiptNoteIds).split(',').filter(Boolean)
      : null;
    const purchaseOrderIds = req.query.purchaseOrderIds
      ? String(req.query.purchaseOrderIds).split(',').filter(Boolean)
      : null;
    const data = await procurementService.listEligibleReturnSources({
      organizationId: req.user.organizationId,
      vendorId: req.query.vendorId,
      receiptNoteIds,
      purchaseOrderIds
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.createPurchaseReturn({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data: flattenPrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/:id', checkPermission('inventory', 'view'), async (req, res) => {
  try {
    const data = await procurementService.getPurchaseReturn({
      organizationId: req.user.organizationId,
      id: req.params.id
    });
    return res.json({ success: true, data: flattenPrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/:id', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.updatePurchaseReturn({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenPrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/:id/lines/:lineId', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.updatePurchaseReturnLine({
      organizationId: req.user.organizationId,
      id: req.params.id,
      lineId: req.params.lineId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenPrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/:id/lines/:lineId', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.deletePurchaseReturnLine({
      organizationId: req.user.organizationId,
      id: req.params.id,
      lineId: req.params.lineId,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenPrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/lines/from-sources', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.addPurchaseReturnLinesFromSources({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenPrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/approve', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.approvePurchaseReturn({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenPrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

/** Complete return: inventory + RN/PO qty (PM: Returned). */
router.post('/:id/return', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.markPurchaseReturnReturned({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenPrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/send-email', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const { sendPurchaseReturnEmail } = require('../services/purchaseReturnEmailService');
    const data = await sendPurchaseReturnEmail({
      organizationId: req.user.organizationId,
      purchaseReturnId: req.params.id,
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
            err?.code === 'PR_NOT_EMAILABLE'
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
    const data = await procurementService.cancelPurchaseReturn({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenPrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/duplicate', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.duplicatePurchaseReturn({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.status(201).json({ success: true, data: flattenPrResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;

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
  if (ref.poNumber) return { ...ref, name: ref.poNumber + (ref.subject ? ` — ${ref.subject}` : '') };
  if (ref.locationCode) return { ...ref, name: ref.locationCode };
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
function flattenRnResult(result) {
  if (!result?.receiptNote) return result;
  const lines = result.lines || [];
  const rn = { ...result.receiptNote };
  if (rn.vendorId) rn.vendorId = hydratePopulatedRef(rn.vendorId);
  if (rn.purchaseOrderId) rn.purchaseOrderId = hydratePopulatedRef(rn.purchaseOrderId);
  if (rn.receiptLocationId) rn.receiptLocationId = hydratePopulatedRef(rn.receiptLocationId);
  if (rn.receivedBy) rn.receivedBy = hydratePopulatedRef(rn.receivedBy);
  if (rn.createdBy) rn.createdBy = hydratePopulatedRef(rn.createdBy);
  if (rn.modifiedBy) rn.modifiedBy = hydratePopulatedRef(rn.modifiedBy);
  return { ...rn, lines };
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
    const result = await procurementService.listReceiptNotes({
      organizationId: req.user.organizationId,
      purchaseOrderId: req.query.purchaseOrderId || null,
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

router.post('/', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.createReceiptNote({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data: flattenRnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/:id', checkPermission('inventory', 'view'), async (req, res) => {
  try {
    const data = await procurementService.getReceiptNote({
      organizationId: req.user.organizationId,
      id: req.params.id
    });
    return res.json({ success: true, data: flattenRnResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/verify', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.verifyReceiptNote({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    // verify may return note or nested; normalize if nested
    const flat = data?.receiptNote ? flattenRnResult(data) : data;
    return res.json({ success: true, data: flat });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;

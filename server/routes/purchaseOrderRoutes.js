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

/** Flatten { purchaseOrder, lines } for GenericModule / ModuleRecordPage / QuoteLines. */
function normalizePoLine(line) {
  if (!line) return line;
  return {
    ...line,
    quantity: line.quantityOrdered,
    purchaseOrderLineId: line._id
  };
}

function flattenPoResult(result) {
  if (!result?.purchaseOrder) return result;
  const lines = (result.lines || []).map(normalizePoLine);
  const out = { ...result.purchaseOrder, lines };
  if (result.line) out.line = normalizePoLine(result.line);
  return out;
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
    const result = await procurementService.listPurchaseOrders({
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

router.post('/', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.createPurchaseOrder({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data: flattenPoResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/:id', checkPermission('inventory', 'view'), async (req, res) => {
  try {
    const data = await procurementService.getPurchaseOrder({
      organizationId: req.user.organizationId,
      id: req.params.id
    });
    return res.json({ success: true, data: flattenPoResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

async function updateHeader(req, res) {
  try {
    const data = await procurementService.updatePurchaseOrder({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenPoResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
}

router.put('/:id', checkPermission('inventory', 'adjust'), updateHeader);
router.patch('/:id', checkPermission('inventory', 'adjust'), updateHeader);

router.post('/:id/lines', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.addPurchaseOrderLine({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data: flattenPoResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/:id/lines/:lineId', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.updatePurchaseOrderLine({
      organizationId: req.user.organizationId,
      id: req.params.id,
      lineId: req.params.lineId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data: flattenPoResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/:id/lines/:lineId', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.deletePurchaseOrderLine({
      organizationId: req.user.organizationId,
      id: req.params.id,
      lineId: req.params.lineId,
      userId: req.user._id
    });
    return res.json({ success: true, data: flattenPoResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/submit', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.submitPurchaseOrder({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/approve', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.approvePurchaseOrder({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/cancel', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.cancelPurchaseOrder({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;

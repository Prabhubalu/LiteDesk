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

/** Ensure populated ref objects have a display `name` for Details (people use first_name). */
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

function flattenPoResult(result) {
  if (!result?.purchaseOrder) return result;
  const lines = (result.lines || []).map(normalizePoLine);
  const po = { ...result.purchaseOrder };
  if (po.vendorId) po.vendorId = hydratePopulatedRef(po.vendorId);
  if (po.vendorContactId) po.vendorContactId = hydratePopulatedRef(po.vendorContactId);
  if (po.buyerId) po.buyerId = hydratePopulatedRef(po.buyerId);
  const out = { ...po, lines };
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

router.post('/:id/order', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.markPurchaseOrderOrdered({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/duplicate', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.duplicatePurchaseOrder({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.status(201).json({ success: true, data: flattenPoResult(data) });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/:id/discounts', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const body = req.body || {};
    const payload = {};
    if (Object.prototype.hasOwnProperty.call(body, 'globalDiscountType')
      || Object.prototype.hasOwnProperty.call(body, 'overallDiscountType')) {
      payload.overallDiscountType = body.globalDiscountType ?? body.overallDiscountType ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'globalDiscountValue')
      || Object.prototype.hasOwnProperty.call(body, 'overallDiscountValue')) {
      payload.overallDiscountValue =
        body.globalDiscountValue != null
          ? body.globalDiscountValue
          : body.overallDiscountValue;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'adjustmentTotal')) {
      payload.adjustmentTotal = body.adjustmentTotal;
    }
    const data = await procurementService.updatePurchaseOrder({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload
    });
    const flat = flattenPoResult(data);
    return res.json({
      success: true,
      data: {
        ...flat,
        purchaseOrder: flat,
        quote: {
          globalDiscountType: flat.overallDiscountType,
          globalDiscountValue: flat.overallDiscountValue,
          globalDiscountTotal: flat.overallDiscountTotal,
          adjustmentTotal: flat.adjustmentTotal,
          subtotal: flat.subtotal,
          taxTotal: flat.taxTotal,
          chargesTotal: flat.chargesTotal,
          grandTotal: flat.grandTotal,
          preTaxTotal: flat.preTaxTotal,
          transactionTaxSnapshot: flat.transactionTaxSnapshot,
          chargeDocumentSnapshot: flat.chargeDocumentSnapshot
        },
        lines: flat.lines,
        totals: data.totals || null
      }
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/:id/taxes-charges', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.patchPurchaseOrderTaxesCharges({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      body: req.body || {}
    });
    const flat = flattenPoResult(data);
    return res.json({
      success: true,
      data: {
        ...flat,
        purchaseOrder: flat,
        quote: data.quote || flat,
        lines: flat.lines || data.lines,
        totals: data.totals || null
      }
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/recalculate', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await procurementService.updatePurchaseOrder({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: {}
    });
    const flat = flattenPoResult(data);
    return res.json({
      success: true,
      data: {
        ...flat,
        purchaseOrder: flat,
        quote: {
          globalDiscountType: flat.overallDiscountType,
          globalDiscountValue: flat.overallDiscountValue,
          globalDiscountTotal: flat.overallDiscountTotal,
          adjustmentTotal: flat.adjustmentTotal,
          subtotal: flat.subtotal,
          taxTotal: flat.taxTotal,
          chargesTotal: flat.chargesTotal,
          grandTotal: flat.grandTotal,
          preTaxTotal: flat.preTaxTotal,
          transactionTaxSnapshot: flat.transactionTaxSnapshot,
          chargeDocumentSnapshot: flat.chargeDocumentSnapshot
        },
        lines: flat.lines,
        totals: data.totals || null
      }
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/:id/send-email', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const { sendPurchaseOrderEmail } = require('../services/purchaseOrderEmailService');
    const data = await sendPurchaseOrderEmail({
      organizationId: req.user.organizationId,
      purchaseOrderId: req.params.id,
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
            err?.code === 'PO_NOT_EMAILABLE'
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

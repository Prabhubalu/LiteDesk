const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const { recordPayment } = require('../services/paymentRecordService');
const { applyPaymentAllocations } = require('../services/paymentAllocationService');
const { reversePaymentAllocations } = require('../services/paymentReversalService');
const { buildInvoicePaymentSummary } = require('../services/invoicePaymentSummaryService');
const {
  createRefund,
  getRefundById,
  listRefundsForPayment,
  buildPaymentRefundEligibility
} = require('../services/refundService');

function handleControllerError(res, error) {
  const code = error?.code;
  const status =
    code === 'NOT_FOUND'
      ? 404
      : code === 'VALIDATION' ||
          code === 'INVOICE_NOT_PAYABLE' ||
          code === 'ACCOUNT_MISMATCH' ||
          code === 'CURRENCY_MISMATCH' ||
          code === 'NOTHING_TO_APPLY' ||
          code === 'NOTHING_TO_REVERSE' ||
          code === 'EXCEEDS_REFUNDABLE' ||
          code === 'EXCEEDS_UNALLOCATED' ||
          code === 'REFUND_AMOUNT_MISMATCH'
        ? 400
        : code === 'EXCEEDS_AMOUNT_DUE'
          ? 422
          : 500;

  return res.status(status).json({
    success: false,
    message: error?.message || 'Request failed',
    code: code || 'ERROR',
    details: error?.details || undefined
  });
}

async function createPaymentHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const body = req.body || {};

    const result = await recordPayment({
      organizationId,
      userId: req.user._id,
      organizationRefId: body.organizationRefId,
      contactId: body.contactId || null,
      amount: body.amount,
      paymentCurrency: body.paymentCurrency || 'USD',
      paymentDate: body.paymentDate,
      valueDate: body.valueDate || null,
      paymentPurpose: body.paymentPurpose || 'invoice_payment',
      paymentInstrumentSnapshot: body.paymentInstrumentSnapshot || {},
      externalReference: body.externalReference || null,
      notes: body.notes || null,
      sourceContext: body.sourceContext || 'manual',
      sourceRef: body.sourceRef || null,
      autoApply: body.autoApply,
      allocations: body.allocations || null
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function listPaymentsHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const filter = { organizationId, deletedAt: null };
    if (req.query.organizationRefId) {
      filter.organizationRefId = req.query.organizationRefId;
    }
    if (req.query.status) filter.status = req.query.status;

    const payments = await Payment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, data: payments });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function getPaymentByIdHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;

    const payment = await Payment.findOne({
      organizationId,
      deletedAt: null,
      $or: [{ _id: id }, { paymentId: id }]
    }).lean();

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found', code: 'NOT_FOUND' });
    }

    const allocationsRaw = await PaymentAllocation.find({
      organizationId,
      paymentMongoId: payment._id
    })
      .sort({ appliedAt: -1 })
      .lean();

    const Invoice = require('../models/Invoice');
    const invoiceMongoIds = [...new Set(allocationsRaw.map((row) => String(row.invoiceMongoId)))];
    const invoices = invoiceMongoIds.length
      ? await Invoice.find({ organizationId, _id: { $in: invoiceMongoIds } })
          .select('invoiceNumber')
          .lean()
      : [];
    const invoiceById = new Map(invoices.map((row) => [String(row._id), row]));

    const allocations = allocationsRaw.map((row) => {
      const invoice = invoiceById.get(String(row.invoiceMongoId));
      return {
        ...row,
        invoiceNumber: invoice?.invoiceNumber || null
      };
    });

    const refunds = await listRefundsForPayment({
      organizationId,
      paymentMongoId: payment._id
    });

    let refundEligibility = null;
    if (String(req.query.include || '').includes('refundEligibility')) {
      refundEligibility = await buildPaymentRefundEligibility({
        organizationId,
        paymentMongoId: payment._id
      });
    }

    return res.json({
      success: true,
      data: { payment, allocations, refunds, refundEligibility }
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function applyPaymentAllocationsHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;
    const body = req.body || {};

    const payment = await Payment.findOne({
      organizationId,
      deletedAt: null,
      $or: [{ _id: id }, { paymentId: id }]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found', code: 'NOT_FOUND' });
    }

    const result = await applyPaymentAllocations({
      organizationId,
      paymentMongoId: payment._id,
      userId: req.user._id,
      allocations: body.allocations || [],
      manualOverride: true
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function reversePaymentHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;
    const body = req.body || {};

    const payment = await Payment.findOne({
      organizationId,
      deletedAt: null,
      $or: [{ _id: id }, { paymentId: id }]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found', code: 'NOT_FOUND' });
    }

    const result = await reversePaymentAllocations({
      organizationId,
      paymentMongoId: payment._id,
      userId: req.user._id,
      paymentAllocationIds: body.paymentAllocationIds || null,
      reversalType: body.reversalType || 'other',
      reversalReason: body.reversalReason,
      reversalReasonCode: body.reversalReasonCode || null
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function getInvoicePaymentSummaryHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const invoiceId = req.params.id;

    const Invoice = require('../models/Invoice');
    const invoice = await Invoice.findOne({
      organizationId,
      deletedAt: null,
      $or: [{ _id: invoiceId }, { invoiceId }]
    }).lean();

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found', code: 'NOT_FOUND' });
    }

    const summary = await buildInvoicePaymentSummary({
      organizationId,
      invoiceMongoId: invoice._id
    });

    return res.json({ success: true, data: summary });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function listInvoicePaymentAllocationsHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const invoiceId = req.params.id;

    const Invoice = require('../models/Invoice');
    const invoice = await Invoice.findOne({
      organizationId,
      deletedAt: null,
      $or: [{ _id: invoiceId }, { invoiceId }]
    }).lean();

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found', code: 'NOT_FOUND' });
    }

    const summary = await buildInvoicePaymentSummary({
      organizationId,
      invoiceMongoId: invoice._id
    });

    return res.json({ success: true, data: summary.allocations });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function createRefundHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;
    const body = req.body || {};

    const payment = await Payment.findOne({
      organizationId,
      deletedAt: null,
      $or: [{ _id: id }, { paymentId: id }]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found', code: 'NOT_FOUND' });
    }

    const result = await createRefund({
      organizationId,
      paymentMongoId: payment._id,
      userId: req.user._id,
      amount: body.amount,
      reason: body.reason,
      reasonNote: body.reasonNote || null,
      refundMethod: body.refundMethod || 'other',
      refundDate: body.refundDate || null,
      referenceNumber: body.referenceNumber || null,
      notes: body.notes || null,
      unwindAllocationIds: body.unwindAllocationIds || [],
      unallocatedPortion: body.unallocatedPortion || 0,
      idempotencyKey: body.idempotencyKey || null
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function listPaymentRefundsHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;

    const payment = await Payment.findOne({
      organizationId,
      deletedAt: null,
      $or: [{ _id: id }, { paymentId: id }]
    }).lean();

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found', code: 'NOT_FOUND' });
    }

    const refunds = await listRefundsForPayment({
      organizationId,
      paymentMongoId: payment._id
    });

    return res.json({ success: true, data: refunds });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function getPaymentRefundEligibilityHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;

    const payment = await Payment.findOne({
      organizationId,
      deletedAt: null,
      $or: [{ _id: id }, { paymentId: id }]
    }).lean();

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found', code: 'NOT_FOUND' });
    }

    const eligibility = await buildPaymentRefundEligibility({
      organizationId,
      paymentMongoId: payment._id
    });

    return res.json({ success: true, data: eligibility });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function getRefundByIdHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const result = await getRefundById({
      organizationId,
      refundIdOrMongoId: req.params.id
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

module.exports = {
  createPaymentHandler,
  listPaymentsHandler,
  getPaymentByIdHandler,
  applyPaymentAllocationsHandler,
  reversePaymentHandler,
  listInvoicePaymentAllocationsHandler,
  getInvoicePaymentSummaryHandler,
  createRefundHandler,
  listPaymentRefundsHandler,
  getPaymentRefundEligibilityHandler,
  getRefundByIdHandler
};

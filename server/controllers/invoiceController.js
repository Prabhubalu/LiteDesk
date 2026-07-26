const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const { assertValidInvoiceStatus } = require('../constants/invoiceLifecycle');
const { listInvoiceSections } = require('../services/invoiceSectionService');
const { postInvoice } = require('../services/invoicePostService');
const { voidInvoice } = require('../services/invoiceVoidService');
const { convertSalesOrderToInvoice } = require('../services/invoiceConversionService');
const {
  createManualInvoice,
  patchInvoiceHeader,
  deleteDraftInvoice
} = require('../services/invoiceManualService');
const {
  createCreditNoteFromInvoice,
  buildInvoiceCreditSummary
} = require('../services/invoiceCreditNoteService');
const {
  buildMultiSoReadinessSummary,
  convertMultipleSalesOrdersToInvoice
} = require('../services/invoiceMultiSoConversionService');
const {
  submitInvoiceForApproval,
  approveInvoice,
  rejectInvoice
} = require('../services/invoiceWorkflowService');
const { sendInvoiceEmail } = require('../services/invoiceEmailService');
const invoiceDocumentController = require('../controllers/invoiceDocumentController');

const INVOICE_LIST_STATUSES = [
  'Draft',
  'Pending Approval',
  'Approved',
  'Posted',
  'Partially Paid',
  'Paid',
  'Void',
  'Written Off'
];

function handleControllerError(res, error) {
  const code = error?.code;
  const status =
    code === 'NOT_FOUND'
      ? 404
      : code === 'VALIDATION' ||
          code === 'INVALID_TRANSITION' ||
          code === 'INVOICE_STATUS_RESERVED' ||
          code === 'SO_NOT_INVOICEABLE' ||
          code === 'NOTHING_TO_INVOICE' ||
          code === 'INVOICE_HAS_PAYMENTS' ||
          code === 'INVOICE_NOT_DRAFT' ||
          code === 'INVOICE_COMMERCIAL_LOCK' ||
          code === 'INVOICE_NOT_PENDING' ||
          code === 'INVOICE_NOT_POSTED' ||
          code === 'NOTHING_TO_CREDIT' ||
          code === 'EMAIL_NOT_CONFIGURED' ||
          code === 'MISSING_RECIPIENT' ||
          code === 'INCOMPATIBLE_SALES_ORDERS'
        ? 400
        : code === 'SO_LINE_NOT_FOUND' ||
            code === 'EXCEEDS_BILLABLE_QTY' ||
            code === 'EXCEEDS_CREDITABLE_QTY' ||
            code === 'INVOICE_LINE_NOT_FOUND'
          ? 422
          : code === 'EMAIL_SEND_FAILED'
            ? 502
          : 500;

  return res.status(status).json({
    success: false,
    message: error?.message || 'Request failed',
    code: code || 'ERROR',
    details: error?.details || undefined
  });
}

function userCanOverrideBillOnFulfill(req) {
  if (req.user?.isOwner) return true;
  const role = String(req.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin';
}

function buildInvoiceListQuery(req) {
  const organizationId = req.user.organizationId;
  const q = { organizationId, deletedAt: null };

  if (req.query?.status) {
    assertValidInvoiceStatus(String(req.query.status));
    q.status = String(req.query.status);
  }
  if (req.query?.assignedTo) q.assignedTo = req.query.assignedTo;
  if (req.query?.sourceType) q.sourceType = String(req.query.sourceType).trim();

  if (req.filterByUser && !req.viewAll) {
    q.assignedTo = req.filterByUser;
  }

  const searchTerm = req.query?.search != null ? String(req.query.search).trim() : '';
  if (searchTerm) {
    const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [
      { invoiceNumber: searchRegex },
      { invoiceTitle: searchRegex },
      { status: searchRegex }
    ];
  }

  return q;
}

async function computeInvoiceListStatistics(matchQuery) {
  const statusCounts = await Invoice.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const byStatus = Object.fromEntries(statusCounts.map((row) => [row._id, row.count]));
  return {
    draft: byStatus.Draft || 0,
    pendingApproval: byStatus['Pending Approval'] || 0,
    approved: byStatus.Approved || 0,
    posted: byStatus.Posted || 0,
    partiallyPaid: byStatus['Partially Paid'] || 0,
    paid: byStatus.Paid || 0,
    void: byStatus.Void || 0,
    writtenOff: byStatus['Written Off'] || 0,
    totalInvoices: INVOICE_LIST_STATUSES.reduce((sum, key) => sum + (byStatus[key] || 0), 0)
  };
}

async function getInvoices(req, res) {
  try {
    const q = buildInvoiceListQuery(req);
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 50));
    const page = Math.max(1, Number(req.query?.page) || 1);
    const skip = (page - 1) * limit;

    const allowedSortFields = new Set([
      'invoiceNumber',
      'invoiceTitle',
      'status',
      'grandTotal',
      'amountDue',
      'updatedAt',
      'createdAt',
      'invoiceDate',
      'postedAt'
    ]);
    const { parseListSort } = require('../utils/parseListSort');
    const { sortObject } = parseListSort(req.query, {
      allowedFields: allowedSortFields,
      defaultField: 'updatedAt',
      defaultOrder: 'desc',
      tieBreaker: '_id'
    });

    const [rows, total, statusBreakdown] = await Promise.all([
      Invoice.find(q).sort(sortObject).skip(skip).limit(limit).lean(),
      Invoice.countDocuments(q),
      computeInvoiceListStatistics(q)
    ]);

    return res.json({
      success: true,
      data: rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        totalRecords: total,
        limit
      },
      meta: { page, limit, total },
      listStatistics: {
        ...statusBreakdown,
        totalInvoices: total,
        myInvoices: total
      }
    });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function createInvoiceHandler(req, res) {
  try {
    const invoice = await createManualInvoice({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      body: req.body
    });
    return res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function getInvoiceById(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;

    const invoiceDoc =
      (await Invoice.findOne({ organizationId, invoiceId: id, deletedAt: null })
        .populate({ path: 'assignedTo', select: 'firstName lastName email username' })
        .populate({ path: 'organizationRefId', select: 'name' })
        .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })
        .populate({ path: 'dealId', select: 'name stage pipeline amount value currency' })) ||
      (await Invoice.findOne({ organizationId, _id: id, deletedAt: null })
        .populate({ path: 'assignedTo', select: 'firstName lastName email username' })
        .populate({ path: 'organizationRefId', select: 'name' })
        .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })
        .populate({ path: 'dealId', select: 'name stage pipeline amount value currency' }));

    if (!invoiceDoc) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoiceDoc.toObject();
    const [sections, lines, creditSummary, sourceInvoice] = await Promise.all([
      listInvoiceSections({ organizationId, invoiceId: invoice._id }),
      InvoiceLine.find({ organizationId, invoiceId: invoice._id })
        .sort({ lineOrder: 1, createdAt: 1 })
        .lean(),
      String(invoice.invoiceType || 'standard') !== 'credit_note'
        ? buildInvoiceCreditSummary({ organizationId, sourceInvoice: invoiceDoc })
        : Promise.resolve(null),
      String(invoice.invoiceType || 'standard') === 'credit_note' && invoice.sourceInvoiceId
        ? Invoice.findOne({ organizationId, invoiceId: invoice.sourceInvoiceId, deletedAt: null })
            .select('invoiceId invoiceNumber status grandTotal amountDue postedAt')
            .lean()
        : Promise.resolve(null)
    ]);

    return res.json({
      success: true,
      data: {
        ...invoice,
        sections,
        lines,
        creditSummary,
        sourceInvoice: sourceInvoice || undefined
      }
    });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function patchInvoiceHandler(req, res) {
  try {
    const invoice = await patchInvoiceHeader({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id,
      body: req.body
    });
    return res.json({ success: true, data: invoice });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function deleteInvoiceHandler(req, res) {
  try {
    const result = await deleteDraftInvoice({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function convertFromSalesOrderHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const result = await convertSalesOrderToInvoice({
      organizationId,
      salesOrderId: req.params.salesOrderId,
      userId: req.user._id,
      body: req.body,
      overrideBillOnFulfill: userCanOverrideBillOnFulfill(req)
    });

    let posted = null;
    if (req.body?.post === true) {
      posted = await postInvoice({
        organizationId,
        invoiceMongoId: result.invoice._id,
        userId: req.user._id
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        invoiceId: result.invoice.invoiceId,
        invoiceMongoId: result.invoice._id,
        invoiceNumber: result.invoice.invoiceNumber,
        status: posted?.invoice?.status || result.invoice.status,
        grandTotal: posted?.invoice?.grandTotal ?? result.invoice.grandTotal,
        salesOrderId: result.salesOrder.salesOrderId,
        salesOrderNumber: result.salesOrder.salesOrderNumber,
        lineSelections: result.lineSelections,
        posted: Boolean(posted)
      }
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function submitInvoiceHandler(req, res) {
  try {
    const invoice = await submitInvoiceForApproval({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: invoice });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function approveInvoiceHandler(req, res) {
  try {
    const invoice = await approveInvoice({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: invoice });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function rejectInvoiceHandler(req, res) {
  try {
    const invoice = await rejectInvoice({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id,
      reason: req.body?.reason
    });
    return res.json({ success: true, data: invoice });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function postInvoiceHandler(req, res) {
  try {
    const result = await postInvoice({
      organizationId: req.user.organizationId,
      invoiceMongoId: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, invoice: result.invoice, allocations: result.allocations });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function voidInvoiceHandler(req, res) {
  try {
    const result = await voidInvoice({
      organizationId: req.user.organizationId,
      invoiceMongoId: req.params.id,
      userId: req.user._id,
      reversalReason: req.body?.reversalReason || req.body?.reason
    });
    return res.json({ success: true, invoice: result.invoice, reversed: result.reversed });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function getInvoiceCreditSummaryHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const invoiceDoc =
      (await Invoice.findOne({ organizationId, invoiceId: req.params.id, deletedAt: null })) ||
      (await Invoice.findOne({ organizationId, _id: req.params.id, deletedAt: null }));

    if (!invoiceDoc) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const summary = await buildInvoiceCreditSummary({ organizationId, sourceInvoice: invoiceDoc });
    return res.json({ success: true, data: summary });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function createCreditNoteHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const result = await createCreditNoteFromInvoice({
      organizationId,
      sourceInvoiceRef: req.params.invoiceId,
      userId: req.user._id,
      body: req.body
    });

    let posted = null;
    if (req.body?.post === true) {
      posted = await postInvoice({
        organizationId,
        invoiceMongoId: result.creditNote._id,
        userId: req.user._id
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        creditNoteId: result.creditNote.invoiceId,
        creditNoteMongoId: result.creditNote._id,
        creditNoteNumber: result.creditNote.invoiceNumber,
        status: posted?.invoice?.status || result.creditNote.status,
        grandTotal: posted?.invoice?.grandTotal ?? result.creditNote.grandTotal,
        sourceInvoiceId: result.sourceInvoice.invoiceId,
        sourceInvoiceNumber: result.sourceInvoice.invoiceNumber,
        lineSelections: result.lineSelections,
        posted: Boolean(posted)
      }
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function sendInvoiceEmailHandler(req, res) {
  try {
    const data = await sendInvoiceEmail({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id,
      body: { ...(req.body || {}), resend: req.body?.resend === true },
      req
    });
    return res.json({ success: true, data });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function multiSoReadinessHandler(req, res) {
  try {
    const salesOrderIds = req.body?.salesOrderIds || req.query?.salesOrderIds;
    const ids = Array.isArray(salesOrderIds)
      ? salesOrderIds
      : String(salesOrderIds || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    const summary = await buildMultiSoReadinessSummary({
      organizationId: req.user.organizationId,
      salesOrderIds: ids
    });
    return res.json({ success: true, data: summary });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function convertFromMultipleSalesOrdersHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const result = await convertMultipleSalesOrdersToInvoice({
      organizationId,
      userId: req.user._id,
      body: req.body,
      overrideBillOnFulfill: userCanOverrideBillOnFulfill(req)
    });

    let posted = null;
    if (req.body?.post === true) {
      posted = await postInvoice({
        organizationId,
        invoiceMongoId: result.invoice._id,
        userId: req.user._id
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        invoiceId: result.invoice.invoiceId,
        invoiceMongoId: result.invoice._id,
        invoiceNumber: result.invoice.invoiceNumber,
        status: posted?.invoice?.status || result.invoice.status,
        grandTotal: posted?.invoice?.grandTotal ?? result.invoice.grandTotal,
        salesOrders: result.salesOrders.map((o) => ({
          salesOrderId: o.salesOrderId,
          salesOrderNumber: o.salesOrderNumber
        })),
        lineSelections: result.lineSelections,
        posted: Boolean(posted)
      }
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

module.exports = {
  getInvoices,
  createInvoiceHandler,
  getInvoiceById,
  patchInvoiceHandler,
  deleteInvoiceHandler,
  convertFromSalesOrderHandler,
  submitInvoiceHandler,
  approveInvoiceHandler,
  rejectInvoiceHandler,
  postInvoiceHandler,
  voidInvoiceHandler,
  getInvoiceCreditSummaryHandler,
  createCreditNoteHandler,
  sendInvoiceEmailHandler,
  multiSoReadinessHandler,
  convertFromMultipleSalesOrdersHandler
};

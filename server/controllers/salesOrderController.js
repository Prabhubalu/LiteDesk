const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const {
  assertValidSalesOrderStatus
} = require('../constants/salesOrderLifecycle');
const { convertQuoteToSalesOrder } = require('../services/salesOrderConversionService');
const { listSalesOrderSections } = require('../services/salesOrderSectionService');
const { userCanOverrideExpiredQuotes } = require('../services/quoteConversionService');
const {
  createManualSalesOrder,
  confirmSalesOrder,
  cancelSalesOrder,
  deleteDraftSalesOrder
} = require('../services/salesOrderManualService');
const {
  listSalesOrderFulfillments,
  postSalesOrderFulfillment,
  reverseSalesOrderFulfillment
} = require('../services/salesOrderFulfillmentService');
const { splitSalesOrder } = require('../services/salesOrderSplitService');
const { mergeSalesOrders } = require('../services/salesOrderMergeService');
const {
  listSalesOrderInvoiceAllocations,
  buildInvoiceReadinessSummary,
  buildSalesOrderBillingCoverage
} = require('../services/salesOrderInvoiceAllocationService');

const SALES_ORDER_LIST_STATUSES = [
  'Draft',
  'Confirmed',
  'In Fulfillment',
  'Partially Fulfilled',
  'Fulfilled',
  'Cancelled'
];

function buildSalesOrderListQuery(req) {
  const organizationId = req.user.organizationId;
  const status = req.query?.status;
  const assignedTo = req.query?.assignedTo;
  const sourceQuoteId = req.query?.sourceQuoteId;
  const sourceType = req.query?.sourceType;

  const q = { organizationId, deletedAt: null };
  if (status) {
    assertValidSalesOrderStatus(status);
    q.status = status;
  }
  if (assignedTo) q.assignedTo = assignedTo;
  if (sourceQuoteId) q.sourceQuoteId = sourceQuoteId;
  if (sourceType) q.sourceType = String(sourceType).trim();

  if (req.filterByUser && !req.viewAll) {
    q.assignedTo = req.filterByUser;
  }

  const searchTerm = req.query?.search != null ? String(req.query.search).trim() : '';
  if (searchTerm) {
    const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [
      { salesOrderNumber: searchRegex },
      { orderTitle: searchRegex },
      { sourceQuoteNumber: searchRegex },
      { status: searchRegex }
    ];
  }

  return q;
}

async function computeSalesOrderListStatistics(matchQuery) {
  const statusCounts = await SalesOrder.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((row) => [row._id, row.count]));
  return {
    draft: byStatus.Draft || 0,
    confirmed: byStatus.Confirmed || 0,
    inFulfillment: byStatus['In Fulfillment'] || 0,
    partiallyFulfilled: byStatus['Partially Fulfilled'] || 0,
    completed: byStatus.Fulfilled || 0,
    cancelled: byStatus.Cancelled || 0,
    totalSalesOrders: SALES_ORDER_LIST_STATUSES.reduce((sum, key) => sum + (byStatus[key] || 0), 0)
  };
}

function mapConversionErrorStatus(err) {
  const code = err?.code;
  if (
    code === 'VALIDATION' ||
    code === 'INVALID_TRANSITION' ||
    code === 'ALREADY_CONVERTED' ||
    code === 'CONVERSION_NOT_ALLOWED' ||
    code === 'QUOTE_EXPIRED' ||
    code === 'NOTHING_TO_CONVERT' ||
    code === 'INVALID_LINE_SELECTION' ||
    code === 'LINES_ALREADY_CONVERTED'
  ) {
    return 400;
  }
  if (code === 'NOT_FOUND') return 404;
  return 500;
}

/**
 * POST /api/sales-orders/from-quote/:quoteId
 */
async function convertFromQuote(req, res) {
  try {
    const overrideExpired = userCanOverrideExpiredQuotes(req);
    const result = await convertQuoteToSalesOrder({
      organizationId: req.user.organizationId,
      quoteId: req.params.quoteId,
      userId: req.user._id,
      body: req.body,
      overrideExpired
    });

    return res.status(201).json({
      success: true,
      data: {
        quoteId: result.quote._id,
        quoteStatus: result.quote.status,
        converted: result.quote.converted === true,
        conversionStatus: result.quote.conversionStatus,
        conversionLinkId: result.link._id,
        salesOrderId: result.salesOrder.salesOrderId,
        salesOrderMongoId: result.salesOrder._id,
        salesOrderNumber: result.salesOrder.salesOrderNumber,
        coverage: result.resolution.coverage,
        unmappedLineIds: result.resolution.unmappedLineIds
      }
    });
  } catch (err) {
    return res.status(mapConversionErrorStatus(err)).json({
      success: false,
      message: err.message || 'Failed to convert quote to sales order',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * GET /api/sales-orders
 */
async function getSalesOrders(req, res) {
  try {
    const q = buildSalesOrderListQuery(req);

    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 50));
    const page = Math.max(1, Number(req.query?.page) || 1);
    const skip = (page - 1) * limit;

    const allowedSortFields = new Set([
      'salesOrderNumber',
      'orderTitle',
      'status',
      'fulfillmentStatus',
      'grandTotal',
      'updatedAt',
      'createdAt',
      'orderDate'
    ]);
    const sortBy = allowedSortFields.has(String(req.query?.sortBy || ''))
      ? String(req.query.sortBy)
      : 'updatedAt';
    const sortOrder = req.query?.sortOrder === 'asc' ? 1 : -1;

    const statsMatch = { ...q };
    delete statsMatch.status;

    const [rows, total, listStatistics] = await Promise.all([
      SalesOrder.find(q).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit).lean(),
      SalesOrder.countDocuments(q),
      computeSalesOrderListStatistics(statsMatch)
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
      listStatistics
    });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to fetch sales orders',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * GET /api/sales-orders/:id
 */
async function getSalesOrderById(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;

    const orderDoc =
      (await SalesOrder.findOne({ organizationId, salesOrderId: id, deletedAt: null })
        .populate({ path: 'assignedTo', select: 'firstName lastName email username' })
        .populate({ path: 'organizationRefId', select: 'name' })
        .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })
        .populate({ path: 'dealId', select: 'name stage pipeline amount value currency' })
        .populate({ path: 'sourceQuoteId', select: 'quoteNumber quoteTitle status revisionNumber' })) ||
      (await SalesOrder.findOne({ organizationId, _id: id, deletedAt: null })
        .populate({ path: 'assignedTo', select: 'firstName lastName email username' })
        .populate({ path: 'organizationRefId', select: 'name' })
        .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })
        .populate({ path: 'dealId', select: 'name stage pipeline amount value currency' })
        .populate({ path: 'sourceQuoteId', select: 'quoteNumber quoteTitle status revisionNumber' }));

    if (!orderDoc) {
      return res.status(404).json({ success: false, message: 'Sales order not found', code: 'NOT_FOUND' });
    }

    const order = orderDoc.toObject();
    const [sections, lines, parentOrder, childOrders, mergedFromOrders] = await Promise.all([
      listSalesOrderSections({ organizationId, salesOrderId: order._id }),
      SalesOrderLine.find({ organizationId, salesOrderId: order._id })
        .sort({ lineOrder: 1, createdAt: 1 })
        .lean(),
      order.parentSalesOrderId
        ? SalesOrder.findOne({ organizationId, _id: order.parentSalesOrderId, deletedAt: null })
            .select('salesOrderId salesOrderNumber orderTitle status')
            .lean()
        : null,
      SalesOrder.find({
        organizationId,
        parentSalesOrderId: order._id,
        deletedAt: null
      })
        .select('salesOrderId salesOrderNumber orderTitle status')
        .lean(),
      Array.isArray(order.mergedFromSalesOrderIds) && order.mergedFromSalesOrderIds.length
        ? SalesOrder.find({
            organizationId,
            _id: { $in: order.mergedFromSalesOrderIds },
            deletedAt: null
          })
            .select('salesOrderId salesOrderNumber orderTitle status lineageType')
            .lean()
        : []
    ]);

    let mergedIntoOrder = null;
    if (order.mergedIntoSalesOrderId) {
      mergedIntoOrder = await SalesOrder.findOne({
        organizationId,
        _id: order.mergedIntoSalesOrderId,
        deletedAt: null
      })
        .select('salesOrderId salesOrderNumber orderTitle status')
        .lean();
    }

    return res.json({
      success: true,
      data: {
        ...order,
        sections,
        lines,
        lineage: {
          parentOrder,
          childOrders,
          mergedFromOrders,
          mergedIntoOrder
        }
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch sales order',
      code: err?.code || 'UNKNOWN'
    });
  }
}

/**
 * POST /api/sales-orders
 */
async function createSalesOrder(req, res) {
  try {
    const order = await createManualSalesOrder({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      body: req.body
    });
    return res.status(201).json({ success: true, data: order });
  } catch (err) {
    return res.status(err?.code === 'VALIDATION' ? 400 : 500).json({
      success: false,
      message: err.message || 'Failed to create sales order',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * POST /api/sales-orders/:id/confirm
 */
async function confirmSalesOrderHandler(req, res) {
  try {
    const order = await confirmSalesOrder({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: order });
  } catch (err) {
    const status =
      err?.code === 'NOT_FOUND'
        ? 404
        : err?.code === 'INVALID_TRANSITION' || err?.code === 'INSUFFICIENT_ATP'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to confirm sales order',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * DELETE /api/sales-orders/:id
 * Draft only — moves to trash via deletionService.
 */
async function deleteSalesOrderHandler(req, res) {
  try {
    const result = await deleteDraftSalesOrder({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      userId: req.user._id,
      reason: req.body?.reason,
      cascadeConfirmed: !!req.body?.cascadeConfirmed
    });
    return res.status(200).json({
      success: true,
      message: 'Sales order moved to trash',
      data: result,
      retentionExpiresAt: result.retentionExpiresAt
    });
  } catch (err) {
    if (err?.blocked) {
      return res.status(400).json({
        success: false,
        blocked: true,
        dependencies: err.dependencies,
        message: err.message
      });
    }
    const status =
      err?.code === 'NOT_FOUND'
        ? 404
        : err?.code === 'SALES_ORDER_NOT_DRAFT' || err?.code === 'DELETE_BLOCKED'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to delete sales order',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * POST /api/sales-orders/:id/cancel
 */
async function cancelSalesOrderHandler(req, res) {
  try {
    const order = await cancelSalesOrder({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: order });
  } catch (err) {
    const status =
      err?.code === 'NOT_FOUND' ? 404 : err?.code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to cancel sales order',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * GET /api/sales-orders/:id/fulfillments
 */
async function listFulfillments(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;
    const order =
      (await SalesOrder.findOne({ organizationId, salesOrderId: id, deletedAt: null }).select('_id')) ||
      (await SalesOrder.findOne({ organizationId, _id: id, deletedAt: null }).select('_id'));
    if (!order) {
      return res.status(404).json({ success: false, message: 'Sales order not found', code: 'NOT_FOUND' });
    }
    const rows = await listSalesOrderFulfillments({
      organizationId,
      salesOrderId: order._id
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to list fulfillments',
      code: err?.code || 'UNKNOWN'
    });
  }
}

/**
 * POST /api/sales-orders/:id/fulfillments
 */
async function postFulfillment(req, res) {
  try {
    const result = await postSalesOrderFulfillment({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      userId: req.user._id,
      body: req.body
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    const code = err?.code;
    const status =
      code === 'NOT_FOUND'
        ? 404
        : code === 'INSUFFICIENT_STOCK'
          ? 409
          : code === 'VALIDATION' ||
              code === 'FULFILLMENT_NOT_ALLOWED' ||
              code === 'FULFILL_AT_PARENT' ||
              code === 'LINE_NOT_FOUND'
            ? 400
            : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to post fulfillment',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

async function reverseFulfillment(req, res) {
  try {
    const result = await reverseSalesOrderFulfillment({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      fulfillmentRef: req.params.fulfillmentId,
      userId: req.user._id,
      body: req.body
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    const code = err?.code;
    const status =
      code === 'NOT_FOUND'
        ? 404
        : code === 'VALIDATION' ||
            code === 'FULFILLMENT_NOT_ALLOWED' ||
            code === 'FULFILLMENT_NOT_REVERSIBLE' ||
            code === 'FULFILLMENT_ALREADY_REVERSED' ||
            code === 'FULFILL_AT_PARENT' ||
            code === 'LINE_NOT_FOUND'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to reverse fulfillment',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * POST /api/sales-orders/:id/split
 */
async function splitSalesOrderHandler(req, res) {
  try {
    const result = await splitSalesOrder({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      userId: req.user._id,
      body: req.body
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    const code = err?.code;
    const status =
      code === 'NOT_FOUND'
        ? 404
        : code === 'VALIDATION' ||
            code === 'SPLIT_NOT_ALLOWED' ||
            code === 'NOTHING_TO_SPLIT' ||
            code === 'LINE_NOT_FOUND' ||
            code === 'SPLIT_AT_BUNDLE_PARENT' ||
            code === 'BUNDLE_SPLIT_WHOLE_ONLY'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to split sales order',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * POST /api/sales-orders/merge
 */
async function mergeSalesOrdersHandler(req, res) {
  try {
    const result = await mergeSalesOrders({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      body: req.body
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    const code = err?.code;
    const status =
      code === 'NOT_FOUND'
        ? 404
        : code === 'VALIDATION' ||
            code === 'MERGE_NOT_ALLOWED' ||
            code === 'MERGE_STATUS_MISMATCH' ||
            code === 'MERGE_CUSTOMER_MISMATCH' ||
            code === 'MERGE_FULFILLMENT_POSTED'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to merge sales orders',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * GET /api/sales-orders/:id/invoice-allocations
 */
async function listInvoiceAllocations(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;
    const order =
      (await SalesOrder.findOne({ organizationId, salesOrderId: id, deletedAt: null }).select('_id')) ||
      (await SalesOrder.findOne({ organizationId, _id: id, deletedAt: null }).select('_id'));
    if (!order) {
      return res.status(404).json({ success: false, message: 'Sales order not found', code: 'NOT_FOUND' });
    }
    const rows = await listSalesOrderInvoiceAllocations({
      organizationId,
      salesOrderId: order._id
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to list invoice allocations',
      code: err?.code || 'UNKNOWN'
    });
  }
}

/**
 * GET /api/sales-orders/:id/invoice-readiness
 */
async function getInvoiceReadiness(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;
    const order =
      (await SalesOrder.findOne({ organizationId, salesOrderId: id, deletedAt: null })) ||
      (await SalesOrder.findOne({ organizationId, _id: id, deletedAt: null }));
    if (!order) {
      return res.status(404).json({ success: false, message: 'Sales order not found', code: 'NOT_FOUND' });
    }
    const lines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();
    const summary = await buildInvoiceReadinessSummary({
      organizationId,
      salesOrderId: order._id,
      lines,
      billOn: req.query?.billOn
    });
    return res.json({
      success: true,
      data: {
        ...summary,
        invoiceStatus: summary.invoiceStatus || order.invoiceStatus,
        invoicedAmount: summary.totalBilled ?? order.invoicedAmount,
        remainingBillableAmount: summary.remainingToBill ?? order.remainingBillableAmount,
        totalBilled: summary.totalBilled ?? order.invoicedAmount,
        remainingToBill: summary.remainingToBill ?? order.remainingBillableAmount
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to build invoice readiness',
      code: err?.code || 'UNKNOWN'
    });
  }
}

/**
 * GET /api/sales-orders/:id/billing-coverage
 */
async function getBillingCoverage(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const id = req.params.id;
    const order =
      (await SalesOrder.findOne({ organizationId, salesOrderId: id, deletedAt: null })) ||
      (await SalesOrder.findOne({ organizationId, _id: id, deletedAt: null }));
    if (!order) {
      return res.status(404).json({ success: false, message: 'Sales order not found', code: 'NOT_FOUND' });
    }

    const coverage = await buildSalesOrderBillingCoverage({
      organizationId,
      salesOrderId: order._id,
      order: order.toObject()
    });

    return res.json({
      success: true,
      data: {
        ...coverage,
        salesOrderId: order.salesOrderId,
        salesOrderNumber: order.salesOrderNumber,
        currency: order.currency || 'USD'
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to build billing coverage',
      code: err?.code || 'UNKNOWN'
    });
  }
}

module.exports = {
  convertFromQuote,
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  confirmSalesOrderHandler,
  cancelSalesOrderHandler,
  listFulfillments,
  postFulfillment,
  reverseFulfillment,
  splitSalesOrderHandler,
  mergeSalesOrdersHandler,
  listInvoiceAllocations,
  getInvoiceReadiness,
  getBillingCoverage,
  deleteSalesOrderHandler
};

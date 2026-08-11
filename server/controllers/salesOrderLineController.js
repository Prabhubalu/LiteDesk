const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const ItemVariant = require('../models/ItemVariant');
const Item = require('../models/Item');
const { resolveCommercialPrice } = require('../services/pricingEngineService');
const salesOrderTotalsService = require('../services/salesOrderTotalsService');
const {
  recomputeSalesOrderAndSectionTotals,
  resolveSectionForOrder,
  ensureDefaultSection
} = require('../services/salesOrderSectionService');
const { writeSalesOrderActivity } = require('../services/salesOrderActivityService');
const { patchSalesOrderLine, deleteSalesOrderLine } = require('../services/salesOrderLineService');
const { isCatalogItemSellable } = require('../constants/catalogLifecycle');
const { SALES_ORDER_STATUS_DEFAULT } = require('../constants/salesOrderLifecycle');
const { guardSalesOrderLineQuantity } = require('../services/inventoryAtpGuardService');

function asNumber(value, { defaultValue = NaN } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

async function loadDraftSalesOrder({ organizationId, salesOrderRef }) {
  const ref = String(salesOrderRef || '').trim();
  const order =
    (await SalesOrder.findOne({ organizationId, salesOrderId: ref, deletedAt: null })) ||
    (await SalesOrder.findOne({ organizationId, _id: ref, deletedAt: null }));

  if (!order) {
    const err = new Error('Sales order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (String(order.status || '') !== SALES_ORDER_STATUS_DEFAULT) {
    const err = new Error('Lines can only be added while sales order is Draft.');
    err.code = 'SALES_ORDER_NOT_DRAFT';
    err.details = { status: order.status };
    throw err;
  }

  return order;
}

async function getNextLineOrder({ organizationId, salesOrderId }) {
  const last = await SalesOrderLine.findOne({ organizationId, salesOrderId })
    .sort({ lineOrder: -1, createdAt: -1 })
    .select('lineOrder')
    .lean();
  const n = Number(last?.lineOrder);
  return Number.isFinite(n) ? n + 1 : 1;
}

/**
 * POST /api/sales-orders/:id/lines
 */
async function addSalesOrderLine(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const order = await loadDraftSalesOrder({ organizationId, salesOrderRef: req.params.id });

    const variantId = req.body?.variantId;
    if (!variantId) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'variantId is required' });
    }

    const quantity = asNumber(req.body?.quantity, { defaultValue: NaN });
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'quantity must be > 0' });
    }

    const variant = await ItemVariant.findOne({ _id: variantId, organizationId }).lean();
    if (!variant) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Variant not found' });
    }
    if (!isCatalogItemSellable(variant.lifecycle_state)) {
      return res.status(400).json({
        success: false,
        code: 'VARIANT_NOT_SELLABLE',
        message: 'Variant is not sellable in its current lifecycle state'
      });
    }

    const item = await Item.findOne({ _id: variant.itemId, organizationId, deletedAt: null })
      .select('item_name description unit_of_measure attributeValues')
      .lean();

    const pricingAsOfDate = req.body?.asOfDate ?? order.orderDate ?? null;
    const price = await resolveCommercialPrice({
      organizationId,
      variantId,
      priceBookId: req.body?.priceBookId ?? null,
      quantity,
      asOfDate: pricingAsOfDate,
      context: {
        ...(req.body?.pricingContext || {}),
        customerId: req.body?.pricingContext?.customerId || order.customerId || null,
        currency: req.body?.pricingContext?.currency || order.currency || null,
      },
    });

    const unitPrice = Number(price.unitPrice) || 0;
    const listPrice = Number(price.listPrice != null ? price.listPrice : unitPrice) || 0;
    const {
      resolveLineDefaultTaxes,
      hydrateTaxIds,
      applyTaxesToLine
    } = require('../services/commercialTaxApplicationService');

    let itemTaxes = [];
    if (Array.isArray(req.body?.taxIds) && req.body.taxIds.length) {
      itemTaxes = await hydrateTaxIds(organizationId, req.body.taxIds);
    } else {
      itemTaxes = await resolveLineDefaultTaxes(organizationId, { side: 'SALES', lineKind: 'ITEM' });
    }

    const computed = applyTaxesToLine(
      {
        quantity,
        unitPriceSnapshot: unitPrice,
        discountType: null,
        discountValue: 0,
        discountAmount: 0
      },
      itemTaxes
    );

    const inventoryAtp = await guardSalesOrderLineQuantity({
      organizationId,
      order,
      variantId: variant._id,
      quantity,
      userId: req.user._id,
      forceProceed: req.body?.forceAtpProceed === true
    });

    const targetSection = await resolveSectionForOrder({
      organizationId,
      salesOrderId: order._id,
      sectionRef: req.body?.salesOrderSectionId,
      orderStatus: order.status
    });

    const section =
      targetSection ||
      (await ensureDefaultSection({ organizationId, salesOrderId: order._id, lockedSnapshot: false }));

    const lineOrder = await getNextLineOrder({ organizationId, salesOrderId: order._id });

    let productConfigurationId = null;
    let productConfigurationVersion = null;
    let configurationSelections = null;
    let configurationSnapshot = null;
    let attributesFromConfig = item?.attributeValues || {};

    if (req.body?.productConfigurationId) {
      const cpqService = require('../services/cpqService');
      const validation = await cpqService.validateProductConfigurationById({
        organizationId,
        id: req.body.productConfigurationId,
        selections: req.body.configurationSelections || {},
        requireActive: true,
        asOf: pricingAsOfDate ? new Date(pricingAsOfDate) : new Date()
      });
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          code: 'CONFIGURATION_INVALID',
          message: validation.errors?.[0]?.message || 'Product configuration is invalid',
          errors: validation.errors
        });
      }
      const snap = cpqService.buildConfigurationLineSnapshot(validation.configuration, validation);
      productConfigurationId = validation.configuration._id;
      productConfigurationVersion = snap.productConfigurationVersion;
      configurationSelections = snap.selections;
      configurationSnapshot = snap;
      attributesFromConfig = {
        ...(item?.attributeValues || {}),
        ...snap.selections
      };
    }

    const line = await SalesOrderLine.create({
      organizationId,
      salesOrderId: order._id,
      salesOrderSectionId: section._id,
      variantId: variant._id,
      lineType: 'standard',
      lineOrder,
      quantity,
      unitOfMeasure: variant.unit_of_measure || item?.unit_of_measure || null,
      unitPriceSnapshot: unitPrice,
      listPriceSnapshot: listPrice,
      pricingSourceSnapshot: price.source || null,
      priceBookIdSnapshot: price.priceBookId || null,
      priceBookNameSnapshot: price.priceBookName || null,
      priceBookEntryIdSnapshot: price.entryId || null,
      pricingAsOfDateSnapshot: pricingAsOfDate ? new Date(pricingAsOfDate) : null,
      pricingBreakdownSnapshot: price.pricingBreakdown || null,
      taxSnapshot: computed.taxSnapshot,
      lineSubtotal: computed.lineSubtotal,
      lineTaxTotal: computed.lineTaxTotal,
      lineTotal: computed.lineTotal,
      currencySnapshot: order.currency || price.currency || variant.currency || 'USD',
      exchangeRateSnapshot: Number(order.exchangeRateSnapshot) || 1,
      skuSnapshot: variant.variant_code || variant.barcode || String(variant._id),
      itemNameSnapshot: item?.item_name || null,
      descriptionSnapshot: item?.description || null,
      attributesSnapshot: attributesFromConfig,
      productConfigurationId,
      productConfigurationVersion,
      configurationSelections,
      configurationSnapshot,
      lockedSnapshot: false
    });

    const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
      organizationId,
      salesOrderId: order._id
    });

    await writeSalesOrderActivity({
      organizationId,
      salesOrderId: order._id,
      userId: req.user._id,
      action: 'sales_order_line_added',
      message: 'Line added',
      details: {
        salesOrderLineId: line.salesOrderLineId,
        variantId: String(variant._id),
        quantity: line.quantity,
        unitPriceSnapshot: line.unitPriceSnapshot
      }
    });

    return res.status(201).json({
      success: true,
      data: { line, totals, sections, inventoryAtp: inventoryAtp.warnings?.length ? inventoryAtp : undefined }
    });
  } catch (err) {
    const status =
      err?.code === 'INSUFFICIENT_ATP'
        ? 409
        : err?.code === 'VALIDATION' ||
            err?.code === 'NOT_FOUND' ||
            err?.code === 'SALES_ORDER_NOT_DRAFT' ||
            err?.code === 'SECTION_NOT_FOUND'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to add sales order line',
      code: err?.code || 'UNKNOWN',
      canProceed: err.canProceed === true,
      policy: err.policy || err.details?.policy || null,
      details: err?.details || null
    });
  }
}

async function addSalesOrderBundleHandler(req, res) {
  try {
    const { addSalesOrderBundle } = require('../services/commercialBundleDraftService');
    const result = await addSalesOrderBundle({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      userId: req.user._id,
      body: req.body
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' ||
      err?.code === 'VARIANT_NOT_SELLABLE' ||
      err?.code === 'SALES_ORDER_NOT_DRAFT' ||
      err?.code === 'SECTION_NOT_FOUND'
        ? 400
        : err?.code === 'NOT_FOUND'
          ? 404
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to add bundle',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

async function patchSalesOrderBundleOptionalsHandler(req, res) {
  try {
    const { patchSalesOrderBundleOptionals } = require('../services/commercialBundleDraftService');
    const result = await patchSalesOrderBundleOptionals({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      parentLineRef: req.params.parentLineId,
      userId: req.user._id,
      body: req.body
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' || err?.code === 'SALES_ORDER_NOT_DRAFT' ? 400 : err?.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update bundle optional components',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

module.exports = {
  addSalesOrderLine,
  addSalesOrderBundleHandler,
  patchSalesOrderBundleOptionalsHandler,
  patchSalesOrderLine: async function patchSalesOrderLineHandler(req, res) {
    try {
      const result = await patchSalesOrderLine({
        organizationId: req.user.organizationId,
        salesOrderRef: req.params.id,
        lineRef: req.params.lineId,
        userId: req.user._id,
        body: req.body
      });
      return res.json({ success: true, data: result });
    } catch (err) {
      const status =
        err?.code === 'INSUFFICIENT_ATP'
          ? 409
          : err?.code === 'VALIDATION' ||
              err?.code === 'NOT_FOUND' ||
              err?.code === 'SALES_ORDER_NOT_DRAFT' ||
              err?.code === 'SECTION_NOT_FOUND' ||
              err?.code === 'BUNDLE_EDIT_AT_PARENT'
            ? 400
            : 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to update sales order line',
        code: err?.code || 'UNKNOWN',
        canProceed: err.canProceed === true,
        policy: err.policy || err.details?.policy || null,
        details: err?.details || null
      });
    }
  },
  deleteSalesOrderLine: async function deleteSalesOrderLineHandler(req, res) {
    try {
      const result = await deleteSalesOrderLine({
        organizationId: req.user.organizationId,
        salesOrderRef: req.params.id,
        lineRef: req.params.lineId,
        userId: req.user._id
      });
      return res.json({ success: true, data: result });
    } catch (err) {
      const status =
        err?.code === 'VALIDATION' ||
        err?.code === 'NOT_FOUND' ||
        err?.code === 'SALES_ORDER_NOT_DRAFT' ||
        err?.code === 'BUNDLE_DELETE_AT_PARENT'
          ? 400
          : 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to delete sales order line',
        code: err?.code || 'UNKNOWN',
        details: err?.details || null
      });
    }
  },
  reorderSalesOrderLinesHandler,
  patchSalesOrderDiscountsHandler,
  recalculateSalesOrderHandler,
  patchSalesOrderTaxesChargesHandler
};

function draftErrorStatus(err) {
  if (err?.code === 'INSUFFICIENT_ATP') return 409;
  if (
    err?.code === 'VALIDATION' ||
    err?.code === 'NOT_FOUND' ||
    err?.code === 'SALES_ORDER_NOT_DRAFT' ||
    err?.code === 'SECTION_NOT_FOUND'
  ) {
    return 400;
  }
  return 500;
}

async function reorderSalesOrderLinesHandler(req, res) {
  try {
    const {
      reorderSalesOrderLines
    } = require('../services/salesOrderCommercialDraftService');
    const result = await reorderSalesOrderLines({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      userId: req.user._id,
      orders: req.body?.orders
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(draftErrorStatus(err)).json({
      success: false,
      message: err.message || 'Failed to reorder sales order lines',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

async function patchSalesOrderDiscountsHandler(req, res) {
  try {
    const { patchSalesOrderDiscounts } = require('../services/salesOrderCommercialDraftService');
    const result = await patchSalesOrderDiscounts({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      userId: req.user._id,
      body: req.body
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(draftErrorStatus(err)).json({
      success: false,
      message: err.message || 'Failed to update sales order discounts',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

async function recalculateSalesOrderHandler(req, res) {
  try {
    const { recalculateSalesOrder } = require('../services/salesOrderCommercialDraftService');
    const result = await recalculateSalesOrder({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(draftErrorStatus(err)).json({
      success: false,
      message: err.message || 'Failed to recalculate sales order',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

async function patchSalesOrderTaxesChargesHandler(req, res) {
  try {
    const { patchSalesOrderTaxesCharges } = require('../services/salesOrderCommercialDraftService');
    const result = await patchSalesOrderTaxesCharges({
      organizationId: req.user.organizationId,
      salesOrderRef: req.params.id,
      userId: req.user._id,
      body: req.body
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(draftErrorStatus(err)).json({
      success: false,
      message: err.message || 'Failed to update sales order taxes/charges',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

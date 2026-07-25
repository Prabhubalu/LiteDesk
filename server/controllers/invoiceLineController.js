const ItemVariant = require('../models/ItemVariant');
const Item = require('../models/Item');
const InvoiceLine = require('../models/InvoiceLine');
const InvoiceSection = require('../models/InvoiceSection');
const { resolve: resolveCatalogPrice } = require('../services/catalogPriceResolver');
const invoiceTotalsService = require('../services/invoiceTotalsService');
const { recomputeInvoiceAndSectionTotals, ensureDefaultInvoiceSection } = require('../services/invoiceSectionService');
const { patchInvoiceLine, deleteInvoiceLine, loadDraftInvoice } = require('../services/invoiceLineService');
const { writeInvoiceActivity } = require('../services/invoiceActivityService');
const { isCatalogItemSellable } = require('../constants/catalogLifecycle');
const { isMongoObjectIdString } = require('../utils/isMongoObjectId');

function asNumber(value, { defaultValue = NaN } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

async function getNextLineOrder({ organizationId, invoiceId }) {
  const last = await InvoiceLine.findOne({ organizationId, invoiceId })
    .sort({ lineOrder: -1, createdAt: -1 })
    .select('lineOrder')
    .lean();
  const n = Number(last?.lineOrder);
  return Number.isFinite(n) ? n + 1 : 1;
}

async function resolveSectionForInvoice({ organizationId, invoiceId, sectionRef }) {
  if (!sectionRef) return ensureDefaultInvoiceSection({ organizationId, invoiceId });
  const ref = String(sectionRef).trim();
  if (isMongoObjectIdString(ref)) {
    const byMongo = await InvoiceSection.findOne({ organizationId, invoiceId, _id: ref }).lean();
    if (byMongo) return byMongo;
  }
  const byPublic = await InvoiceSection.findOne({ organizationId, invoiceId, invoiceSectionId: ref }).lean();
  if (byPublic) return byPublic;
  const err = new Error('Invoice section not found');
  err.code = 'SECTION_NOT_FOUND';
  throw err;
}

async function addInvoiceLine(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const invoice = await loadDraftInvoice({ organizationId, invoiceRef: req.params.id });

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

    const pricingAsOfDate = req.body?.asOfDate ?? invoice.invoiceDate ?? null;
    const price = await resolveCatalogPrice({
      organizationId,
      variantId,
      priceBookId: req.body?.priceBookId ?? null,
      quantity,
      asOfDate: pricingAsOfDate
    });

    const unitPrice = Number(price.unitPrice) || 0;
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

    const section = await resolveSectionForInvoice({
      organizationId,
      invoiceId: invoice._id,
      sectionRef: req.body?.invoiceSectionId
    });

    const lineOrder = await getNextLineOrder({ organizationId, invoiceId: invoice._id });

    const line = await InvoiceLine.create({
      organizationId,
      invoiceId: invoice._id,
      invoiceSectionId: section._id,
      variantId: variant._id,
      lineType: 'standard',
      lineOrder,
      quantity,
      unitOfMeasure: variant.unit_of_measure || item?.unit_of_measure || null,
      unitPriceSnapshot: unitPrice,
      listPriceSnapshot: unitPrice,
      pricingSourceSnapshot: price.source || null,
      priceBookIdSnapshot: price.priceBookId || null,
      priceBookNameSnapshot: price.priceBookName || null,
      priceBookEntryIdSnapshot: price.entryId || null,
      pricingAsOfDateSnapshot: pricingAsOfDate ? new Date(pricingAsOfDate) : null,
      taxSnapshot: computed.taxSnapshot,
      lineSubtotal: computed.lineSubtotal,
      lineTaxTotal: computed.lineTaxTotal,
      lineTotal: computed.lineTotal,
      currencySnapshot: invoice.currency || price.currency || variant.currency || 'USD',
      exchangeRateSnapshot: Number(invoice.exchangeRateSnapshot) || 1,
      skuSnapshot: variant.variant_code || variant.barcode || String(variant._id),
      itemNameSnapshot: item?.item_name || null,
      descriptionSnapshot: item?.description || null,
      attributesSnapshot: item?.attributeValues || {},
      lockedSnapshot: false
    });

    const { totals, sections } = await recomputeInvoiceAndSectionTotals({
      organizationId,
      invoiceId: invoice._id
    });

    await writeInvoiceActivity({
      organizationId,
      invoiceId: invoice.invoiceId,
      userId: req.user._id,
      action: 'invoice_line_added',
      message: `Line added to ${invoice.invoiceNumber}`,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        invoiceLineId: line.invoiceLineId,
        quantity: line.quantity,
        unitPriceSnapshot: line.unitPriceSnapshot
      }
    });

    return res.status(201).json({ success: true, data: { line, totals, sections } });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' ||
      err?.code === 'NOT_FOUND' ||
      err?.code === 'INVOICE_NOT_DRAFT' ||
      err?.code === 'SECTION_NOT_FOUND' ||
      err?.code === 'INVOICE_COMMERCIAL_LOCK'
        ? 400
        : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to add invoice line',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function patchInvoiceLineHandler(req, res) {
  try {
    const result = await patchInvoiceLine({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      lineRef: req.params.lineId,
      userId: req.user._id,
      body: req.body
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' ||
      err?.code === 'NOT_FOUND' ||
      err?.code === 'INVOICE_NOT_DRAFT' ||
      err?.code === 'SECTION_NOT_FOUND' ||
      err?.code === 'INVOICE_LINE_LOCKED' ||
      err?.code === 'INVOICE_COMMERCIAL_LOCK'
        ? 400
        : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update invoice line',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function deleteInvoiceLineHandler(req, res) {
  try {
    const result = await deleteInvoiceLine({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      lineRef: req.params.lineId,
      userId: req.user._id
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' ||
      err?.code === 'NOT_FOUND' ||
      err?.code === 'INVOICE_NOT_DRAFT' ||
      err?.code === 'INVOICE_LINE_LOCKED' ||
      err?.code === 'INVOICE_COMMERCIAL_LOCK'
        ? 400
        : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to delete invoice line',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function addInvoiceBundleHandler(req, res) {
  try {
    const { addInvoiceBundle } = require('../services/commercialBundleDraftService');
    const result = await addInvoiceBundle({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id,
      body: req.body
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' ||
      err?.code === 'VARIANT_NOT_SELLABLE' ||
      err?.code === 'INVOICE_NOT_DRAFT' ||
      err?.code === 'SECTION_NOT_FOUND' ||
      err?.code === 'INVOICE_COMMERCIAL_LOCK'
        ? 400
        : err?.code === 'NOT_FOUND'
          ? 404
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to add bundle',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function patchInvoiceBundleOptionalsHandler(req, res) {
  try {
    const { patchInvoiceBundleOptionals } = require('../services/commercialBundleDraftService');
    const result = await patchInvoiceBundleOptionals({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      parentLineRef: req.params.parentLineId,
      userId: req.user._id,
      body: req.body
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' ||
      err?.code === 'INVOICE_NOT_DRAFT' ||
      err?.code === 'INVOICE_COMMERCIAL_LOCK'
        ? 400
        : err?.code === 'NOT_FOUND'
          ? 404
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update bundle optional components',
      code: err?.code || 'UNKNOWN'
    });
  }
}

module.exports = {
  addInvoiceLine,
  addInvoiceBundleHandler,
  patchInvoiceBundleOptionalsHandler,
  patchInvoiceLineHandler,
  deleteInvoiceLineHandler,
  reorderInvoiceLinesHandler,
  patchInvoiceDiscountsHandler,
  recalculateInvoiceHandler,
  patchInvoiceTaxesChargesHandler
};

function invoiceDraftErrorStatus(err) {
  if (
    err?.code === 'VALIDATION' ||
    err?.code === 'NOT_FOUND' ||
    err?.code === 'INVOICE_NOT_DRAFT' ||
    err?.code === 'INVOICE_LINE_LOCKED' ||
    err?.code === 'SECTION_NOT_FOUND' ||
    err?.code === 'INVOICE_COMMERCIALLY_LOCKED'
  ) {
    return 400;
  }
  return 500;
}

async function reorderInvoiceLinesHandler(req, res) {
  try {
    const { reorderInvoiceLines } = require('../services/invoiceCommercialDraftService');
    const result = await reorderInvoiceLines({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id,
      orders: req.body?.orders
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(invoiceDraftErrorStatus(err)).json({
      success: false,
      message: err.message || 'Failed to reorder invoice lines',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

async function patchInvoiceDiscountsHandler(req, res) {
  try {
    const { patchInvoiceDiscounts } = require('../services/invoiceCommercialDraftService');
    const result = await patchInvoiceDiscounts({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id,
      body: req.body
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(invoiceDraftErrorStatus(err)).json({
      success: false,
      message: err.message || 'Failed to update invoice discounts',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

async function recalculateInvoiceHandler(req, res) {
  try {
    const { recalculateInvoice } = require('../services/invoiceCommercialDraftService');
    const result = await recalculateInvoice({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(invoiceDraftErrorStatus(err)).json({
      success: false,
      message: err.message || 'Failed to recalculate invoice',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

async function patchInvoiceTaxesChargesHandler(req, res) {
  try {
    const { patchInvoiceTaxesCharges } = require('../services/invoiceCommercialDraftService');
    const result = await patchInvoiceTaxesCharges({
      organizationId: req.user.organizationId,
      invoiceRef: req.params.id,
      userId: req.user._id,
      body: req.body
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(invoiceDraftErrorStatus(err)).json({
      success: false,
      message: err.message || 'Failed to update invoice taxes/charges',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

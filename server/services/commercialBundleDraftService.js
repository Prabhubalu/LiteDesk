/**
 * Draft bundle add + optional-component patch for Sales Orders and Invoices (mirrors quote bundles).
 */

const ItemVariant = require('../models/ItemVariant');
const Item = require('../models/Item');
const SalesOrderLine = require('../models/SalesOrderLine');
const InvoiceLine = require('../models/InvoiceLine');
const InvoiceSection = require('../models/InvoiceSection');
const catalogBundleService = require('./catalogBundleService');
const { resolve: resolveCatalogPrice } = require('./catalogPriceResolver');
const salesOrderTotalsService = require('./salesOrderTotalsService');
const invoiceTotalsService = require('./invoiceTotalsService');
const {
  recomputeSalesOrderAndSectionTotals,
  resolveSectionForOrder
} = require('./salesOrderSectionService');
const {
  recomputeInvoiceAndSectionTotals,
  ensureDefaultInvoiceSection
} = require('./invoiceSectionService');
const { loadDraftSalesOrderDoc } = require('./salesOrderCommercialDraftService');
const { loadDraftInvoiceDoc } = require('./invoiceCommercialDraftService');
const { writeSalesOrderActivity } = require('./salesOrderActivityService');
const { writeInvoiceActivity } = require('./invoiceActivityService');
const { isCatalogItemSellable } = require('../constants/catalogLifecycle');
const { isMongoObjectIdString } = require('../utils/isMongoObjectId');

function asNumber(value, { defaultValue = NaN } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

function assertVariantSellable(variantLifecycleState) {
  if (isCatalogItemSellable(variantLifecycleState)) return;
  const err = new Error('Variant is not sellable in its current lifecycle state');
  err.code = 'VARIANT_NOT_SELLABLE';
  throw err;
}

function parseAddBundleBody(body) {
  const bundleVariantId = body?.bundleVariantId;
  if (!bundleVariantId) {
    const err = new Error('bundleVariantId is required');
    err.code = 'VALIDATION';
    throw err;
  }
  const quantity = asNumber(body?.quantity, { defaultValue: NaN });
  if (!Number.isFinite(quantity) || quantity <= 0) {
    const err = new Error('quantity must be > 0');
    err.code = 'VALIDATION';
    throw err;
  }
  const includedOptional = new Set(
    (Array.isArray(body?.includedOptionalComponentVariantIds)
      ? body.includedOptionalComponentVariantIds
      : []
    )
      .map((v) => String(v))
      .filter(Boolean)
  );
  return {
    bundleVariantId,
    quantity,
    priceBookId: body?.priceBookId ?? null,
    asOfDate: body?.asOfDate ?? null,
    includedOptional
  };
}

async function resolveDefaultTaxesAndCompute(organizationId, lineInput) {
  const {
    resolveLineDefaultTaxes,
    applyTaxesToLine
  } = require('./commercialTaxApplicationService');
  const itemTaxes = await resolveLineDefaultTaxes(organizationId, { side: 'SALES', lineKind: 'ITEM' });
  return applyTaxesToLine(lineInput, itemTaxes);
}

async function getNextSalesOrderLineOrder({ organizationId, salesOrderId }) {
  const last = await SalesOrderLine.findOne({ organizationId, salesOrderId })
    .sort({ lineOrder: -1, createdAt: -1 })
    .select('lineOrder')
    .lean();
  const n = Number(last?.lineOrder);
  return Number.isFinite(n) ? n + 1 : 1;
}

async function getNextInvoiceLineOrder({ organizationId, invoiceId }) {
  const last = await InvoiceLine.findOne({ organizationId, invoiceId })
    .sort({ lineOrder: -1, createdAt: -1 })
    .select('lineOrder')
    .lean();
  const n = Number(last?.lineOrder);
  return Number.isFinite(n) ? n + 1 : 1;
}

async function resolveSectionForInvoiceDraft({ organizationId, invoiceId, sectionRef }) {
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

async function addSalesOrderBundle({ organizationId, salesOrderRef, userId, body = {} }) {
  const order = await loadDraftSalesOrderDoc({ organizationId, salesOrderRef });
  const { bundleVariantId, quantity, priceBookId, includedOptional } = parseAddBundleBody(body);
  const pricingAsOfDate = body?.asOfDate ?? order.orderDate ?? null;

  const bundleComponents = await catalogBundleService.getBundleComponents(bundleVariantId, organizationId);
  const preview = await catalogBundleService.expandBundlePreview({
    organizationId,
    bundleVariantId,
    priceBookId,
    quantity,
    asOfDate: pricingAsOfDate
  });

  const pricingMode =
    String(preview.pricingMode || bundleComponents.pricingMode || '')
      .toLowerCase()
      .trim() || 'fixed';

  const nextOrder = await getNextSalesOrderLineOrder({ organizationId, salesOrderId: order._id });
  const targetSection = await resolveSectionForOrder({
    organizationId,
    salesOrderId: order._id,
    sectionRef: body?.salesOrderSectionId,
    orderStatus: order.status
  });

  const parentUnitPrice = Number(preview.bundleUnitPrice) || 0;
  const parentComputed = await resolveDefaultTaxesAndCompute(organizationId, {
    quantity,
    unitPriceSnapshot: parentUnitPrice,
    discountType: null,
    discountValue: 0,
    discountAmount: 0
  });

  const parent = await SalesOrderLine.create({
    organizationId,
    salesOrderId: order._id,
    variantId: bundleVariantId,
    salesOrderSectionId: targetSection._id,
    lineType: 'bundle_parent',
    parentBundleLineId: null,
    lineOrder: nextOrder,
    quantity,
    unitOfMeasure: null,
    unitPriceSnapshot: parentUnitPrice,
    listPriceSnapshot: parentUnitPrice,
    pricingSourceSnapshot: preview.bundlePriceSource || null,
    priceBookIdSnapshot: priceBookId || null,
    priceBookNameSnapshot: null,
    priceBookEntryIdSnapshot: null,
    pricingAsOfDateSnapshot: pricingAsOfDate ? new Date(pricingAsOfDate) : null,
    taxSnapshot: parentComputed.taxSnapshot,
    lineSubtotal: parentComputed.lineSubtotal,
    lineTaxTotal: parentComputed.lineTaxTotal,
    lineTotal: parentComputed.lineTotal,
    currencySnapshot: order.currency || preview.currency || 'USD',
    exchangeRateSnapshot: Number(order.exchangeRateSnapshot) || 1,
    skuSnapshot: null,
    itemNameSnapshot: preview.bundleItemName || null,
    descriptionSnapshot: null,
    attributesSnapshot: {},
    bundleSnapshot: {
      bundleVariantId: String(bundleVariantId),
      pricingMode,
      rollupComponentTotal: Number(preview.rollupComponentTotal) || 0,
      components: Array.isArray(bundleComponents.components)
        ? bundleComponents.components.map((c) => ({
            componentVariantId: String(c.componentVariantId),
            quantity: Number(c.quantity) || 0,
            isOptional: c.isOptional === true,
            sortOrder: Number(c.sortOrder) || 0
          }))
        : []
    },
    optionalLine: false,
    hiddenLine: false,
    lockedSnapshot: false
  });

  const createdComponents = [];
  let childOrder = nextOrder + 1;
  const componentRows = Array.isArray(bundleComponents.components) ? bundleComponents.components : [];
  for (const comp of componentRows) {
    const isOptional = comp.isOptional === true;
    const shouldInclude = !isOptional || includedOptional.has(String(comp.componentVariantId));
    const componentQty = (Number(comp.quantity) || 0) * quantity;
    if (!Number.isFinite(componentQty) || componentQty <= 0) continue;

    const compVariant = await ItemVariant.findOne({ _id: comp.componentVariantId, organizationId }).lean();
    if (!compVariant) continue;
    assertVariantSellable(compVariant.lifecycle_state);

    const compItem = await Item.findOne({ _id: compVariant.itemId, organizationId, deletedAt: null })
      .select('item_name description unit_of_measure attributeValues')
      .lean();

    const compPrice = await resolveCatalogPrice({
      organizationId,
      variantId: comp.componentVariantId,
      priceBookId,
      quantity: componentQty,
      asOfDate: pricingAsOfDate
    });

    const compUnitPrice = Number(compPrice.unitPrice) || 0;
    const compComputed = await resolveDefaultTaxesAndCompute(organizationId, {
      quantity: componentQty,
      unitPriceSnapshot: compUnitPrice,
      discountType: null,
      discountValue: 0,
      discountAmount: 0
    });

    const componentLine = await SalesOrderLine.create({
      organizationId,
      salesOrderId: order._id,
      variantId: compVariant._id,
      salesOrderSectionId: targetSection._id,
      lineType: 'bundle_component',
      parentBundleLineId: parent._id,
      lineOrder: childOrder++,
      quantity: componentQty,
      unitOfMeasure: compVariant.unit_of_measure || compItem?.unit_of_measure || null,
      unitPriceSnapshot: compUnitPrice,
      listPriceSnapshot: compUnitPrice,
      pricingSourceSnapshot: compPrice.source || null,
      priceBookIdSnapshot: compPrice.priceBookId || priceBookId || null,
      priceBookNameSnapshot: compPrice.priceBookName || null,
      priceBookEntryIdSnapshot: compPrice.entryId || null,
      pricingAsOfDateSnapshot: pricingAsOfDate ? new Date(pricingAsOfDate) : null,
      pricingEffectiveFromSnapshot: compPrice.effectiveFrom ? new Date(compPrice.effectiveFrom) : null,
      pricingEffectiveToSnapshot: compPrice.effectiveTo ? new Date(compPrice.effectiveTo) : null,
      pricingMinQtySnapshot: Number.isFinite(Number(compPrice.minQty)) ? Number(compPrice.minQty) : null,
      taxSnapshot: compComputed.taxSnapshot,
      lineSubtotal: compComputed.lineSubtotal,
      lineTaxTotal: compComputed.lineTaxTotal,
      lineTotal: compComputed.lineTotal,
      currencySnapshot: order.currency || compPrice.currency || compVariant.currency || 'USD',
      exchangeRateSnapshot: Number(order.exchangeRateSnapshot) || 1,
      skuSnapshot: compVariant.variant_code || compVariant.barcode || String(compVariant._id),
      itemNameSnapshot: compItem?.item_name || null,
      descriptionSnapshot: compItem?.description || null,
      attributesSnapshot: compItem?.attributeValues || {},
      bundleSnapshot: {
        parentBundleVariantId: String(bundleVariantId),
        parentBundleLineId: String(parent._id),
        isOptional,
        included: shouldInclude
      },
      optionalLine: isOptional,
      hiddenLine: shouldInclude ? false : true,
      lockedSnapshot: false
    });

    createdComponents.push(componentLine);
  }

  const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_bundle_added',
    message: 'Bundle added',
    details: {
      salesOrderLineId: parent.salesOrderLineId,
      bundleVariantId: String(bundleVariantId),
      pricingMode,
      componentCount: createdComponents.length,
      totals
    }
  });

  return { parent, components: createdComponents, totals, sections };
}

async function patchSalesOrderBundleOptionals({
  organizationId,
  salesOrderRef,
  parentLineRef,
  userId,
  body = {}
}) {
  const order = await loadDraftSalesOrderDoc({ organizationId, salesOrderRef });
  const parentSalesOrderLineId = String(parentLineRef || '').trim();

  const parent = await SalesOrderLine.findOne({
    organizationId,
    salesOrderId: order._id,
    salesOrderLineId: parentSalesOrderLineId,
    lineType: 'bundle_parent'
  });
  if (!parent) {
    const err = new Error('Bundle line not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const included = new Set(
    (Array.isArray(body?.includedComponentVariantIds) ? body.includedComponentVariantIds : [])
      .map((id) => String(id))
      .filter(Boolean)
  );

  const optionalChildren = await SalesOrderLine.find({
    organizationId,
    salesOrderId: order._id,
    parentBundleLineId: parent._id,
    lineType: 'bundle_component',
    optionalLine: true
  });

  if (!optionalChildren.length) {
    const err = new Error('This bundle has no optional components on the sales order');
    err.code = 'VALIDATION';
    throw err;
  }

  for (const child of optionalChildren) {
    const variantKey = String(child.variantId || '');
    const shouldInclude = included.has(variantKey);
    const nextHidden = !shouldInclude;

    if (child.hiddenLine === nextHidden) continue;

    child.hiddenLine = nextHidden;
    if (child.bundleSnapshot && typeof child.bundleSnapshot === 'object') {
      child.bundleSnapshot = { ...child.bundleSnapshot, included: shouldInclude };
    }

    const computed = salesOrderTotalsService.computeLineTotals(child);
    child.lineSubtotal = computed.lineSubtotal;
    child.lineTaxTotal = computed.lineTaxTotal;
    child.lineTotal = computed.lineTotal;
    child.lockedSnapshot = false;

    await child.save();
  }

  const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });
  const lines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_bundle_optionals_updated',
    message: 'Bundle optional components updated',
    details: { parentSalesOrderLineId, totals }
  });

  return { lines, totals, sections };
}

async function addInvoiceBundle({ organizationId, invoiceRef, userId, body = {} }) {
  const invoice = await loadDraftInvoiceDoc({ organizationId, invoiceRef });
  const { bundleVariantId, quantity, priceBookId, includedOptional } = parseAddBundleBody(body);
  const pricingAsOfDate = body?.asOfDate ?? invoice.invoiceDate ?? null;

  const bundleComponents = await catalogBundleService.getBundleComponents(bundleVariantId, organizationId);
  const preview = await catalogBundleService.expandBundlePreview({
    organizationId,
    bundleVariantId,
    priceBookId,
    quantity,
    asOfDate: pricingAsOfDate
  });

  const pricingMode =
    String(preview.pricingMode || bundleComponents.pricingMode || '')
      .toLowerCase()
      .trim() || 'fixed';

  const nextOrder = await getNextInvoiceLineOrder({ organizationId, invoiceId: invoice._id });
  const targetSection = await resolveSectionForInvoiceDraft({
    organizationId,
    invoiceId: invoice._id,
    sectionRef: body?.invoiceSectionId
  });

  const parentUnitPrice = Number(preview.bundleUnitPrice) || 0;
  const parentComputed = await resolveDefaultTaxesAndCompute(organizationId, {
    quantity,
    unitPriceSnapshot: parentUnitPrice,
    discountType: null,
    discountValue: 0,
    discountAmount: 0
  });

  const parent = await InvoiceLine.create({
    organizationId,
    invoiceId: invoice._id,
    variantId: bundleVariantId,
    invoiceSectionId: targetSection._id,
    lineType: 'bundle_parent',
    parentBundleLineId: null,
    lineOrder: nextOrder,
    quantity,
    unitOfMeasure: null,
    unitPriceSnapshot: parentUnitPrice,
    listPriceSnapshot: parentUnitPrice,
    pricingSourceSnapshot: preview.bundlePriceSource || null,
    priceBookIdSnapshot: priceBookId || null,
    priceBookNameSnapshot: null,
    priceBookEntryIdSnapshot: null,
    pricingAsOfDateSnapshot: pricingAsOfDate ? new Date(pricingAsOfDate) : null,
    taxSnapshot: parentComputed.taxSnapshot,
    lineSubtotal: parentComputed.lineSubtotal,
    lineTaxTotal: parentComputed.lineTaxTotal,
    lineTotal: parentComputed.lineTotal,
    currencySnapshot: invoice.currency || preview.currency || 'USD',
    exchangeRateSnapshot: Number(invoice.exchangeRateSnapshot) || 1,
    skuSnapshot: null,
    itemNameSnapshot: preview.bundleItemName || null,
    descriptionSnapshot: null,
    attributesSnapshot: {},
    bundleSnapshot: {
      bundleVariantId: String(bundleVariantId),
      pricingMode,
      rollupComponentTotal: Number(preview.rollupComponentTotal) || 0,
      components: Array.isArray(bundleComponents.components)
        ? bundleComponents.components.map((c) => ({
            componentVariantId: String(c.componentVariantId),
            quantity: Number(c.quantity) || 0,
            isOptional: c.isOptional === true,
            sortOrder: Number(c.sortOrder) || 0
          }))
        : []
    },
    optionalLine: false,
    hiddenLine: false,
    lockedSnapshot: false
  });

  const createdComponents = [];
  let childOrder = nextOrder + 1;
  const componentRows = Array.isArray(bundleComponents.components) ? bundleComponents.components : [];
  for (const comp of componentRows) {
    const isOptional = comp.isOptional === true;
    const shouldInclude = !isOptional || includedOptional.has(String(comp.componentVariantId));
    const componentQty = (Number(comp.quantity) || 0) * quantity;
    if (!Number.isFinite(componentQty) || componentQty <= 0) continue;

    const compVariant = await ItemVariant.findOne({ _id: comp.componentVariantId, organizationId }).lean();
    if (!compVariant) continue;
    assertVariantSellable(compVariant.lifecycle_state);

    const compItem = await Item.findOne({ _id: compVariant.itemId, organizationId, deletedAt: null })
      .select('item_name description unit_of_measure attributeValues')
      .lean();

    const compPrice = await resolveCatalogPrice({
      organizationId,
      variantId: comp.componentVariantId,
      priceBookId,
      quantity: componentQty,
      asOfDate: pricingAsOfDate
    });

    const compUnitPrice = Number(compPrice.unitPrice) || 0;
    const compComputed = await resolveDefaultTaxesAndCompute(organizationId, {
      quantity: componentQty,
      unitPriceSnapshot: compUnitPrice,
      discountType: null,
      discountValue: 0,
      discountAmount: 0
    });

    const componentLine = await InvoiceLine.create({
      organizationId,
      invoiceId: invoice._id,
      variantId: compVariant._id,
      invoiceSectionId: targetSection._id,
      lineType: 'bundle_component',
      parentBundleLineId: parent._id,
      lineOrder: childOrder++,
      quantity: componentQty,
      unitOfMeasure: compVariant.unit_of_measure || compItem?.unit_of_measure || null,
      unitPriceSnapshot: compUnitPrice,
      listPriceSnapshot: compUnitPrice,
      pricingSourceSnapshot: compPrice.source || null,
      priceBookIdSnapshot: compPrice.priceBookId || priceBookId || null,
      priceBookNameSnapshot: compPrice.priceBookName || null,
      priceBookEntryIdSnapshot: compPrice.entryId || null,
      pricingAsOfDateSnapshot: pricingAsOfDate ? new Date(pricingAsOfDate) : null,
      pricingEffectiveFromSnapshot: compPrice.effectiveFrom ? new Date(compPrice.effectiveFrom) : null,
      pricingEffectiveToSnapshot: compPrice.effectiveTo ? new Date(compPrice.effectiveTo) : null,
      pricingMinQtySnapshot: Number.isFinite(Number(compPrice.minQty)) ? Number(compPrice.minQty) : null,
      taxSnapshot: compComputed.taxSnapshot,
      lineSubtotal: compComputed.lineSubtotal,
      lineTaxTotal: compComputed.lineTaxTotal,
      lineTotal: compComputed.lineTotal,
      currencySnapshot: invoice.currency || compPrice.currency || compVariant.currency || 'USD',
      exchangeRateSnapshot: Number(invoice.exchangeRateSnapshot) || 1,
      skuSnapshot: compVariant.variant_code || compVariant.barcode || String(compVariant._id),
      itemNameSnapshot: compItem?.item_name || null,
      descriptionSnapshot: compItem?.description || null,
      attributesSnapshot: compItem?.attributeValues || {},
      bundleSnapshot: {
        parentBundleVariantId: String(bundleVariantId),
        parentBundleLineId: String(parent._id),
        isOptional,
        included: shouldInclude
      },
      optionalLine: isOptional,
      hiddenLine: shouldInclude ? false : true,
      lockedSnapshot: false
    });

    createdComponents.push(componentLine);
  }

  const { totals, sections } = await recomputeInvoiceAndSectionTotals({
    organizationId,
    invoiceId: invoice._id
  });

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_bundle_added',
    message: `Bundle added to ${invoice.invoiceNumber}`,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceLineId: parent.invoiceLineId,
      bundleVariantId: String(bundleVariantId),
      pricingMode,
      componentCount: createdComponents.length,
      totals
    }
  });

  return { parent, components: createdComponents, totals, sections };
}

async function patchInvoiceBundleOptionals({
  organizationId,
  invoiceRef,
  parentLineRef,
  userId,
  body = {}
}) {
  const invoice = await loadDraftInvoiceDoc({ organizationId, invoiceRef });
  const parentInvoiceLineId = String(parentLineRef || '').trim();

  const parent = await InvoiceLine.findOne({
    organizationId,
    invoiceId: invoice._id,
    invoiceLineId: parentInvoiceLineId,
    lineType: 'bundle_parent'
  });
  if (!parent) {
    const err = new Error('Bundle line not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const included = new Set(
    (Array.isArray(body?.includedComponentVariantIds) ? body.includedComponentVariantIds : [])
      .map((id) => String(id))
      .filter(Boolean)
  );

  const optionalChildren = await InvoiceLine.find({
    organizationId,
    invoiceId: invoice._id,
    parentBundleLineId: parent._id,
    lineType: 'bundle_component',
    optionalLine: true
  });

  if (!optionalChildren.length) {
    const err = new Error('This bundle has no optional components on the invoice');
    err.code = 'VALIDATION';
    throw err;
  }

  for (const child of optionalChildren) {
    const variantKey = String(child.variantId || '');
    const shouldInclude = included.has(variantKey);
    const nextHidden = !shouldInclude;

    if (child.hiddenLine === nextHidden) continue;

    child.hiddenLine = nextHidden;
    if (child.bundleSnapshot && typeof child.bundleSnapshot === 'object') {
      child.bundleSnapshot = { ...child.bundleSnapshot, included: shouldInclude };
    }

    const computed = invoiceTotalsService.computeLineTotals(child);
    child.lineSubtotal = computed.lineSubtotal;
    child.lineTaxTotal = computed.lineTaxTotal;
    child.lineTotal = computed.lineTotal;
    child.lockedSnapshot = false;

    await child.save();
  }

  const { totals, sections } = await recomputeInvoiceAndSectionTotals({
    organizationId,
    invoiceId: invoice._id
  });
  const lines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_bundle_optionals_updated',
    message: `Bundle optional components updated on ${invoice.invoiceNumber}`,
    details: { invoiceNumber: invoice.invoiceNumber, parentInvoiceLineId, totals }
  });

  return { lines, totals, sections };
}

module.exports = {
  addSalesOrderBundle,
  patchSalesOrderBundleOptionals,
  addInvoiceBundle,
  patchInvoiceBundleOptionals
};

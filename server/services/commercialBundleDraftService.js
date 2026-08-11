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
  const hasExplicitOptionals = Object.prototype.hasOwnProperty.call(
    body || {},
    'includedOptionalComponentVariantIds'
  );
  const includedOptionalList = hasExplicitOptionals
    ? (Array.isArray(body.includedOptionalComponentVariantIds)
        ? body.includedOptionalComponentVariantIds
        : []
      )
        .map((v) => String(v))
        .filter(Boolean)
    : undefined;
  const componentQuantities =
    body?.componentQuantities && typeof body.componentQuantities === 'object'
      ? body.componentQuantities
      : null;
  return {
    bundleVariantId,
    quantity,
    priceBookId: body?.priceBookId ?? null,
    asOfDate: body?.asOfDate ?? null,
    includedOptionalList,
    componentQuantities
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
  const { bundleVariantId, quantity, priceBookId, includedOptionalList, componentQuantities } =
    parseAddBundleBody(body);
  const pricingAsOfDate = body?.asOfDate ?? order.orderDate ?? null;

  const bundleComponents = await catalogBundleService.getBundleComponents(bundleVariantId, organizationId);
  const preview = await catalogBundleService.expandBundlePreview({
    organizationId,
    bundleVariantId,
    priceBookId,
    quantity,
    asOfDate: pricingAsOfDate,
    includedOptionalComponentVariantIds: includedOptionalList,
    componentQuantities,
    validate: true
  });

  const pricingMode =
    String(preview.pricingMode || bundleComponents.pricingMode || '')
      .toLowerCase()
      .trim() || 'fixed';

  const includedIds = new Set(
    (preview.lines || []).filter((l) => l.included).map((l) => String(l.componentVariantId))
  );

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
    bundleSnapshot: catalogBundleService.buildBundleSnapshot({
      definition: bundleComponents,
      preview,
      includedIds
    }),
    optionalLine: false,
    hiddenLine: false,
    lockedSnapshot: false
  });

  const createdComponents = [];
  let childOrder = nextOrder + 1;
  const componentRows = Array.isArray(bundleComponents.components) ? bundleComponents.components : [];
  for (const comp of componentRows) {
    const isOptional = comp.isOptional === true;
    const shouldInclude = includedIds.has(String(comp.componentVariantId));
    const unitQty =
      componentQuantities && componentQuantities[String(comp.componentVariantId)] != null
        ? Number(componentQuantities[String(comp.componentVariantId)])
        : Number(comp.quantity) || 0;
    const componentQty = unitQty * quantity;
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
        included: shouldInclude,
        editableQuantity: comp.editableQuantity === true,
        remarks: comp.remarks || ''
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
      bundleType: preview.bundleType,
      revision: preview.revision,
      componentCount: createdComponents.length,
      totals
    }
  });

  return { parent, components: createdComponents, totals, sections };
}

async function repriceParentBundleFromChildren({ parent, LineModel, findChildren }) {
  const snap = parent.bundleSnapshot && typeof parent.bundleSnapshot === 'object' ? parent.bundleSnapshot : {};
  const mode = String(snap.pricingMode || '').toLowerCase();
  const children = await findChildren();
  const rollup = children
    .filter((c) => !c.hiddenLine)
    .reduce(
      (sum, c) => sum + (Number(c.lineSubtotal) || 0) / Math.max(Number(parent.quantity) || 1, 1e-9),
      0
    );

  let unit = parent.unitPriceSnapshot;
  let discountApplied = Number(snap.discountApplied) || 0;
  if (mode === 'rollup' || mode === 'discount') {
    unit = rollup;
    discountApplied = 0;
    if (mode === 'discount') {
      if (snap.discountType === 'percent') {
        discountApplied = (rollup * (Number(snap.discountValue) || 0)) / 100;
      } else if (snap.discountType === 'amount') {
        discountApplied = Math.min(Number(snap.discountValue) || 0, rollup);
      }
      unit = Math.max(0, rollup - discountApplied);
    }
    parent.unitPriceSnapshot = unit;
    parent.listPriceSnapshot = unit;
  }

  parent.bundleSnapshot = {
    ...snap,
    rollupComponentTotal: mode === 'fixed' ? snap.rollupComponentTotal : rollup,
    discountApplied: mode === 'discount' ? discountApplied : snap.discountApplied || 0,
    components: Array.isArray(snap.components)
      ? snap.components.map((c) => {
          const child = children.find((ch) => String(ch.variantId) === String(c.componentVariantId));
          return {
            ...c,
            included: child ? !child.hiddenLine : !c.isOptional
          };
        })
      : snap.components
  };

  const computed =
    LineModel === SalesOrderLine
      ? salesOrderTotalsService.computeLineTotals(parent)
      : LineModel === InvoiceLine
        ? invoiceTotalsService.computeLineTotals(parent)
        : null;
  if (computed) {
    parent.lineSubtotal = computed.lineSubtotal;
    parent.lineTaxTotal = computed.lineTaxTotal;
    parent.lineTotal = computed.lineTotal;
  }
  await parent.save();
}

async function assertOptionalSelectionRules(parent, included) {
  const snap = parent.bundleSnapshot && typeof parent.bundleSnapshot === 'object' ? parent.bundleSnapshot : {};
  const optionalDefs = Array.isArray(snap.components)
    ? snap.components.filter((c) => c.isOptional === true)
    : [];
  const selectedOptionalCount = optionalDefs.filter((c) =>
    included.has(String(c.componentVariantId))
  ).length;
  if (snap.minOptionalSelection != null && selectedOptionalCount < Number(snap.minOptionalSelection)) {
    const err = new Error(`Select at least ${snap.minOptionalSelection} optional component(s)`);
    err.code = 'VALIDATION';
    err.details = { rule: 'min_optional_selection', min: snap.minOptionalSelection, selected: selectedOptionalCount };
    throw err;
  }
  if (snap.maxOptionalSelection != null && selectedOptionalCount > Number(snap.maxOptionalSelection)) {
    const err = new Error(`Select at most ${snap.maxOptionalSelection} optional component(s)`);
    err.code = 'VALIDATION';
    err.details = { rule: 'max_optional_selection', max: snap.maxOptionalSelection, selected: selectedOptionalCount };
    throw err;
  }
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

  await assertOptionalSelectionRules(parent, included);

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

  await repriceParentBundleFromChildren({
    parent,
    LineModel: SalesOrderLine,
    findChildren: () =>
      SalesOrderLine.find({
        organizationId,
        salesOrderId: order._id,
        parentBundleLineId: parent._id,
        lineType: 'bundle_component'
      })
  });

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
  const { bundleVariantId, quantity, priceBookId, includedOptionalList, componentQuantities } =
    parseAddBundleBody(body);
  const pricingAsOfDate = body?.asOfDate ?? invoice.invoiceDate ?? null;

  const bundleComponents = await catalogBundleService.getBundleComponents(bundleVariantId, organizationId);
  const preview = await catalogBundleService.expandBundlePreview({
    organizationId,
    bundleVariantId,
    priceBookId,
    quantity,
    asOfDate: pricingAsOfDate,
    includedOptionalComponentVariantIds: includedOptionalList,
    componentQuantities,
    validate: true
  });

  const pricingMode =
    String(preview.pricingMode || bundleComponents.pricingMode || '')
      .toLowerCase()
      .trim() || 'fixed';

  const includedIds = new Set(
    (preview.lines || []).filter((l) => l.included).map((l) => String(l.componentVariantId))
  );

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
    bundleSnapshot: catalogBundleService.buildBundleSnapshot({
      definition: bundleComponents,
      preview,
      includedIds
    }),
    optionalLine: false,
    hiddenLine: false,
    lockedSnapshot: false
  });

  const createdComponents = [];
  let childOrder = nextOrder + 1;
  const componentRows = Array.isArray(bundleComponents.components) ? bundleComponents.components : [];
  for (const comp of componentRows) {
    const isOptional = comp.isOptional === true;
    const shouldInclude = includedIds.has(String(comp.componentVariantId));
    const unitQty =
      componentQuantities && componentQuantities[String(comp.componentVariantId)] != null
        ? Number(componentQuantities[String(comp.componentVariantId)])
        : Number(comp.quantity) || 0;
    const componentQty = unitQty * quantity;
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

  await assertOptionalSelectionRules(parent, included);

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

  await repriceParentBundleFromChildren({
    parent,
    LineModel: InvoiceLine,
    findChildren: () =>
      InvoiceLine.find({
        organizationId,
        invoiceId: invoice._id,
        parentBundleLineId: parent._id,
        lineType: 'bundle_component'
      })
  });

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

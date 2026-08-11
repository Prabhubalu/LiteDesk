const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteSection = require('../models/QuoteSection');
const ItemVariant = require('../models/ItemVariant');
const Item = require('../models/Item');
const { resolveCommercialPrice } = require('../services/pricingEngineService');
const catalogBundleService = require('../services/catalogBundleService');
const quoteTotalsService = require('../services/quoteTotalsService');
const {
  recomputeQuoteAndSectionTotals,
  assignLineToSection,
  moveBundleGroupToSection,
  findOrCreateSectionByTitle,
  resolveSectionForQuote
} = require('../services/quoteSectionService');
const { writeQuoteActivity } = require('../services/quoteActivityService');
const { isCatalogItemSellable } = require('../constants/catalogLifecycle');
const { isCommerciallyLockedStatus, assertQuoteRecordEditable } = require('../constants/quoteLifecycle');
const { guardQuoteLineQuantity } = require('../services/inventoryAtpGuardService');

function asNumber(value, { defaultValue = NaN } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

async function sectionSnapshotForActivity({ organizationId, quoteId, sectionId }) {
  if (!sectionId) return { id: null, title: null };
  const section = await QuoteSection.findOne({ organizationId, quoteId, _id: sectionId })
    .select('sectionTitle quoteSectionId')
    .lean();
  if (!section) return { id: String(sectionId), title: null };
  return {
    id: section.quoteSectionId || String(section._id),
    title: section.sectionTitle || null
  };
}

function userCanOverridePricing(req) {
  // Temporary: until we add explicit override permissions in the role model,
  // restrict to owner/admin.
  if (req.user?.isOwner) return true;
  const role = String(req.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin';
}

function assertQuoteCommerciallyEditableForLineWrite({ quoteStatus, overridePricing, req }) {
  assertQuoteRecordEditable({ status: quoteStatus });
  if (!isCommerciallyLockedStatus(quoteStatus)) return;
  if (overridePricing === true && userCanOverridePricing(req)) return;
  const err = new Error('Quote is commercially locked after Sent. Create a revision or use override permission.');
  err.code = 'QUOTE_COMMERCIALLY_LOCKED';
  throw err;
}

function assertVariantSellable(variantLifecycleState) {
  if (isCatalogItemSellable(variantLifecycleState)) return;
  const err = new Error('Variant is not sellable in its current lifecycle state');
  err.code = 'VARIANT_NOT_SELLABLE';
  throw err;
}

async function afterLinesChanged({ organizationId, quoteId }) {
  return recomputeQuoteAndSectionTotals({ organizationId, quoteId });
}

/** @deprecated use afterLinesChanged */
async function recomputeQuoteSimpleTotals({ organizationId, quoteId }) {
  const { totals } = await afterLinesChanged({ organizationId, quoteId });
  return totals;
}

async function getNextLineOrder({ organizationId, quoteId }) {
  const last = await QuoteLine.findOne({ organizationId, quoteId })
    .sort({ lineOrder: -1, createdAt: -1 })
    .select('lineOrder')
    .lean();
  const n = Number(last?.lineOrder);
  return Number.isFinite(n) ? n + 1 : 1;
}

function normalizeReorderOpsOrThrow(orders, { organizationId, quoteId }) {
  if (!Array.isArray(orders) || orders.length === 0) {
    const err = new Error('orders[] is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const seen = new Set();
  const ops = [];
  for (const row of orders) {
    const id = row?.quoteLineId;
    if (!id) {
      const err = new Error('Each order row requires quoteLineId');
      err.code = 'VALIDATION';
      throw err;
    }
    if (seen.has(id)) {
      const err = new Error('Duplicate quoteLineId in orders[]');
      err.code = 'VALIDATION';
      throw err;
    }
    seen.add(id);

    const order = asNumber(row?.lineOrder, { defaultValue: NaN });
    if (!Number.isFinite(order)) {
      const err = new Error('lineOrder must be a number');
      err.code = 'VALIDATION';
      throw err;
    }

    ops.push({
      updateOne: {
        filter: { organizationId, quoteId, quoteLineId: id },
        update: { $set: { lineOrder: order } }
      }
    });
  }

  return ops;
}

/**
 * POST /api/quotes/:id/lines
 * Body: { variantId, priceBookId?, quantity, asOfDate? }
 */
async function addQuoteLine(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    if (quote.approvalLocked === true) {
      return res.status(400).json({ success: false, message: 'Quote is approval-locked', code: 'APPROVAL_LOCKED' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteCommerciallyEditableForLineWrite({
      quoteStatus: quote.status,
      overridePricing: override,
      req
    });

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
    assertVariantSellable(variant.lifecycle_state);

    const item = await Item.findOne({ _id: variant.itemId, organizationId, deletedAt: null })
      .select('item_name description unit_of_measure attributeValues categoryId')
      .lean();

    const pricingAsOfDate = req.body?.asOfDate ?? quote.quoteDate ?? null;
    const pricingCtx = {
      ...(req.body?.pricingContext || {}),
      customerId: req.body?.pricingContext?.customerId || quote.customerId || null,
      currency: req.body?.pricingContext?.currency || quote.currency || null,
    };

    const price = await resolveCommercialPrice({
      organizationId,
      variantId,
      priceBookId: req.body?.priceBookId ?? null,
      quantity,
      asOfDate: pricingAsOfDate,
      context: pricingCtx,
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

    const inventoryAtp = await guardQuoteLineQuantity({
      organizationId,
      quoteId: quote._id,
      variantId: variant._id,
      quantity,
      userId: req.user._id,
      forceProceed: req.body?.forceAtpProceed === true
    });

    const targetSection = await resolveSectionForQuote({
      organizationId,
      quoteId: quote._id,
      sectionRef: req.body?.quoteSectionId,
      quoteStatus: quote.status
    });

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

    const line = await QuoteLine.create({
      organizationId,
      quoteId: quote._id,
      variantId: variant._id,
      quoteSectionId: targetSection._id,

      quantity,
      unitOfMeasure: variant.unit_of_measure || item?.unit_of_measure || null,

      unitPriceSnapshot: unitPrice,
      listPriceSnapshot: listPrice,
      pricingSourceSnapshot: price.source || null,
      priceBookIdSnapshot: price.priceBookId || null,
      priceBookNameSnapshot: price.priceBookName || null,
      priceBookEntryIdSnapshot: price.entryId || null,
      pricingAsOfDateSnapshot: pricingAsOfDate ? new Date(pricingAsOfDate) : null,
      pricingEffectiveFromSnapshot: price.effectiveFrom ? new Date(price.effectiveFrom) : null,
      pricingEffectiveToSnapshot: price.effectiveTo ? new Date(price.effectiveTo) : null,
      pricingMinQtySnapshot: Number.isFinite(Number(price.minQty)) ? Number(price.minQty) : null,
      pricingBreakdownSnapshot: price.pricingBreakdown || null,

      taxSnapshot: computed.taxSnapshot,
      lineSubtotal: computed.lineSubtotal,
      lineTaxTotal: computed.lineTaxTotal,
      lineTotal: computed.lineTotal,

      currencySnapshot: quote.currency || price.currency || variant.currency || 'USD',
      exchangeRateSnapshot: Number(quote.exchangeRateSnapshot) || 1,

      skuSnapshot: variant.variant_code || variant.barcode || String(variant._id),
      itemNameSnapshot: item?.item_name || null,
      descriptionSnapshot: item?.description || null,
      attributesSnapshot: attributesFromConfig,
      productConfigurationId,
      productConfigurationVersion,
      configurationSelections,
      configurationSnapshot,

      lockedSnapshot: isCommerciallyLockedStatus(quote.status)
    });

    const { totals, sections } = await afterLinesChanged({ organizationId, quoteId: quote._id });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_line_added',
      message: 'Line added',
      details: {
        quoteLineId: line.quoteLineId,
        variantId: String(variant._id),
        quantity: line.quantity,
        unitPriceSnapshot: line.unitPriceSnapshot,
        pricingSourceSnapshot: line.pricingSourceSnapshot,
        priceBookIdSnapshot: line.priceBookIdSnapshot ? String(line.priceBookIdSnapshot) : null,
        priceBookEntryIdSnapshot: line.priceBookEntryIdSnapshot ? String(line.priceBookEntryIdSnapshot) : null,
        totals
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        line,
        totals,
        sections,
        inventoryAtp: inventoryAtp.warnings?.length ? inventoryAtp : undefined
      }
    });
  } catch (err) {
    const status =
      err?.code === 'INSUFFICIENT_ATP'
        ? 409
        : err?.code === 'VALIDATION' || err?.code === 'SECTION_NOT_FOUND' || err?.code === 'QUOTE_COMMERCIALLY_LOCKED'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to add quote line',
      code: err?.code || 'UNKNOWN',
      canProceed: err.canProceed === true,
      policy: err.policy || err.details?.policy || null,
      details: err?.details || null
    });
  }
}

/**
 * POST /api/quotes/:id/bundles
 * Body: {
 *   bundleVariantId, priceBookId?, quantity, asOfDate?,
 *   includedOptionalComponentVariantIds?, componentQuantities?, overridePricing?
 * }
 */
async function addQuoteBundle(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    if (quote.approvalLocked === true) {
      return res.status(400).json({ success: false, message: 'Quote is approval-locked', code: 'APPROVAL_LOCKED' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteCommerciallyEditableForLineWrite({
      quoteStatus: quote.status,
      overridePricing: override,
      req
    });

    const bundleVariantId = req.body?.bundleVariantId;
    if (!bundleVariantId) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'bundleVariantId is required' });
    }

    const bundleQuantity = asNumber(req.body?.quantity, { defaultValue: NaN });
    if (!Number.isFinite(bundleQuantity) || bundleQuantity <= 0) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'quantity must be > 0' });
    }

    const pricingAsOfDate = req.body?.asOfDate ?? quote.quoteDate ?? null;
    const priceBookId = req.body?.priceBookId ?? null;

    const hasExplicitOptionals = Object.prototype.hasOwnProperty.call(
      req.body || {},
      'includedOptionalComponentVariantIds'
    );
    const includedOptionalList = hasExplicitOptionals
      ? (Array.isArray(req.body.includedOptionalComponentVariantIds)
          ? req.body.includedOptionalComponentVariantIds
          : []
        ).map((v) => String(v)).filter(Boolean)
      : undefined;

    const componentQuantities =
      req.body?.componentQuantities && typeof req.body.componentQuantities === 'object'
        ? req.body.componentQuantities
        : null;

    const bundleComponents = await catalogBundleService.getBundleComponents(bundleVariantId, organizationId);
    const preview = await catalogBundleService.expandBundlePreview({
      organizationId,
      bundleVariantId,
      priceBookId,
      quantity: bundleQuantity,
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

    const nextOrder = await getNextLineOrder({ organizationId, quoteId: quote._id });

    const targetSection = await resolveSectionForQuote({
      organizationId,
      quoteId: quote._id,
      sectionRef: req.body?.quoteSectionId,
      quoteStatus: quote.status
    });

    const parentUnitPrice = Number(preview.bundleUnitPrice) || 0;
    const parentComputed = quoteTotalsService.computeLineTotals({
      quantity: bundleQuantity,
      unitPriceSnapshot: parentUnitPrice,
      discountType: null,
      discountValue: 0,
      discountAmount: 0
    });

    const parent = await QuoteLine.create({
      organizationId,
      quoteId: quote._id,
      variantId: bundleVariantId,
      quoteSectionId: targetSection._id,
      lineType: 'bundle_parent',
      parentBundleLineId: null,
      lineOrder: nextOrder,

      quantity: bundleQuantity,
      unitOfMeasure: null,

      unitPriceSnapshot: parentUnitPrice,
      listPriceSnapshot: parentUnitPrice,
      pricingSourceSnapshot: preview.bundlePriceSource || null,
      priceBookIdSnapshot: priceBookId || null,
      priceBookNameSnapshot: null,
      priceBookEntryIdSnapshot: null,
      pricingAsOfDateSnapshot: pricingAsOfDate ? new Date(pricingAsOfDate) : null,

      taxSnapshot: { mode: 'none', source: 'taxCalculationService' },
      lineSubtotal: parentComputed.lineSubtotal,
      lineTaxTotal: parentComputed.lineTaxTotal,
      lineTotal: parentComputed.lineTotal,

      currencySnapshot: quote.currency || preview.currency || 'USD',
      exchangeRateSnapshot: Number(quote.exchangeRateSnapshot) || 1,

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
      lockedSnapshot: isCommerciallyLockedStatus(quote.status)
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
      const componentQty = unitQty * bundleQuantity;
      if (!Number.isFinite(componentQty) || componentQty <= 0) continue;

      const compVariant = await ItemVariant.findOne({ _id: comp.componentVariantId, organizationId }).lean();
      if (!compVariant) continue;
      assertVariantSellable(compVariant.lifecycle_state);

      const compItem = await Item.findOne({ _id: compVariant.itemId, organizationId, deletedAt: null })
        .select('item_name description unit_of_measure attributeValues')
        .lean();

      const compPrice = await resolveCommercialPrice({
        organizationId,
        variantId: comp.componentVariantId,
        priceBookId,
        quantity: componentQty,
        asOfDate: pricingAsOfDate,
        context: {
          customerId: quote.customerId || null,
          currency: quote.currency || null,
        },
      });

      const compUnitPrice = Number(compPrice.unitPrice) || 0;
      const compListPrice = Number(compPrice.listPrice != null ? compPrice.listPrice : compUnitPrice) || 0;
      const compComputed = quoteTotalsService.computeLineTotals({
        quantity: componentQty,
        unitPriceSnapshot: compUnitPrice,
        discountType: null,
        discountValue: 0,
        discountAmount: 0
      });

      const componentLine = await QuoteLine.create({
        organizationId,
        quoteId: quote._id,
        variantId: compVariant._id,
        quoteSectionId: targetSection._id,
        lineType: 'bundle_component',
        parentBundleLineId: parent._id,
        lineOrder: childOrder++,

        quantity: componentQty,
        unitOfMeasure: compVariant.unit_of_measure || compItem?.unit_of_measure || null,

        unitPriceSnapshot: compUnitPrice,
        listPriceSnapshot: compListPrice,
        pricingSourceSnapshot: compPrice.source || null,
        priceBookIdSnapshot: compPrice.priceBookId || priceBookId || null,
        priceBookNameSnapshot: compPrice.priceBookName || null,
        priceBookEntryIdSnapshot: compPrice.entryId || null,
        pricingAsOfDateSnapshot: pricingAsOfDate ? new Date(pricingAsOfDate) : null,
        pricingEffectiveFromSnapshot: compPrice.effectiveFrom ? new Date(compPrice.effectiveFrom) : null,
        pricingEffectiveToSnapshot: compPrice.effectiveTo ? new Date(compPrice.effectiveTo) : null,
        pricingMinQtySnapshot: Number.isFinite(Number(compPrice.minQty)) ? Number(compPrice.minQty) : null,
        pricingBreakdownSnapshot: compPrice.pricingBreakdown || null,

        taxSnapshot: { mode: 'none', source: 'taxCalculationService' },
        lineSubtotal: compComputed.lineSubtotal,
        lineTaxTotal: compComputed.lineTaxTotal,
        lineTotal: compComputed.lineTotal,

        currencySnapshot: quote.currency || compPrice.currency || compVariant.currency || 'USD',
        exchangeRateSnapshot: Number(quote.exchangeRateSnapshot) || 1,

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
        lockedSnapshot: isCommerciallyLockedStatus(quote.status)
      });

      createdComponents.push(componentLine);
    }

    const { totals, sections } = await afterLinesChanged({ organizationId, quoteId: quote._id });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_bundle_added',
      message: 'Bundle added',
      details: {
        quoteLineId: parent.quoteLineId,
        bundleVariantId: String(bundleVariantId),
        pricingMode,
        bundleType: preview.bundleType,
        revision: preview.revision,
        componentCount: createdComponents.length,
        totals
      }
    });

    return res.status(201).json({
      success: true,
      data: { parent, components: createdComponents, totals, sections }
    });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' ||
      err?.code === 'QUOTE_COMMERCIALLY_LOCKED' ||
      err?.code === 'VARIANT_NOT_SELLABLE'
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

/**
 * PATCH /api/quotes/:id/bundles/:parentLineId/optionals
 * Body: { includedComponentVariantIds: string[], overridePricing? }
 */
async function patchBundleOptionalComponents(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const parentQuoteLineId = req.params.parentLineId;

    const quote = await Quote.findOne({ _id: quoteId, organizationId }).lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    if (quote.approvalLocked === true) {
      return res.status(400).json({ success: false, message: 'Quote is approval-locked', code: 'APPROVAL_LOCKED' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteCommerciallyEditableForLineWrite({
      quoteStatus: quote.status,
      overridePricing: override,
      req
    });

    const parent = await QuoteLine.findOne({
      organizationId,
      quoteId,
      quoteLineId: parentQuoteLineId,
      lineType: 'bundle_parent'
    });
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Bundle line not found', code: 'NOT_FOUND' });
    }

    const included = new Set(
      (Array.isArray(req.body?.includedComponentVariantIds) ? req.body.includedComponentVariantIds : [])
        .map((id) => String(id))
        .filter(Boolean)
    );

    const snap = parent.bundleSnapshot && typeof parent.bundleSnapshot === 'object' ? parent.bundleSnapshot : {};
    const optionalDefs = Array.isArray(snap.components)
      ? snap.components.filter((c) => c.isOptional === true)
      : [];
    const selectedOptionalCount = optionalDefs.filter((c) =>
      included.has(String(c.componentVariantId))
    ).length;

    if (snap.minOptionalSelection != null && selectedOptionalCount < Number(snap.minOptionalSelection)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION',
        message: `Select at least ${snap.minOptionalSelection} optional component(s)`,
        details: { rule: 'min_optional_selection', min: snap.minOptionalSelection, selected: selectedOptionalCount }
      });
    }
    if (snap.maxOptionalSelection != null && selectedOptionalCount > Number(snap.maxOptionalSelection)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION',
        message: `Select at most ${snap.maxOptionalSelection} optional component(s)`,
        details: { rule: 'max_optional_selection', max: snap.maxOptionalSelection, selected: selectedOptionalCount }
      });
    }

    const optionalChildren = await QuoteLine.find({
      organizationId,
      quoteId,
      parentBundleLineId: parent._id,
      lineType: 'bundle_component',
      optionalLine: true
    });

    if (!optionalChildren.length) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION',
        message: 'This bundle has no optional components on the quote'
      });
    }

    const updated = [];
    for (const child of optionalChildren) {
      const variantKey = String(child.variantId || '');
      const shouldInclude = included.has(variantKey);
      const nextHidden = !shouldInclude;

      if (child.hiddenLine === nextHidden) continue;

      child.hiddenLine = nextHidden;
      if (child.bundleSnapshot && typeof child.bundleSnapshot === 'object') {
        child.bundleSnapshot = { ...child.bundleSnapshot, included: shouldInclude };
      }

      const computed = quoteTotalsService.computeLineTotals(child);
      child.lineSubtotal = computed.lineSubtotal;
      child.lineTaxTotal = computed.lineTaxTotal;
      child.lineTotal = computed.lineTotal;
      child.lockedSnapshot = child.lockedSnapshot || isCommerciallyLockedStatus(quote.status);

      await child.save();
      updated.push(child);
    }

    // Reprice parent when mode is rollup or discount (sum of visible component lines).
    const mode = String(snap.pricingMode || '').toLowerCase();
    if (mode === 'rollup' || mode === 'discount') {
      const allChildren = await QuoteLine.find({
        organizationId,
        quoteId,
        parentBundleLineId: parent._id,
        lineType: 'bundle_component'
      }).lean();
      const rollup = allChildren
        .filter((c) => !c.hiddenLine)
        .reduce((sum, c) => sum + (Number(c.lineSubtotal) || 0) / Math.max(Number(parent.quantity) || 1, 1e-9), 0);

      let unit = rollup;
      let discountApplied = 0;
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
      parent.bundleSnapshot = {
        ...snap,
        rollupComponentTotal: rollup,
        discountApplied,
        components: Array.isArray(snap.components)
          ? snap.components.map((c) => ({
              ...c,
              included: !c.isOptional || included.has(String(c.componentVariantId))
            }))
          : snap.components
      };
      const parentComputed = quoteTotalsService.computeLineTotals(parent);
      parent.lineSubtotal = parentComputed.lineSubtotal;
      parent.lineTaxTotal = parentComputed.lineTaxTotal;
      parent.lineTotal = parentComputed.lineTotal;
      await parent.save();
    } else if (Array.isArray(snap.components)) {
      parent.bundleSnapshot = {
        ...snap,
        components: snap.components.map((c) => ({
          ...c,
          included: !c.isOptional || included.has(String(c.componentVariantId))
        }))
      };
      await parent.save();
    }

    const { totals, sections } = await afterLinesChanged({ organizationId, quoteId });
    const lines = await QuoteLine.find({ organizationId, quoteId })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

    await writeQuoteActivity({
      organizationId,
      quoteId,
      userId: req.user._id,
      action: 'quote_bundle_optionals_updated',
      message: 'Bundle optional components updated',
      details: {
        parentQuoteLineId,
        updatedCount: updated.length,
        totals
      }
    });

    return res.json({
      success: true,
      data: { parent, lines, totals, sections, updatedLines: updated }
    });
  } catch (err) {
    const status = err?.code === 'VALIDATION' || err?.code === 'QUOTE_COMMERCIALLY_LOCKED' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update bundle optional components',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * PATCH /api/quotes/:id/lines/:lineId
 * Body: { quantity?, discountType?, discountValue?, discountAmount?, hiddenLine?, optionalLine?, lineGroupKey?, overridePricing? }
 *
 * Notes:
 * - Commercially locked quotes (Sent+) block commercial edits unless override.
 * - This endpoint does NOT re-resolve pricing; it operates on snapshots only.
 */
async function patchQuoteLine(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const quoteLineId = req.params.lineId;

    const quote = await Quote.findOne({ _id: quoteId, organizationId }).lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    if (quote.approvalLocked === true) {
      return res.status(400).json({ success: false, message: 'Quote is approval-locked', code: 'APPROVAL_LOCKED' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteCommerciallyEditableForLineWrite({
      quoteStatus: quote.status,
      overridePricing: override,
      req
    });

    const line = await QuoteLine.findOne({ quoteId, quoteLineId, organizationId });
    if (!line) {
      return res.status(404).json({ success: false, message: 'Quote line not found', code: 'NOT_FOUND' });
    }

    const previousSectionId = line.quoteSectionId ? String(line.quoteSectionId) : null;
    let sectionAssignmentRequested = false;

    if (req.body?.quantity !== undefined) {
      const quantity = asNumber(req.body?.quantity, { defaultValue: NaN });
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'quantity must be > 0' });
      }

      if (String(line.lineType || 'standard') !== 'bundle_parent') {
        await guardQuoteLineQuantity({
          organizationId,
          quoteId: quote._id,
          variantId: line.variantId,
          quantity,
          userId: req.user._id,
          forceProceed: req.body?.forceAtpProceed === true,
          excludeQuoteLineId: line.quoteLineId
        });
      }

      line.quantity = quantity;
    }

    if (req.body?.discountType !== undefined) {
      line.discountType = req.body.discountType;
    }
    if (req.body?.discountValue !== undefined) {
      const v = asNumber(req.body.discountValue, { defaultValue: NaN });
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'discountValue must be >= 0' });
      }
      line.discountValue = v;
    }
    if (
      (req.body?.discountType !== undefined || req.body?.discountValue !== undefined) &&
      req.body?.discountAmount === undefined
    ) {
      line.discountAmount = 0;
    }
    if (req.body?.discountAmount !== undefined) {
      const a = asNumber(req.body.discountAmount, { defaultValue: NaN });
      if (!Number.isFinite(a) || a < 0) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'discountAmount must be >= 0' });
      }
      line.discountAmount = a;
    }

    if (req.body?.hiddenLine !== undefined) {
      line.hiddenLine = req.body.hiddenLine === true;
      if (String(line.lineType || '') === 'bundle_component' && line.bundleSnapshot && typeof line.bundleSnapshot === 'object') {
        line.bundleSnapshot = {
          ...line.bundleSnapshot,
          included: line.hiddenLine !== true
        };
      }
    }
    if (req.body?.optionalLine !== undefined) {
      line.optionalLine = req.body.optionalLine === true;
    }

    if (req.body?.quoteSectionId !== undefined) {
      sectionAssignmentRequested = true;
      const lineType = String(line.lineType || 'standard');
      if (lineType === 'bundle_component') {
        return res.status(400).json({
          success: false,
          code: 'BUNDLE_SECTION_SPLIT',
          message: 'Move the bundle parent to change section for all components'
        });
      }
      if (lineType === 'bundle_parent') {
        await moveBundleGroupToSection({
          organizationId,
          quoteId,
          parentLine: line,
          quoteSectionId: req.body.quoteSectionId
        });
      } else {
        await assignLineToSection({
          organizationId,
          quoteId,
          line,
          quoteSectionId: req.body.quoteSectionId,
          quoteStatus: quote.status
        });
      }
    }

    if (req.body?.lineGroupKey !== undefined) {
      const key = req.body.lineGroupKey ? String(req.body.lineGroupKey).trim() : null;
      if (key) {
        sectionAssignmentRequested = true;
        const section = await findOrCreateSectionByTitle({
          organizationId,
          quoteId,
          title: key,
          quoteStatus: quote.status
        });
        line.quoteSectionId = section._id;
      }
    }

    if (req.body?.taxIds !== undefined) {
      const {
        hydrateTaxIds,
        applyTaxesToLine
      } = require('../services/commercialTaxApplicationService');
      const itemTaxes = Array.isArray(req.body.taxIds) && req.body.taxIds.length
        ? await hydrateTaxIds(organizationId, req.body.taxIds)
        : [];
      const applied = applyTaxesToLine(line, itemTaxes);
      line.taxSnapshot = applied.taxSnapshot;
      line.lineSubtotal = applied.lineSubtotal;
      line.lineTaxTotal = applied.lineTaxTotal;
      line.lineTotal = applied.lineTotal;
    } else {
      const {
        applyTaxesToLine,
        taxesFromSnapshot
      } = require('../services/commercialTaxApplicationService');
      const applied = applyTaxesToLine(line, taxesFromSnapshot(line.taxSnapshot));
      line.taxSnapshot = applied.taxSnapshot;
      line.lineSubtotal = applied.lineSubtotal;
      line.lineTaxTotal = applied.lineTaxTotal;
      line.lineTotal = applied.lineTotal;
    }

    const commercialFieldsChanged =
      req.body?.quantity !== undefined ||
      req.body?.discountType !== undefined ||
      req.body?.discountValue !== undefined ||
      req.body?.discountAmount !== undefined ||
      req.body?.hiddenLine !== undefined ||
      req.body?.optionalLine !== undefined ||
      req.body?.taxIds !== undefined;

    // If quote is locked, keep lockedSnapshot true
    line.lockedSnapshot = line.lockedSnapshot || isCommerciallyLockedStatus(quote.status);

    await line.save();

    const { totals, sections } = await afterLinesChanged({ organizationId, quoteId: quoteId });

    const newSectionId = line.quoteSectionId ? String(line.quoteSectionId) : null;
    const sectionChanged = sectionAssignmentRequested && previousSectionId !== newSectionId;

    if (sectionChanged) {
      const [fromSection, toSection] = await Promise.all([
        sectionSnapshotForActivity({ organizationId, quoteId, sectionId: previousSectionId }),
        sectionSnapshotForActivity({ organizationId, quoteId, sectionId: newSectionId })
      ]);
      await writeQuoteActivity({
        organizationId,
        quoteId,
        userId: req.user._id,
        action: 'quote_line_section_moved',
        message: toSection.title
          ? `Moved line to section: ${toSection.title}`
          : 'Moved line to another section',
        details: {
          quoteLineId: line.quoteLineId,
          fromSectionId: fromSection.id,
          fromSectionTitle: fromSection.title,
          toSectionId: toSection.id,
          toSectionTitle: toSection.title,
          totals
        }
      });
    }

    if (commercialFieldsChanged || !sectionChanged) {
      await writeQuoteActivity({
        organizationId,
        quoteId,
        userId: req.user._id,
        action: 'quote_line_updated',
        message: 'Line updated',
        details: { quoteLineId: line.quoteLineId, totals }
      });
    }

    return res.json({ success: true, data: { line, totals, sections } });
  } catch (err) {
    const status =
      err?.code === 'INSUFFICIENT_ATP'
        ? 409
        : err?.code === 'VALIDATION' || err?.code === 'QUOTE_COMMERCIALLY_LOCKED'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update quote line',
      code: err?.code || 'UNKNOWN',
      canProceed: err.canProceed === true,
      policy: err.policy || err.details?.policy || null,
      details: err?.details || null
    });
  }
}

/**
 * DELETE /api/quotes/:id/lines/:lineId
 */
async function deleteQuoteLine(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const quoteLineId = req.params.lineId;

    const quote = await Quote.findOne({ _id: quoteId, organizationId }).lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    if (quote.approvalLocked === true) {
      return res.status(400).json({ success: false, message: 'Quote is approval-locked', code: 'APPROVAL_LOCKED' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteCommerciallyEditableForLineWrite({
      quoteStatus: quote.status,
      overridePricing: override,
      req
    });

    const deleted = await QuoteLine.findOneAndDelete({ organizationId, quoteId, quoteLineId }).lean();
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Quote line not found', code: 'NOT_FOUND' });
    }

    // Cascade delete: bundle parents delete their component lines.
    if (String(deleted.lineType) === 'bundle_parent') {
      await QuoteLine.deleteMany({ organizationId, quoteId, parentBundleLineId: deleted._id });
    }

    const { totals, sections } = await afterLinesChanged({ organizationId, quoteId });

    await writeQuoteActivity({
      organizationId,
      quoteId,
      userId: req.user._id,
      action: 'quote_line_deleted',
      message: 'Line deleted',
      details: { quoteLineId, totals }
    });

    return res.json({ success: true, data: { deleted, totals, sections } });
  } catch (err) {
    const status = err?.code === 'VALIDATION' || err?.code === 'QUOTE_COMMERCIALLY_LOCKED' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to delete quote line',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * PATCH /api/quotes/:id/lines/reorder
 * Body: { orders: [{ quoteLineId, lineOrder }], overridePricing? }
 */
async function reorderQuoteLines(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId }).lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    if (quote.approvalLocked === true) {
      return res.status(400).json({ success: false, message: 'Quote is approval-locked', code: 'APPROVAL_LOCKED' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteCommerciallyEditableForLineWrite({
      quoteStatus: quote.status,
      overridePricing: override,
      req
    });

    const orders = req.body?.orders;
    const ops = normalizeReorderOpsOrThrow(orders, { organizationId, quoteId });

    const result = await QuoteLine.bulkWrite(ops, { ordered: true });

    const lines = await QuoteLine.find({ organizationId, quoteId })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

    const { totals, sections } = await afterLinesChanged({ organizationId, quoteId });

    await writeQuoteActivity({
      organizationId,
      quoteId,
      userId: req.user._id,
      action: 'quote_lines_reordered',
      message: 'Lines reordered',
      details: {
        count: Array.isArray(orders) ? orders.length : 0,
        totals
      }
    });

    return res.json({
      success: true,
      data: { lines, totals, sections, bulk: { matched: result.matchedCount, modified: result.modifiedCount } }
    });
  } catch (err) {
    const status = err?.code === 'VALIDATION' || err?.code === 'QUOTE_COMMERCIALLY_LOCKED' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to reorder quote lines',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

module.exports = {
  addQuoteLine,
  addQuoteBundle,
  patchBundleOptionalComponents,
  recomputeQuoteSimpleTotals,
  // exported for unit tests (pure guards; no DB)
  userCanOverridePricing,
  assertQuoteCommerciallyEditableForLineWrite,
  assertVariantSellable,
  patchQuoteLine,
  normalizeReorderOpsOrThrow,
  deleteQuoteLine,
  reorderQuoteLines
};


/**
 * SO1 — Quote → Sales Order conversion (architecture §7.2).
 */

const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteConversionLink = require('../models/QuoteConversionLink');
const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const SalesOrderSection = require('../models/SalesOrderSection');

const { SALES_ORDER_STATUS_ON_QUOTE_CONVERT } = require('../constants/salesOrderLifecycle');
const {
  SALES_ORDER_FULFILLMENT_MODE_DEFAULT,
  assertValidFulfillmentMode
} = require('../constants/salesOrderFulfillment');
const { DEFAULT_SECTION_TITLE } = require('../constants/salesOrderSection');

const { listQuoteSections } = require('./quoteSectionService');
const {
  ensureDefaultSection,
  recomputeSalesOrderAndSectionTotals
} = require('./salesOrderSectionService');
const {
  assertCanConvertQuote,
  resolveConversionTypeForQuote,
  buildConversionMetadata
} = require('./quoteConversionService');
const {
  getAcceptedLineIdsFromQuote,
  getConvertedLineIdsForQuote,
  resolveQuoteConversionCoverage,
  resolveQuoteStatusAfterConversion,
  assertQuoteConversionStatusTransition
} = require('./quoteConversionCoverageService');
const {
  getSelectableLines,
  linesForSelection
} = require('./quotePublicAcceptanceService');
const { writeQuoteActivity } = require('./quoteActivityService');
const { writeSalesOrderActivity } = require('./salesOrderActivityService');

/**
 * Accepted parent line IDs for conversion (full accept uses all selectable lines).
 * @param {object} quote
 * @param {Array} lines
 * @returns {string[]}
 */
function resolveAcceptedLineIds(quote, lines) {
  const fromResponse = getAcceptedLineIdsFromQuote(quote);
  if (fromResponse.length) return fromResponse;

  const status = String(quote?.status || '').trim();
  if (status === 'Accepted') {
    return getSelectableLines(lines).map((line) => String(line.quoteLineId));
  }

  return [];
}

/**
 * @param {object} params
 * @param {string[]} params.acceptedLineIds
 * @param {string[]} params.convertedLineIds
 * @param {string[]|null} params.requestedLineIds
 */
function resolveParentLineIdsToConvert({ acceptedLineIds, convertedLineIds, requestedLineIds }) {
  const converted = new Set((convertedLineIds || []).map(String));
  const unmapped = (acceptedLineIds || []).filter((id) => !converted.has(String(id)));

  if (!unmapped.length) {
    const err = new Error('All accepted lines are already converted to sales orders.');
    err.code = 'ALREADY_CONVERTED';
    throw err;
  }

  if (Array.isArray(requestedLineIds) && requestedLineIds.length) {
    const requested = [...new Set(requestedLineIds.map((id) => String(id).trim()).filter(Boolean))];
    const selected = requested.filter((id) => unmapped.includes(id));
    if (!selected.length) {
      const err = new Error('Selected lines are not eligible for conversion.');
      err.code = 'INVALID_LINE_SELECTION';
      err.details = { requestedLineIds: requested, unmappedLineIds: unmapped };
      throw err;
    }
    return selected;
  }

  return unmapped;
}

/**
 * @param {Array} quoteSections
 * @param {Array} allLines
 * @param {Array} linesToConvert
 * @param {string[]} acceptedLineIds
 */
function buildSectionConversionPlans(quoteSections, allLines, linesToConvert, acceptedLineIds) {
  const convertSet = new Set(linesToConvert.map((line) => String(line.quoteLineId)));
  const acceptedSet = new Set((acceptedLineIds || []).map(String));
  const sectionKeys = new Set();

  for (const line of linesToConvert) {
    if (!line || line.lineType === 'bundle_component') continue;
    sectionKeys.add(line.quoteSectionId ? String(line.quoteSectionId) : '__general__');
  }

  const plans = [];

  for (const secKey of sectionKeys) {
    if (secKey === '__general__') {
      plans.push({
        quoteSectionMongoId: null,
        quoteSection: null,
        sectionAcceptanceType: 'partial',
        isGeneral: true
      });
      continue;
    }

    const quoteSection = (quoteSections || []).find((section) => String(section._id) === secKey);
    if (!quoteSection) continue;

    const selectableInSection = (allLines || []).filter(
      (line) =>
        line &&
        line.hiddenLine !== true &&
        String(line.quoteSectionId || '') === secKey &&
        (String(line.lineType || 'standard') === 'standard' ||
          String(line.lineType || '') === 'bundle_parent')
    );

    const allAcceptedInSection = selectableInSection.every((line) =>
      acceptedSet.has(String(line.quoteLineId))
    );
    const allConvertingInSection = selectableInSection.every((line) =>
      convertSet.has(String(line.quoteLineId))
    );

    const sectionAcceptanceType =
      allAcceptedInSection && allConvertingInSection ? 'full' : 'partial';

    plans.push({
      quoteSectionMongoId: secKey,
      quoteSection,
      sectionAcceptanceType,
      isGeneral: false
    });
  }

  return plans.sort((a, b) => {
    const ao = Number(a.quoteSection?.sectionOrder) || 0;
    const bo = Number(b.quoteSection?.sectionOrder) || 0;
    return ao - bo;
  });
}

function extractQuoteHeaderSnapshots(quote) {
  const cf = quote?.customFields && typeof quote.customFields === 'object' ? quote.customFields : {};
  return {
    billToAddressSnapshot: cf.billToAddress ?? cf.billTo ?? null,
    shipToAddressSnapshot: cf.shipToAddress ?? cf.shipTo ?? null,
    paymentTermsSnapshot: cf.paymentTerms ?? cf.paymentTermsSnapshot ?? null,
    incotermsSnapshot: cf.incoterms ?? cf.incotermsSnapshot ?? null,
    termsConditionsSnapshot: cf.termsConditions ?? cf.termsAndConditions ?? null
  };
}

function resolveSourceQuoteSectionPublicId(quoteLine, quoteSections) {
  if (!quoteLine?.quoteSectionId) return null;
  const sid = String(quoteLine.quoteSectionId);
  const section = (quoteSections || []).find((row) => String(row._id) === sid);
  if (section?.quoteSectionId) return String(section.quoteSectionId);
  return sid;
}

function mapQuoteLineToSalesOrderLine({
  quoteLine,
  salesOrder,
  salesOrderSectionMongoId,
  quoteConversionLinkId,
  revisionNumber,
  parentBundleLineMongoId = null,
  quoteSections = []
}) {
  return {
    organizationId: salesOrder.organizationId,
    salesOrderId: salesOrder._id,
    salesOrderSectionId: salesOrderSectionMongoId,
    variantId: quoteLine.variantId,
    parentBundleLineId: parentBundleLineMongoId,
    lineType: quoteLine.lineType || 'standard',
    lineOrder: Number(quoteLine.lineOrder) || 0,
    quantity: Number(quoteLine.quantity) || 0,
    unitOfMeasure: quoteLine.unitOfMeasure ?? null,
    unitPriceSnapshot: quoteLine.unitPriceSnapshot,
    listPriceSnapshot: quoteLine.listPriceSnapshot,
    pricingSourceSnapshot: quoteLine.pricingSourceSnapshot,
    priceBookIdSnapshot: quoteLine.priceBookIdSnapshot,
    priceBookNameSnapshot: quoteLine.priceBookNameSnapshot,
    priceBookEntryIdSnapshot: quoteLine.priceBookEntryIdSnapshot,
    pricingAsOfDateSnapshot: quoteLine.pricingAsOfDateSnapshot,
    pricingBreakdownSnapshot: quoteLine.pricingBreakdownSnapshot || null,
    discountType: quoteLine.discountType,
    discountValue: quoteLine.discountValue,
    discountAmount: quoteLine.discountAmount,
    taxSnapshot: quoteLine.taxSnapshot || {},
    lineSubtotal: quoteLine.lineSubtotal,
    lineTaxTotal: quoteLine.lineTaxTotal,
    lineTotal: quoteLine.lineTotal,
    currencySnapshot: quoteLine.currencySnapshot,
    exchangeRateSnapshot: quoteLine.exchangeRateSnapshot,
    skuSnapshot: quoteLine.skuSnapshot,
    itemNameSnapshot: quoteLine.itemNameSnapshot,
    descriptionSnapshot: quoteLine.descriptionSnapshot,
    attributesSnapshot: quoteLine.attributesSnapshot || {},
    bundleSnapshot: quoteLine.bundleSnapshot || null,
    productConfigurationId: quoteLine.productConfigurationId || null,
    productConfigurationVersion: quoteLine.productConfigurationVersion ?? null,
    configurationSelections: quoteLine.configurationSelections || null,
    configurationSnapshot: quoteLine.configurationSnapshot || null,
    optionalLine: quoteLine.optionalLine === true,
    hiddenLine: quoteLine.hiddenLine === true,
    sourceQuoteLineId: String(quoteLine.quoteLineId),
    sourceQuoteSectionId: resolveSourceQuoteSectionPublicId(quoteLine, quoteSections),
    sourceQuoteId: salesOrder.sourceQuoteId,
    sourceRevisionNumber: revisionNumber,
    quoteConversionLinkId,
    lockedSnapshot: true
  };
}

function mapQuoteSectionToSalesOrderSection({
  quoteSection,
  salesOrder,
  sectionAcceptanceType,
  revisionNumber
}) {
  const isFull = sectionAcceptanceType === 'full';
  return {
    organizationId: salesOrder.organizationId,
    salesOrderId: salesOrder._id,
    sectionTitle: quoteSection?.sectionTitle || DEFAULT_SECTION_TITLE,
    sectionDescription: quoteSection?.sectionDescription ?? null,
    sectionOrder: Number(quoteSection?.sectionOrder) || 0,
    sectionType: quoteSection?.sectionType || 'standard',
    includeInOrderTotal: quoteSection?.includeInQuoteTotal !== false,
    sectionDiscountType: isFull ? quoteSection?.sectionDiscountType ?? null : null,
    sectionDiscountValue: isFull ? Number(quoteSection?.sectionDiscountValue) || 0 : 0,
    sectionDiscountAmount: isFull ? Number(quoteSection?.sectionDiscountAmount) || 0 : 0,
    showSectionTotal: quoteSection?.showSectionTotal !== false,
    hiddenSection: quoteSection?.hiddenSection === true,
    lockedSnapshot: true,
    sectionAcceptanceType,
    sourceQuoteSectionId: quoteSection?.quoteSectionId
      ? String(quoteSection.quoteSectionId)
      : quoteSection?._id
        ? String(quoteSection._id)
        : null,
    sourceQuoteId: salesOrder.sourceQuoteId,
    sourceRevisionNumber: revisionNumber
  };
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {import('mongoose').Types.ObjectId|string} params.quoteId
 * @param {import('mongoose').Types.ObjectId|string|null} params.userId
 * @param {object} [params.body]
 * @param {boolean} [params.overrideExpired]
 */
async function convertQuoteToSalesOrder({
  organizationId,
  quoteId,
  userId,
  body = {},
  overrideExpired = false
}) {
  const quote = await Quote.findOne({ _id: quoteId, organizationId, deletedAt: null });
  if (!quote) {
    const err = new Error('Quote not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const fromStatus = String(quote.status || '');
  const eligibility = assertCanConvertQuote(quote, { overrideExpired });

  const sections = await listQuoteSections({ organizationId, quoteId: quote._id });
  const lines = await QuoteLine.find({ organizationId, quoteId: quote._id }).lean();

  const acceptedLineIds = resolveAcceptedLineIds(quote, lines);
  if (!acceptedLineIds.length) {
    const err = new Error('Quote has no accepted lines to convert.');
    err.code = 'NOTHING_TO_CONVERT';
    throw err;
  }

  const convertedLineIds = await getConvertedLineIdsForQuote({ organizationId, quoteId: quote._id });
  const requestedLineIds = Array.isArray(body.lineIds) ? body.lineIds : null;
  const parentLineIdsToConvert = resolveParentLineIdsToConvert({
    acceptedLineIds,
    convertedLineIds,
    requestedLineIds
  });

  const linesToConvert = linesForSelection(lines, parentLineIdsToConvert);
  if (!linesToConvert.length) {
    const err = new Error('No quote lines resolved for conversion.');
    err.code = 'NOTHING_TO_CONVERT';
    throw err;
  }

  let conversionType = String(body.conversionType || resolveConversionTypeForQuote(quote));
  if (parentLineIdsToConvert.length < acceptedLineIds.filter((id) => !convertedLineIds.includes(String(id))).length) {
    conversionType = 'partial';
  }

  const revisionNumber = Number(quote.revisionNumber) || 1;
  const fulfillmentMode = assertValidFulfillmentMode(
    body.fulfillmentMode || SALES_ORDER_FULFILLMENT_MODE_DEFAULT
  );
  const headerSnapshots = extractQuoteHeaderSnapshots(quote);

  const salesOrder = await SalesOrder.create({
    organizationId,
    orderTitle: quote.quoteTitle ?? null,
    orderDate: new Date(),
    status: SALES_ORDER_STATUS_ON_QUOTE_CONVERT,
    fulfillmentMode,
    currency: quote.currency || 'USD',
    exchangeRateSnapshot: Number(quote.exchangeRateSnapshot) || 1,
    globalDiscountType: quote.globalDiscountType ?? null,
    globalDiscountValue: Number(quote.globalDiscountValue) || 0,
    globalDiscountAmount: Number(quote.globalDiscountAmount) || 0,
    assignedTo: quote.assignedTo ?? userId ?? null,
    customerId: quote.customerId ?? null,
    organizationRefId: quote.organizationRefId ?? null,
    contactId: quote.contactId ?? null,
    dealId: quote.dealId ?? null,
    caseId: quote.caseId ?? null,
    ...headerSnapshots,
    sourceType: 'quote',
    sourceQuoteId: quote._id,
    sourceQuoteNumber: quote.quoteNumber,
    sourceRevisionNumber: revisionNumber,
    conversionType,
    lineageType: 'standalone',
    createdBy: userId ?? null,
    modifiedBy: userId ?? null
  });

  const sectionPlans = buildSectionConversionPlans(
    sections,
    lines,
    linesToConvert,
    acceptedLineIds
  );

  const sectionMongoByQuoteSection = new Map();
  let generalSectionMongoId = null;

  for (const plan of sectionPlans) {
    if (plan.isGeneral) {
      const general = await ensureDefaultSection({
        organizationId,
        salesOrderId: salesOrder._id,
        lockedSnapshot: true
      });
      generalSectionMongoId = general._id;
      continue;
    }

    const soSection = await SalesOrderSection.create(
      mapQuoteSectionToSalesOrderSection({
        quoteSection: plan.quoteSection,
        salesOrder,
        sectionAcceptanceType: plan.sectionAcceptanceType,
        revisionNumber
      })
    );
    sectionMongoByQuoteSection.set(String(plan.quoteSectionMongoId), soSection._id);
  }

  if (!generalSectionMongoId && sectionPlans.some((plan) => plan.isGeneral)) {
    const general = await ensureDefaultSection({
      organizationId,
      salesOrderId: salesOrder._id,
      lockedSnapshot: true
    });
    generalSectionMongoId = general._id;
  }

  const linkMetadataBase = buildConversionMetadata(quote, body, { sections, lines });

  const lineIdMap = new Map();
  const parentLines = linesToConvert
    .filter((line) => String(line.lineType || '') !== 'bundle_component')
    .sort((a, b) => (Number(a.lineOrder) || 0) - (Number(b.lineOrder) || 0));
  const childLines = linesToConvert.filter(
    (line) => String(line.lineType || '') === 'bundle_component'
  );

  try {
    for (const quoteLine of parentLines) {
      const secKey = quoteLine.quoteSectionId ? String(quoteLine.quoteSectionId) : null;
      const sectionMongoId = secKey
        ? sectionMongoByQuoteSection.get(secKey) || generalSectionMongoId
        : generalSectionMongoId;

      const soLine = await SalesOrderLine.create(
        mapQuoteLineToSalesOrderLine({
          quoteLine,
          salesOrder,
          salesOrderSectionMongoId: sectionMongoId,
          quoteConversionLinkId: null,
          revisionNumber,
          quoteSections: sections
        })
      );
      lineIdMap.set(String(quoteLine.quoteLineId), soLine);
    }

    for (const quoteLine of childLines) {
      const parentQuoteLine = lines.find(
        (line) => String(line._id) === String(quoteLine.parentBundleLineId)
      );
      const parentSoLine = parentQuoteLine
        ? lineIdMap.get(String(parentQuoteLine.quoteLineId))
        : null;

      const secKey = parentQuoteLine?.quoteSectionId
        ? String(parentQuoteLine.quoteSectionId)
        : quoteLine.quoteSectionId
          ? String(quoteLine.quoteSectionId)
          : null;
      const sectionMongoId = secKey
        ? sectionMongoByQuoteSection.get(secKey) || generalSectionMongoId
        : generalSectionMongoId;

      await SalesOrderLine.create(
        mapQuoteLineToSalesOrderLine({
          quoteLine,
          salesOrder,
          salesOrderSectionMongoId: sectionMongoId,
          quoteConversionLinkId: null,
          revisionNumber,
          parentBundleLineMongoId: parentSoLine?._id ?? null,
          quoteSections: sections
        })
      );
    }
  } catch (err) {
    if (err?.code === 11000) {
      const dupErr = new Error('One or more quote lines are already converted to a sales order.');
      dupErr.code = 'LINES_ALREADY_CONVERTED';
      dupErr.details = { quoteId: String(quote._id) };
      await SalesOrder.deleteOne({ _id: salesOrder._id, organizationId });
      throw dupErr;
    }
    await SalesOrder.deleteOne({ _id: salesOrder._id, organizationId });
    throw err;
  }

  await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: salesOrder._id
  });

  const refreshedOrder = await SalesOrder.findOne({ _id: salesOrder._id, organizationId }).lean();

  const linkMetadata = {
    ...linkMetadataBase,
    salesOrderId: refreshedOrder.salesOrderId,
    salesOrderMongoId: String(refreshedOrder._id),
    salesOrderNumber: refreshedOrder.salesOrderNumber,
    linesOnThisOrder: parentLineIdsToConvert
  };

  const targetExternalRef = body?.targetExternalRef ?? body?.externalRef ?? null;

  const link = await QuoteConversionLink.create({
    organizationId,
    quoteId: quote._id,
    quoteNumber: quote.quoteNumber,
    revisionNumber,
    conversionType,
    targetModuleKey: String(body?.targetModuleKey || 'sales_orders'),
    targetRecordId: refreshedOrder.salesOrderId,
    targetExternalRef: targetExternalRef ? String(targetExternalRef).trim().slice(0, 200) : null,
    status: 'linked',
    createdBy: userId ?? null,
    metadata: {
      ...linkMetadata,
      ...(body?.metadata && typeof body.metadata === 'object' ? body.metadata : {})
    }
  });

  await SalesOrder.updateOne(
    { _id: salesOrder._id, organizationId },
    { quoteConversionLinkId: link._id }
  );

  await SalesOrderLine.updateMany(
    { organizationId, salesOrderId: salesOrder._id },
    { quoteConversionLinkId: link._id }
  );

  const allConvertedLineIds = await getConvertedLineIdsForQuote({
    organizationId,
    quoteId: quote._id
  });
  const resolution = resolveQuoteConversionCoverage({
    quote: quote.toObject(),
    convertedLineIds: allConvertedLineIds
  });

  const toStatus = resolveQuoteStatusAfterConversion(fromStatus, resolution);
  if (!toStatus) {
    const err = new Error('Unable to resolve quote status after conversion.');
    err.code = 'CONVERSION_STATUS_ERROR';
    throw err;
  }

  assertQuoteConversionStatusTransition(fromStatus, toStatus);
  quote.status = toStatus;
  quote.converted = resolution.coverage === 'full';
  quote.conversionStatus = toStatus;
  await quote.save();

  const quoteActivityAction =
    resolution.coverage === 'full' ? 'quote_converted' : 'quote_partially_converted';
  const quoteActivityMessage =
    resolution.coverage === 'full'
      ? 'Quote converted to sales order'
      : 'Quote partially converted to sales order';

  await writeQuoteActivity({
    organizationId,
    quoteId: quote._id,
    userId,
    action: quoteActivityAction,
    message: quoteActivityMessage,
    details: {
      fromStatus,
      toStatus,
      conversionType: link.conversionType,
      salesOrderId: refreshedOrder.salesOrderId,
      salesOrderNumber: refreshedOrder.salesOrderNumber,
      quoteConversionLinkId: String(link._id),
      linesOnThisOrder: parentLineIdsToConvert,
      coverage: resolution.coverage,
      unmappedLineIds: resolution.unmappedLineIds,
      ...(eligibility?.usedExpiredOverride ? { usedExpiredOverride: true } : {})
    }
  });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: salesOrder._id,
    userId,
    action: 'sales_order_created',
    message: 'Sales order created from quote',
    details: {
      sourceType: 'quote',
      quoteId: String(quote._id),
      quoteNumber: quote.quoteNumber,
      revisionNumber,
      quoteConversionLinkId: String(link._id),
      salesOrderId: refreshedOrder.salesOrderId,
      salesOrderNumber: refreshedOrder.salesOrderNumber
    }
  });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: salesOrder._id,
    userId,
    action: 'sales_order_converted_from_quote',
    message: 'Converted from quote',
    details: {
      quoteId: String(quote._id),
      quoteNumber: quote.quoteNumber,
      quoteConversionLinkId: String(link._id),
      conversionType: link.conversionType,
      linesOnThisOrder: parentLineIdsToConvert
    }
  });

  return {
    quote,
    salesOrder: refreshedOrder,
    link,
    resolution,
    eligibility
  };
}

module.exports = {
  resolveAcceptedLineIds,
  resolveParentLineIdsToConvert,
  buildSectionConversionPlans,
  convertQuoteToSalesOrder
};

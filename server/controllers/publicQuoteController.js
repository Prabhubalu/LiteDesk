const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteDocument = require('../models/QuoteDocument');
const { writeQuoteActivity } = require('../services/quoteActivityService');
const { assertCanTransitionQuoteStatus, isDraftCustomerShare } = require('../constants/quoteLifecycle');
const { renderQuotePdf } = require('./quoteDocumentController');
const { listQuoteSections } = require('../services/quoteSectionService');
const {
  getSelectableLines,
  resolveCustomerAcceptance,
  applyCustomerAcceptanceToQuote,
  applyCustomerRejectionToQuote
} = require('../services/quotePublicAcceptanceService');
const {
  getQuoteOrgSettings,
  getPortalCustomerAgreementText,
  assertCustomerAgreementAccepted,
  assertTypedSignatureProvided,
  normalizeSignatureText
} = require('../services/quoteOrgSettingsService');
const {
  listPortalComments,
  createCustomerPortalComment
} = require('../services/quotePortalCommentService');
const {
  expireQuoteIfDue,
  assertQuoteOpenForCustomerAction,
  isQuoteValidityExpired
} = require('../services/quoteExpiryService');
const { getQuoteBranding } = require('../services/quoteBrandingService');
const { guardQuoteAcceptance } = require('../services/inventoryAtpGuardService');

async function resolveQuoteByToken(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  return Quote.findOne({ publicShareToken: t })
    .populate({ path: 'ownerId', select: 'firstName lastName email username' })
    .populate({ path: 'organizationRefId', select: 'name' })
    .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })
    .lean();
}

async function resolveQuoteDocByToken(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  return Quote.findOne({ publicShareToken: t })
    .populate({ path: 'ownerId', select: 'firstName lastName email username' })
    .populate({ path: 'organizationRefId', select: 'name' })
    .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' });
}

async function logPublicEvent({ req, quote, token, action, message, details = {} }) {
  try {
    await writeQuoteActivity({
      organizationId: quote.organizationId,
      quoteId: quote._id,
      userId: null,
      action,
      message,
      details: {
        tokenSuffix: String(token || '').slice(-6),
        userAgent: req.headers['user-agent'] || null,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
        ...details
      }
    });
  } catch {
    /* ignore */
  }
}

exports.view = async (req, res) => {
  try {
    const token = req.params.token;
    // Fetch a doc first so we can update status on first view (Sent -> Viewed)
    const quoteDoc = await resolveQuoteDocByToken(token);
    const quote = quoteDoc ? quoteDoc.toObject() : null;
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote link not found', code: 'NOT_FOUND' });
    }

    const draftPreview = isDraftCustomerShare(quoteDoc);

    await expireQuoteIfDue(quoteDoc, { trigger: 'public_view' });
    quote.status = quoteDoc.status;

    // Best-effort: mark as viewed on first public render (Sent -> Viewed); not for draft previews
    try {
      if (!draftPreview && String(quoteDoc.status) === 'Sent') {
        assertCanTransitionQuoteStatus('Sent', 'Viewed');
        quoteDoc.status = 'Viewed';
        await quoteDoc.save();
        quote.status = 'Viewed';
      }
    } catch {
      /* ignore */
    }

    const rawLines = await QuoteLine.find({ organizationId: quote.organizationId, quoteId: quote._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

    const allSections = await listQuoteSections({
      organizationId: quote.organizationId,
      quoteId: quote._id
    });
    const hiddenSectionIds = new Set(
      (allSections || []).filter((s) => s?.hiddenSection === true).map((s) => String(s._id))
    );
    const sections = (allSections || [])
      .filter((s) => s && s.hiddenSection !== true)
      .map((s) => ({
        _id: s._id,
        quoteSectionId: s.quoteSectionId,
        sectionTitle: s.sectionTitle,
        sectionType: s.sectionType || 'standard',
        sectionOrder: s.sectionOrder,
        showSectionTotal: s.showSectionTotal !== false,
        sectionSubtotal: s.sectionSubtotal,
        sectionDiscountTotal: s.sectionDiscountTotal,
        sectionTotal: s.sectionTotal,
        includeInQuoteTotal: s.includeInQuoteTotal === true
      }));

    const lines = (rawLines || []).filter(
      (l) => l && l.hiddenLine !== true && !hiddenSectionIds.has(String(l.quoteSectionId || ''))
    );

    const lineByMongoId = new Map((rawLines || []).map((l) => [String(l._id), l]));

    const orgQuoteSettings = await getQuoteOrgSettings(quote.organizationId);
    const customerAgreementText = getPortalCustomerAgreementText(orgQuoteSettings);

    await logPublicEvent({
      req,
      quote,
      token,
      action: 'quote_public_viewed',
      message: 'Quote viewed (public link)',
      details: { status: quote.status }
    });

    return res.json({
      success: true,
      data: {
        quote: {
          _id: quote._id,
          quoteNumber: quote.quoteNumber,
          revisionNumber: quote.revisionNumber,
          quoteTitle: quote.quoteTitle,
          quoteDate: quote.quoteDate,
          validUntil: quote.validUntil,
          status: quote.status,
          currency: quote.currency,
          subtotal: quote.subtotal,
          taxTotal: quote.taxTotal,
          grandTotal: quote.grandTotal,
          organization: quote.organizationRefId,
          contact: quote.contactId,
          customerShareMode: quote.customerShareMode || null,
          isDraftPreview: draftPreview
        },
        lines: (lines || []).filter((l) => l && l.hiddenLine !== true).map((l) => {
          const parentLine =
            l.parentBundleLineId != null ? lineByMongoId.get(String(l.parentBundleLineId)) : null;
          return {
          quoteLineId: l.quoteLineId,
          lineType: l.lineType,
          parentBundleLineId: l.parentBundleLineId ? String(l.parentBundleLineId) : null,
          parentQuoteLineId: parentLine?.quoteLineId || null,
          skuSnapshot: l.skuSnapshot,
          itemNameSnapshot: l.itemNameSnapshot,
          quantity: l.quantity,
          unitPriceSnapshot: l.unitPriceSnapshot,
          lineSubtotal: l.lineSubtotal,
          lineTaxTotal: l.lineTaxTotal,
          lineTotal: l.lineTotal,
          quoteSectionId: l.quoteSectionId ? String(l.quoteSectionId) : null,
          bundleOptional: !!(l.bundleSnapshot && l.bundleSnapshot.optional === true),
          selectable: l.lineType === 'standard' || l.lineType === 'bundle_parent'
        };
        }),
        sections,
        portal: {
          canRespond:
            !draftPreview &&
            !isQuoteValidityExpired(quote) &&
            ['Sent', 'Viewed'].includes(String(quote.status || '')),
          isExpired: String(quote.status || '') === 'Expired' || isQuoteValidityExpired(quote),
          allowPartialAccept: !draftPreview && getSelectableLines(lines).length > 1,
          requireCustomerAgreement: !!customerAgreementText,
          customerAgreementText,
          requireTypedSignature: orgQuoteSettings.requireTypedSignature === true,
          commentsEnabled: !draftPreview,
          customerResponse: quote.customerResponse || null
        }
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to view quote', code: 'UNKNOWN' });
  }
};

exports.accept = async (req, res) => {
  try {
    const token = req.params.token;
    const quote = await resolveQuoteDocByToken(token);
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote link not found', code: 'NOT_FOUND' });
    }

    if (isDraftCustomerShare(quote)) {
      return res.status(400).json({
        success: false,
        message: 'This is a draft quote for review only. Acceptance is not available until a final quote is issued.',
        code: 'DRAFT_PREVIEW'
      });
    }

    await expireQuoteIfDue(quote, { trigger: 'public_accept' });
    try {
      assertQuoteOpenForCustomerAction(quote);
    } catch (e) {
      if (e?.code === 'QUOTE_EXPIRED') {
        return res.status(400).json({ success: false, message: e.message, code: 'QUOTE_EXPIRED' });
      }
      throw e;
    }

    const fromStatus = String(quote.status || '');
    if (!['Sent', 'Viewed'].includes(fromStatus)) {
      return res.status(400).json({
        success: false,
        message: `Quote cannot be accepted in status "${fromStatus}".`,
        code: 'INVALID_STATUS'
      });
    }

    const lines = await QuoteLine.find({ organizationId: quote.organizationId, quoteId: quote._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

    const orgQuoteSettings = await getQuoteOrgSettings(quote.organizationId);
    assertCustomerAgreementAccepted(orgQuoteSettings, req.body);
    const signatureText =
      assertTypedSignatureProvided(orgQuoteSettings, req.body) ||
      normalizeSignatureText(req.body) ||
      null;

    const lineIds = Array.isArray(req.body?.lineIds) ? req.body.lineIds : null;
    const sections = await listQuoteSections({
      organizationId: quote.organizationId,
      quoteId: quote._id
    });
    const resolution = resolveCustomerAcceptance(lines, lineIds, sections);

    const inventoryAtp = await guardQuoteAcceptance({
      organizationId: quote.organizationId,
      acceptedLines: resolution.acceptedLines
    });

    applyCustomerAcceptanceToQuote(quote, resolution, {
      comment: req.body?.comment ?? null,
      signerName: req.body?.signerName ?? null,
      signatureText,
      agreedToTerms: req.body?.agreedToTerms === true
    });
    await quote.save();

    const action =
      resolution.responseType === 'partial' ? 'quote_public_partially_accepted' : 'quote_public_accepted';
    const message =
      resolution.responseType === 'partial'
        ? 'Quote partially accepted (public link)'
        : 'Quote accepted (public link)';

    await logPublicEvent({
      req,
      quote,
      token,
      action,
      message,
      details: {
        fromStatus,
        toStatus: quote.status,
        acceptedLineIds: resolution.selectedIds,
        acceptedGrandTotal: resolution.acceptedGrandTotal
      }
    });

    return res.json({
      success: true,
      data: {
        quoteId: quote._id,
        status: quote.status,
        responseType: resolution.responseType,
        customerResponse: quote.customerResponse,
        inventoryAtp: inventoryAtp.acceptanceWarning ? inventoryAtp : undefined
      }
    });
  } catch (e) {
    const code = e?.code;
    const status =
      code === 'INSUFFICIENT_ATP'
        ? 409
        : code === 'INVALID_TRANSITION' ||
            code === 'VALIDATION' ||
            code === 'INVALID_LINE_SELECTION' ||
            code === 'EMPTY_LINE_SELECTION' ||
            code === 'NO_SELECTABLE_LINES' ||
            code === 'TERMS_REQUIRED' ||
            code === 'QUOTE_EXPIRED' ||
            code === 'SIGNATURE_REQUIRED'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: e.message || 'Failed to accept quote',
      code: code || 'UNKNOWN',
      canProceed: e.canProceed === true,
      policy: e.policy || e.details?.policy || null,
      details: e.details || null
    });
  }
};

exports.reject = async (req, res) => {
  try {
    const token = req.params.token;
    const quote = await resolveQuoteDocByToken(token);
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote link not found', code: 'NOT_FOUND' });
    }

    if (isDraftCustomerShare(quote)) {
      return res.status(400).json({
        success: false,
        message: 'This is a draft quote for review only. Rejection is not available until a final quote is issued.',
        code: 'DRAFT_PREVIEW'
      });
    }

    await expireQuoteIfDue(quote, { trigger: 'public_reject' });
    try {
      assertQuoteOpenForCustomerAction(quote);
    } catch (e) {
      if (e?.code === 'QUOTE_EXPIRED') {
        return res.status(400).json({ success: false, message: e.message, code: 'QUOTE_EXPIRED' });
      }
      throw e;
    }

    const fromStatus = String(quote.status || '');
    if (!['Sent', 'Viewed'].includes(fromStatus)) {
      return res.status(400).json({
        success: false,
        message: `Quote cannot be rejected in status "${fromStatus}".`,
        code: 'INVALID_STATUS'
      });
    }

    applyCustomerRejectionToQuote(quote, {
      comment: req.body?.comment ?? null,
      signerName: req.body?.signerName ?? null
    });
    await quote.save();

    await logPublicEvent({
      req,
      quote,
      token,
      action: 'quote_public_rejected',
      message: 'Quote rejected (public link)',
      details: { fromStatus, toStatus: quote.status, comment: req.body?.comment ?? null }
    });

    return res.json({ success: true, data: { quoteId: quote._id, status: quote.status } });
  } catch (e) {
    const code = e?.code;
    const status =
      code === 'INVALID_TRANSITION' || code === 'VALIDATION' || code === 'QUOTE_EXPIRED' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || 'Failed to reject quote',
      code: code || 'UNKNOWN',
      details: e.details || null
    });
  }
};

exports.listComments = async (req, res) => {
  try {
    const token = req.params.token;
    const quote = await resolveQuoteByToken(token);
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote link not found', code: 'NOT_FOUND' });
    }
    if (isDraftCustomerShare(quote)) {
      return res.json({ success: true, data: [] });
    }

    const comments = await listPortalComments(quote.organizationId, quote._id);
    return res.json({ success: true, data: comments });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message || 'Failed to load comments',
      code: 'UNKNOWN'
    });
  }
};

exports.postComment = async (req, res) => {
  try {
    const token = req.params.token;
    const quote = await resolveQuoteDocByToken(token);
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote link not found', code: 'NOT_FOUND' });
    }

    if (isDraftCustomerShare(quote)) {
      return res.status(400).json({
        success: false,
        message: 'Comments are not available on draft preview links.',
        code: 'DRAFT_PREVIEW'
      });
    }

    await expireQuoteIfDue(quote, { trigger: 'public_comment' });

    const comment = await createCustomerPortalComment({
      quote,
      content: req.body?.content ?? req.body?.message ?? '',
      signerName: req.body?.signerName ?? null
    });

    await logPublicEvent({
      req,
      quote: quote.toObject(),
      token,
      action: 'quote_public_comment',
      message: 'Customer posted a comment (public link)',
      details: { commentId: comment.id }
    });

    return res.status(201).json({ success: true, data: comment });
  } catch (e) {
    const code = e?.code;
    const status = code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || 'Failed to post comment',
      code: code || 'UNKNOWN'
    });
  }
};

exports.latestPdf = async (req, res) => {
  try {
    const token = req.params.token;
    const quote = await resolveQuoteByToken(token);
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote link not found', code: 'NOT_FOUND' });
    }

    if (isDraftCustomerShare(quote)) {
      const lines = await QuoteLine.find({ organizationId: quote.organizationId, quoteId: quote._id })
        .sort({ lineOrder: 1, createdAt: 1 })
        .lean();
      const sections = await listQuoteSections({
        organizationId: quote.organizationId,
        quoteId: quote._id
      });
      const branding = await getQuoteBranding(quote.organizationId);
      const pdf = await renderQuotePdf({ quote, lines, sections, watermark: 'DRAFT', branding });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="draft-${String(quote.quoteNumber || 'quote')}.pdf"`
      );
      return res.send(pdf);
    }

    const latest = await QuoteDocument.find({ organizationId: quote.organizationId, quoteId: quote._id })
      .sort({ revisionNumber: -1, versionNumber: -1, generatedAt: -1 })
      .limit(1)
      .lean();

    const doc = latest?.[0];
    if (!doc?.filePath) {
      return res.status(404).json({ success: false, message: 'No document generated yet', code: 'NOT_FOUND' });
    }

    return res.redirect(302, doc.filePath);
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch PDF', code: 'UNKNOWN' });
  }
};


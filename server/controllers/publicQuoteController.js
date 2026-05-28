const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteDocument = require('../models/QuoteDocument');
const { writeQuoteActivity } = require('../services/quoteActivityService');
const { assertCanTransitionQuoteStatus } = require('../constants/quoteLifecycle');

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

    // Best-effort: mark as viewed on first public render (Sent -> Viewed)
    try {
      if (String(quoteDoc.status) === 'Sent') {
        assertCanTransitionQuoteStatus('Sent', 'Viewed');
        quoteDoc.status = 'Viewed';
        await quoteDoc.save();
        quote.status = 'Viewed';
      }
    } catch {
      /* ignore */
    }

    const lines = await QuoteLine.find({ organizationId: quote.organizationId, quoteId: quote._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

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
        },
        lines: (lines || []).filter((l) => l && l.hiddenLine !== true).map((l) => ({
          quoteLineId: l.quoteLineId,
          lineType: l.lineType,
          skuSnapshot: l.skuSnapshot,
          itemNameSnapshot: l.itemNameSnapshot,
          quantity: l.quantity,
          unitPriceSnapshot: l.unitPriceSnapshot,
          lineTotal: l.lineTotal,
          bundleOptional: !!(l.bundleSnapshot && l.bundleSnapshot.optional === true),
        }))
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

    const fromStatus = String(quote.status || '');
    const toStatus = 'Accepted';
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    quote.status = toStatus;
    await quote.save();

    await logPublicEvent({
      req,
      quote,
      token,
      action: 'quote_public_accepted',
      message: 'Quote accepted (public link)',
      details: { fromStatus, toStatus }
    });

    return res.json({ success: true, data: { quoteId: quote._id, status: quote.status } });
  } catch (e) {
    const code = e?.code;
    const status = code === 'INVALID_TRANSITION' || code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || 'Failed to accept quote',
      code: code || 'UNKNOWN',
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

    const fromStatus = String(quote.status || '');
    const toStatus = 'Rejected';
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    quote.status = toStatus;
    await quote.save();

    await logPublicEvent({
      req,
      quote,
      token,
      action: 'quote_public_rejected',
      message: 'Quote rejected (public link)',
      details: { fromStatus, toStatus, comment: req.body?.comment ?? null }
    });

    return res.json({ success: true, data: { quoteId: quote._id, status: quote.status } });
  } catch (e) {
    const code = e?.code;
    const status = code === 'INVALID_TRANSITION' || code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || 'Failed to reject quote',
      code: code || 'UNKNOWN',
      details: e.details || null
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

    const latest = await QuoteDocument.find({ organizationId: quote.organizationId, quoteId: quote._id })
      .sort({ revisionNumber: -1, versionNumber: -1, generatedAt: -1 })
      .limit(1)
      .lean();

    const doc = latest?.[0];
    if (!doc?.filePath) {
      return res.status(404).json({ success: false, message: 'No document generated yet', code: 'NOT_FOUND' });
    }

    // Redirect to static file served from /public
    return res.redirect(302, doc.filePath);
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch PDF', code: 'UNKNOWN' });
  }
};


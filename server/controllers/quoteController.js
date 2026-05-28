const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteApproval = require('../models/QuoteApproval');
const QuoteConversionLink = require('../models/QuoteConversionLink');
const { assertValidStatus, assertCanTransitionQuoteStatus } = require('../constants/quoteLifecycle');
const { isCommerciallyLockedStatus } = require('../constants/quoteLifecycle');
const quoteTotalsService = require('../services/quoteTotalsService');
const { writeQuoteActivity } = require('../services/quoteActivityService');
const crypto = require('node:crypto');

function normalizeNumber(value, { defaultValue = 0 } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

async function createQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const ownerId = req.body?.ownerId ?? req.user._id;

    const status = req.body?.status ?? undefined;
    if (status !== undefined) assertValidStatus(status);

    const quote = await Quote.create({
      organizationId,
      ownerId,
      quoteTitle: req.body?.quoteTitle ?? null,
      quoteDate: req.body?.quoteDate ?? new Date(),
      validUntil: req.body?.validUntil ?? null,
      status: status ?? undefined,
      currency: req.body?.currency ?? 'USD',
      exchangeRateSnapshot: normalizeNumber(req.body?.exchangeRateSnapshot, { defaultValue: 1 }),

      // Optional links + metadata
      customerId: req.body?.customerId ?? null,
      organizationRefId: req.body?.organizationRefId ?? null,
      contactId: req.body?.contactId ?? null,
      dealId: req.body?.dealId ?? null,
      caseId: req.body?.caseId ?? null,
      customRecordId: req.body?.customRecordId ?? null,
      sourceContext: req.body?.sourceContext ?? 'manual',
      sourceRef: req.body?.sourceRef ?? null,

      customFields: req.body?.customFields ?? {}
    });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_created',
      message: 'Quote created',
      details: { quoteNumber: quote.quoteNumber }
    });

    return res.status(201).json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to create quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

async function getQuotes(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const status = req.query?.status;
    const ownerId = req.query?.ownerId;

    const q = { organizationId, deletedAt: null };
    if (status) {
      assertValidStatus(status);
      q.status = status;
    }
    if (ownerId) q.ownerId = ownerId;

    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 50));
    const page = Math.max(1, Number(req.query?.page) || 1);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      Quote.find(q).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Quote.countDocuments(q)
    ]);

    return res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total }
    });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to fetch quotes',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

async function getQuoteById(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId, deletedAt: null })
      .populate({ path: 'ownerId', select: 'firstName lastName email username' })
      .populate({ path: 'organizationRefId', select: 'name' })
      .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })
      .populate({ path: 'dealId', select: 'name stage pipeline amount value currency' })
      .populate({ path: 'caseId', select: 'caseId title status priority' })
      .lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const lines = await QuoteLine.find({ organizationId, quoteId: quote._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

    return res.json({ success: true, data: { ...quote, lines } });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch quote',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function transitionQuoteStatus(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const toStatus = req.body?.status;
    assertValidStatus(toStatus);

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const fromStatus = quote.status;
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    quote.status = toStatus;
    await quote.save();

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_status_changed',
      message: `Status changed: ${fromStatus} → ${toStatus}`,
      details: { fromStatus, toStatus }
    });

    return res.json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to transition quote status',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

async function updateQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    if (quote.approvalLocked === true) {
      return res.status(400).json({
        success: false,
        message: 'Quote is approval-locked. Approve/reject before editing.',
        code: 'APPROVAL_LOCKED'
      });
    }

    // Status updates from the generic record page currently use PUT /quotes/:id.
    // When status is present, enforce transitions (same as PATCH /:id/status).
    const nextStatus = req.body?.status;
    const fromStatus = quote.status;
    let statusChanged = false;
    if (nextStatus !== undefined && nextStatus !== null && String(nextStatus).trim() !== '') {
      assertValidStatus(nextStatus);
      if (String(nextStatus) !== String(fromStatus)) {
        assertCanTransitionQuoteStatus(fromStatus, nextStatus);
        quote.status = nextStatus;
        statusChanged = true;
      }
    }

    const editable = [
      'quoteTitle',
      'quoteDate',
      'validUntil',
      'currency',
      'exchangeRateSnapshot',
      'ownerId',
      'customerId',
      'organizationRefId',
      'contactId',
      'dealId',
      'caseId',
      'customRecordId',
      'sourceContext',
      'sourceRef',
      'customFields'
    ];
    for (const key of editable) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        quote[key] = req.body[key];
      }
    }

    await quote.save();

    if (statusChanged) {
      await writeQuoteActivity({
        organizationId,
        quoteId: quote._id,
        userId: req.user._id,
        action: 'quote_status_changed',
        message: `Status changed: ${fromStatus} → ${quote.status}`,
        details: { fromStatus, toStatus: quote.status }
      });
    } else {
      await writeQuoteActivity({
        organizationId,
        quoteId: quote._id,
        userId: req.user._id,
        action: 'quote_updated',
        message: 'Quote updated',
        details: { keys: Object.keys(req.body || {}) }
      });
    }

    return res.json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

function userCanActOnApprovals(req) {
  if (req.user?.isOwner) return true;
  const role = String(req.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin';
}

async function appendQuoteApprovalEvent({ organizationId, quote, userId, action, fromStatus, toStatus, comment = null, metadata = {} }) {
  try {
    await QuoteApproval.create({
      organizationId,
      quoteId: quote._id,
      revisionNumber: Number(quote.revisionNumber) || 1,
      action,
      fromStatus: fromStatus ?? null,
      toStatus: toStatus ?? null,
      actorUserId: userId,
      comment,
      metadata: metadata || {}
    });
  } catch (e) {
    // Approval history is best-effort; do not block business flow on audit insert failures.
    console.warn('[quotes] failed to write QuoteApproval:', e?.message || e);
  }
}

/**
 * POST /api/quotes/:id/submit-for-approval
 * Body: { comment? }
 */
async function submitQuoteForApproval(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const fromStatus = quote.status;
    if (String(fromStatus) !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Only Draft quotes can be submitted for approval.',
        code: 'APPROVAL_SUBMIT_INVALID_STATUS',
        details: { fromStatus }
      });
    }
    const toStatus = 'Pending Approval';
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    quote.status = toStatus;
    quote.approvalRequired = true;
    quote.approvalStatus = 'Pending';
    quote.approvalLocked = true;
    await quote.save();

    await appendQuoteApprovalEvent({
      organizationId,
      quote,
      userId: req.user._id,
      action: 'submit',
      fromStatus,
      toStatus,
      comment: req.body?.comment ?? null
    });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_submitted_for_approval',
      message: 'Submitted for approval',
      details: { fromStatus, toStatus }
    });

    return res.json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to submit for approval',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * POST /api/quotes/:id/approve
 * Body: { comment? }
 */
async function approveQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    if (!userCanActOnApprovals(req)) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve', code: 'FORBIDDEN' });
    }

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const fromStatus = quote.status;
    if (String(fromStatus) !== 'Pending Approval') {
      return res.status(400).json({
        success: false,
        message: 'Only Pending Approval quotes can be approved.',
        code: 'APPROVAL_DECISION_INVALID_STATUS',
        details: { fromStatus }
      });
    }
    const toStatus = 'Approved';
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    quote.status = toStatus;
    quote.approvalStatus = 'Approved';
    quote.approvalLocked = false;
    await quote.save();

    await appendQuoteApprovalEvent({
      organizationId,
      quote,
      userId: req.user._id,
      action: 'approve',
      fromStatus,
      toStatus,
      comment: req.body?.comment ?? null
    });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_approved',
      message: 'Quote approved',
      details: { fromStatus, toStatus }
    });

    return res.json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to approve quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * POST /api/quotes/:id/reject
 * Body: { comment? }
 */
async function rejectQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    if (!userCanActOnApprovals(req)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject', code: 'FORBIDDEN' });
    }

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const fromStatus = quote.status;
    if (String(fromStatus) !== 'Pending Approval') {
      return res.status(400).json({
        success: false,
        message: 'Only Pending Approval quotes can be rejected.',
        code: 'APPROVAL_DECISION_INVALID_STATUS',
        details: { fromStatus }
      });
    }
    const toStatus = 'Rejected';
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    quote.status = toStatus;
    quote.approvalStatus = 'Rejected';
    quote.approvalLocked = false;
    await quote.save();

    await appendQuoteApprovalEvent({
      organizationId,
      quote,
      userId: req.user._id,
      action: 'reject',
      fromStatus,
      toStatus,
      comment: req.body?.comment ?? null
    });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_rejected',
      message: 'Quote rejected',
      details: { fromStatus, toStatus }
    });

    return res.json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to reject quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

function generatePublicToken() {
  // URL-safe token, 32 bytes -> 43ish chars base64url
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * POST /api/quotes/:id/share
 * Body: { rotateToken?: boolean }
 *
 * Generates/rotates the publicShareToken and marks quote as sent.
 */
async function shareQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    // Ensure status is Sent or later when sharing; transition through lifecycle validator.
    const fromStatus = quote.status;
    if (String(fromStatus) !== 'Sent') {
      assertCanTransitionQuoteStatus(fromStatus, 'Sent');
      quote.status = 'Sent';
    }

    const rotate = req.body?.rotateToken === true || !quote.publicShareToken;
    if (rotate) {
      quote.publicShareToken = generatePublicToken();
    }
    quote.sentToCustomer = true;
    if (!quote.sentAt) quote.sentAt = new Date();
    quote.portalAccessEnabled = true;

    await quote.save();

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: rotate ? 'quote_share_token_rotated' : 'quote_shared',
      message: rotate ? 'Public share link generated' : 'Public share link reused',
      details: { status: quote.status }
    });

    return res.json({
      success: true,
      data: {
        quoteId: quote._id,
        status: quote.status,
        publicShareToken: quote.publicShareToken
      }
    });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to share quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * POST /api/quotes/:id/share/revoke
 *
 * Revokes the public link (rotates token to null).
 */
async function revokeQuoteShare(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    quote.publicShareToken = null;
    quote.portalAccessEnabled = false;
    await quote.save();

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_share_revoked',
      message: 'Public share link revoked',
      details: {}
    });

    return res.json({ success: true, data: { quoteId: quote._id, publicShareToken: null } });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to revoke share',
      code: err?.code || 'UNKNOWN'
    });
  }
}

/**
 * POST /api/quotes/:id/convert
 *
 * Q8 stub: creates a QuoteConversionLink and marks quote Converted.
 * Does NOT create Sales Orders / Invoices (future modules own their records).
 */
async function convertQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const fromStatus = String(quote.status || '');
    const toStatus = 'Converted';
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    const existing = await QuoteConversionLink.findOne({
      organizationId,
      quoteId: quote._id,
      revisionNumber: Number(quote.revisionNumber) || 1
    })
      .select('_id')
      .lean();

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Quote is already converted.',
        code: 'ALREADY_CONVERTED',
        details: { quoteId: String(quote._id), revisionNumber: Number(quote.revisionNumber) || 1 }
      });
    }

    const link = await QuoteConversionLink.create({
      organizationId,
      quoteId: quote._id,
      quoteNumber: quote.quoteNumber,
      revisionNumber: Number(quote.revisionNumber) || 1,
      conversionType: String(req.body?.conversionType || 'full'),
      targetModuleKey: String(req.body?.targetModuleKey || 'sales_orders'),
      targetRecordId: req.body?.targetRecordId ? String(req.body.targetRecordId) : null,
      targetExternalRef: req.body?.targetExternalRef ?? null,
      status: 'created',
      createdBy: req.user._id,
      metadata: req.body?.metadata ?? {}
    });

    quote.status = toStatus;
    quote.converted = true;
    quote.conversionStatus = 'Converted';
    await quote.save();

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_converted',
      message: 'Quote converted (stub)',
      details: {
        fromStatus,
        toStatus,
        conversionType: link.conversionType,
        targetModuleKey: link.targetModuleKey
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        quoteId: quote._id,
        status: quote.status,
        conversionLinkId: link._id
      }
    });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to convert quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * GET /api/quotes/:id/conversion
 *
 * Q8 stub: fetch conversion link (if any) for this quote revision.
 */
async function getQuoteConversion(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId })
      .select('_id quoteNumber revisionNumber status converted conversionStatus')
      .lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const revisionNumber = Number(quote.revisionNumber) || 1;
    const link = await QuoteConversionLink.findOne({ organizationId, quoteId: quote._id, revisionNumber })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: {
        quote: {
          quoteId: quote._id,
          quoteNumber: quote.quoteNumber,
          revisionNumber,
          status: quote.status,
          converted: quote.converted === true,
          conversionStatus: quote.conversionStatus
        },
        conversion: link || null
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch conversion',
      code: err?.code || 'UNKNOWN'
    });
  }
}

/**
 * DELETE /api/quotes/:id
 *
 * Soft delete (move to trash) via deletionService.
 */
async function deleteQuote(req, res) {
  try {
    const deletionService = require('../services/deletionService');
    const result = await deletionService.moveToTrash({
      moduleKey: 'quotes',
      recordId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      appKey: 'SALES',
      reason: req.body?.reason,
      cascadeConfirmed: !!req.body?.cascadeConfirmed
    });

    if (!result.ok) {
      if (result.blocked) {
        return res.status(400).json({
          success: false,
          blocked: true,
          dependencies: result.dependencies,
          message: result.message
        });
      }
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to delete quote'
      });
    }

    await writeQuoteActivity({
      organizationId: req.user.organizationId,
      quoteId: req.params.id,
      userId: req.user._id,
      action: 'quote_deleted',
      message: 'Quote moved to trash',
      details: { retentionExpiresAt: result.retentionExpiresAt }
    });

    return res.status(200).json({
      success: true,
      message: 'Quote moved to trash',
      retentionExpiresAt: result.retentionExpiresAt
    });
  } catch (error) {
    console.error('Delete quote error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting quote.',
      error: error.message
    });
  }
}

/**
 * POST /api/quotes/:id/recalculate
 *
 * Recomputes line totals + quote totals deterministically from snapshots.
 * Does NOT re-resolve catalog pricing.
 */
async function recalculateQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId }).lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const lines = await QuoteLine.find({ organizationId, quoteId }).lean();
    if (!lines.length) {
      await Quote.updateOne(
        { _id: quoteId, organizationId },
        { $set: { subtotal: 0, taxTotal: 0, grandTotal: 0 } }
      );
      return res.json({ success: true, data: { quoteId, totals: { subtotal: 0, taxTotal: 0, grandTotal: 0 }, updatedLines: 0 } });
    }

    const bulkOps = [];
    for (const l of lines) {
      const computed = quoteTotalsService.computeLineTotals(l);
      bulkOps.push({
        updateOne: {
          filter: { _id: l._id, organizationId },
          update: {
            $set: {
              lineSubtotal: computed.lineSubtotal,
              lineTaxTotal: computed.lineTaxTotal,
              lineTotal: computed.lineTotal
            }
          }
        }
      });
    }

    const bulk = await QuoteLine.bulkWrite(bulkOps, { ordered: false });

    const updatedLines = await QuoteLine.find({ organizationId, quoteId })
      .select('hiddenLine lineSubtotal lineTaxTotal lineTotal')
      .lean();

    const totals = quoteTotalsService.computeQuoteTotalsFromLines(updatedLines);

    await Quote.updateOne(
      { _id: quoteId, organizationId },
      { $set: { subtotal: totals.subtotal, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal } }
    );

    await writeQuoteActivity({
      organizationId,
      quoteId,
      userId: req.user._id,
      action: 'quote_recalculated',
      message: 'Totals recalculated',
      details: { totals, updatedLines: bulk.modifiedCount ?? updatedLines.length }
    });

    return res.json({
      success: true,
      data: {
        quoteId,
        totals,
        updatedLines: bulk.modifiedCount ?? updatedLines.length
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to recalculate quote',
      code: err?.code || 'UNKNOWN'
    });
  }
}

function assertCanReviseQuote(quote) {
  const status = String(quote?.status || '');
  if (isCommerciallyLockedStatus(status)) return;
  if (['Expired', 'Rejected', 'Cancelled'].includes(status)) return;
  const err = new Error('Revisions are intended for Sent/Accepted/Converted or terminal quotes.');
  err.code = 'REVISION_NOT_ALLOWED';
  err.details = { status };
  throw err;
}

/**
 * POST /api/quotes/:id/revise
 *
 * Clones the quote + its lines into a new Draft revision.
 * - Keeps `quoteNumber` the same
 * - Increments `revisionNumber`
 * - Deactivates the current active revision
 */
async function reviseQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    assertCanReviseQuote(quote);

    const rootId = quote.sourceQuoteId ?? quote._id;

    const max = await Quote.find({ organizationId, quoteNumber: quote.quoteNumber })
      .sort({ revisionNumber: -1 })
      .limit(1)
      .select('revisionNumber')
      .lean();
    const nextRevisionNumber = Math.max(1, Number(max?.[0]?.revisionNumber) || 1) + 1;

    // Deactivate current revision (and any other active revisions defensively).
    await Quote.updateMany(
      { organizationId, quoteNumber: quote.quoteNumber, activeRevision: true },
      { $set: { activeRevision: false } }
    );

    const next = await Quote.create({
      organizationId,
      quoteNumber: quote.quoteNumber,
      revisionNumber: nextRevisionNumber,
      activeRevision: true,
      sourceQuoteId: rootId,

      quoteTitle: quote.quoteTitle,
      quoteDate: new Date(),
      validUntil: quote.validUntil ?? null,
      status: 'Draft',
      currency: quote.currency || 'USD',
      exchangeRateSnapshot: Number(quote.exchangeRateSnapshot) || 1,
      ownerId: quote.ownerId ?? req.user._id,

      customerId: quote.customerId ?? null,
      organizationRefId: quote.organizationRefId ?? null,
      contactId: quote.contactId ?? null,
      dealId: quote.dealId ?? null,
      caseId: quote.caseId ?? null,
      customRecordId: quote.customRecordId ?? null,
      sourceContext: quote.sourceContext ?? 'manual',
      sourceRef: quote.sourceRef ?? null,

      subtotal: 0,
      taxTotal: 0,
      grandTotal: 0,

      approvalRequired: false,
      approvalStatus: 'Not Required',
      approvalLocked: false,

      sentToCustomer: false,
      sentAt: null,
      publicShareToken: null,
      portalAccessEnabled: false,

      converted: false,
      conversionStatus: 'Not Converted',

      customFields: quote.customFields ?? {}
    });

    const prevLines = await QuoteLine.find({ organizationId, quoteId: quote._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

    const parents = prevLines.filter((l) => String(l.lineType) === 'bundle_parent');
    const others = prevLines.filter((l) => String(l.lineType) !== 'bundle_parent');

    const oldToNewParentId = new Map();
    const inserted = [];

    for (const parent of parents) {
      const payload = { ...parent };
      delete payload._id;
      delete payload.quoteLineId;
      delete payload.createdAt;
      delete payload.updatedAt;
      payload.quoteId = next._id;
      payload.parentBundleLineId = null;
      payload.lockedSnapshot = false;
      inserted.push(payload);
    }

    const createdParents = inserted.length ? await QuoteLine.insertMany(inserted, { ordered: true }) : [];
    for (let i = 0; i < parents.length; i++) {
      oldToNewParentId.set(String(parents[i]._id), createdParents[i]._id);
    }

    const insertedChildren = [];
    for (const line of others) {
      const payload = { ...line };
      delete payload._id;
      delete payload.quoteLineId;
      delete payload.createdAt;
      delete payload.updatedAt;
      payload.quoteId = next._id;
      payload.lockedSnapshot = false;

      if (payload.parentBundleLineId) {
        const mapped = oldToNewParentId.get(String(payload.parentBundleLineId));
        payload.parentBundleLineId = mapped || null;
      }
      // Keep bundleSnapshot but rewrite embedded parentBundleLineId if present.
      if (payload.bundleSnapshot && typeof payload.bundleSnapshot === 'object') {
        const b = { ...payload.bundleSnapshot };
        if (b.parentBundleLineId) {
          const mapped = oldToNewParentId.get(String(b.parentBundleLineId));
          if (mapped) b.parentBundleLineId = String(mapped);
        }
        payload.bundleSnapshot = b;
      }

      insertedChildren.push(payload);
    }
    if (insertedChildren.length) {
      await QuoteLine.insertMany(insertedChildren, { ordered: true });
    }

    const newLines = await QuoteLine.find({ organizationId, quoteId: next._id })
      .select('_id lineType parentBundleLineId bundleSnapshot hiddenLine lineSubtotal lineTaxTotal lineTotal')
      .lean();
    const totals = quoteTotalsService.computeQuoteTotalsFromLines(newLines);

    await Quote.updateOne(
      { _id: next._id, organizationId },
      { $set: { subtotal: totals.subtotal, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal } }
    );

    await writeQuoteActivity({
      organizationId,
      quoteId: next._id,
      userId: req.user._id,
      action: 'quote_revision_created',
      message: `Revision created: Rev ${nextRevisionNumber}`,
      details: {
        sourceQuoteId: String(quote._id),
        quoteNumber: quote.quoteNumber,
        revisionNumber: nextRevisionNumber
      }
    });

    return res.status(201).json({ success: true, data: next });
  } catch (err) {
    const code = err?.code;
    const status =
      code === 'REVISION_NOT_ALLOWED' || code === 'VALIDATION'
        ? 400
        : code === 'NOT_FOUND'
          ? 404
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to revise quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

module.exports = {
  createQuote,
  getQuotes,
  getQuoteById,
  updateQuote,
  transitionQuoteStatus,
  submitQuoteForApproval,
  approveQuote,
  rejectQuote,
  shareQuote,
  revokeQuoteShare,
  convertQuote,
  getQuoteConversion,
  deleteQuote,
  recalculateQuote,
  reviseQuote
};


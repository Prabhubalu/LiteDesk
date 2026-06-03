/**
 * Quote ↔ Process Designer approval integration.
 * Syncs ApprovalInstance decisions to quote status and exposes pending gates on a quote.
 */

const mongoose = require('mongoose');
const Quote = require('../models/Quote');
const QuoteApproval = require('../models/QuoteApproval');
const ApprovalInstance = require('../models/ApprovalInstance');
const { assertCanTransitionQuoteStatus } = require('../constants/quoteLifecycle');
const { writeQuoteActivity } = require('./quoteActivityService');
const { compareQuoteRevisions } = require('./quoteRevisionCompareService');

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
    console.warn('[quotes] failed to write QuoteApproval:', e?.message || e);
  }
}

/**
 * Apply an ApprovalInstance approve/reject decision to the linked quote record.
 *
 * @param {Object} params
 * @param {Object} params.approval - ApprovalInstance lean doc
 * @param {'approved'|'rejected'} params.decision
 * @param {string|Object} params.userId
 * @param {string} [params.comment]
 * @returns {Promise<{ applied: boolean, quote?: Object, skipped?: boolean, reason?: string }>}
 */
async function applyProcessDecisionToQuote({ approval, decision, userId, comment = null }) {
  if (!approval || approval.entityType !== 'quote' || !approval.entityId) {
    return { applied: false, reason: 'not_a_quote_approval' };
  }

  const organizationId = approval.organizationId;
  const quote = await Quote.findOne({ _id: approval.entityId, organizationId });
  if (!quote) {
    return { applied: false, reason: 'quote_not_found' };
  }

  const fromStatus = quote.status;
  if (String(fromStatus) !== 'Pending Approval') {
    return { applied: false, skipped: true, reason: 'quote_not_pending_approval' };
  }

  const toStatus = decision === 'approved' ? 'Approved' : 'Rejected';
  assertCanTransitionQuoteStatus(fromStatus, toStatus);

  quote.status = toStatus;
  quote.approvalStatus = decision === 'approved' ? 'Approved' : 'Rejected';
  quote.approvalLocked = false;
  await quote.save();

  const action = decision === 'approved' ? 'approve' : 'reject';
  await appendQuoteApprovalEvent({
    organizationId,
    quote,
    userId,
    action,
    fromStatus,
    toStatus,
    comment,
    metadata: {
      source: 'process_approval',
      approvalId: approval.approvalId,
      processId: approval.processId?.toString?.() || approval.processId
    }
  });

  let compareDetails = {
    revisionNumber: Number(quote.revisionNumber) || 1,
    approvalId: approval.approvalId,
    compareLink: `/quotes/${quote._id}/compare?toRevision=${Number(quote.revisionNumber) || 1}`
  };
  try {
    const compare = await compareQuoteRevisions({ organizationId, quoteId: quote._id });
    compareDetails = {
      ...compareDetails,
      compareBaselineRevision: compare?.from?.revisionNumber || null,
      compareLink: compare?.from?.revisionNumber
        ? `/quotes/${quote._id}/compare?fromRevision=${compare.from.revisionNumber}&toRevision=${Number(quote.revisionNumber) || 1}`
        : compareDetails.compareLink,
      changeCounts: compare?.summary?.changeCounts || null,
      riskLevel: compare?.summary?.riskLevel || 'low',
      riskIndicators: compare?.summary?.riskIndicators || [],
      executiveSummary: compare?.summary?.executiveSummary || []
    };
  } catch (err) {
    compareDetails.compareError = err?.message || 'Compare unavailable';
  }

  await writeQuoteActivity({
    organizationId,
    quoteId: quote._id,
    userId,
    action: decision === 'approved' ? 'quote_approved' : 'quote_rejected',
    message: decision === 'approved' ? 'Quote approved (process)' : 'Quote rejected (process)',
    details: { fromStatus, toStatus, comment, ...compareDetails }
  });

  return { applied: true, quote };
}

/**
 * Pending process approval gates for a quote (ApprovalInstance).
 */
async function findPendingProcessApprovalsForQuote({ organizationId, quoteId }) {
  const oid = organizationId?.toString?.() || String(organizationId);
  const qid = quoteId?.toString?.() || String(quoteId);

  return ApprovalInstance.find({
    organizationId: new mongoose.Types.ObjectId(oid),
    entityType: 'quote',
    entityId: qid,
    status: 'pending'
  })
    .populate('processId', 'name')
    .populate('approvers', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .lean();
}

module.exports = {
  applyProcessDecisionToQuote,
  findPendingProcessApprovalsForQuote,
  appendQuoteApprovalEvent
};

const Quote = require('../models/Quote');
const QuoteApproval = require('../models/QuoteApproval');
const QuoteDocument = require('../models/QuoteDocument');
const RecordActivity = require('../models/RecordActivity');
const { compareQuoteRevisions } = require('./quoteRevisionCompareService');
const { findPendingProcessApprovalsForQuote } = require('./quoteApprovalProcessService');

function stringifyId(value) {
  if (value == null) return null;
  if (typeof value === 'object' && value._id) return stringifyId(value._id);
  return value.toString ? value.toString() : String(value);
}

function actorName(user) {
  if (!user || typeof user !== 'object') return 'User';
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'User';
}

async function getQuoteApprovalHistory({ organizationId, quoteId, revisionNumber = null }) {
  const query = { organizationId, quoteId };
  if (revisionNumber) query.revisionNumber = Number(revisionNumber);
  const [approvals, activities] = await Promise.all([
    QuoteApproval.find(query)
      .populate('actorUserId', 'firstName lastName email')
      .sort({ createdAt: 1 })
      .lean(),
    RecordActivity.find({
      organizationId,
      moduleKey: 'quotes',
      recordId: quoteId,
      ...(revisionNumber ? { 'details.revisionNumber': Number(revisionNumber) } : {})
    })
      .populate('author', 'firstName lastName email')
      .sort({ createdAt: 1 })
      .lean()
  ]);

  const approvalRows = approvals.map((row) => ({
    type: 'quote_approval',
    action: row.action,
    revisionNumber: Number(row.revisionNumber) || 1,
    actor: {
      id: stringifyId(row.actorUserId?._id || row.actorUserId),
      name: actorName(row.actorUserId),
      email: row.actorUserId?.email || null
    },
    comment: row.comment || null,
    metadata: row.metadata || {},
    createdAt: row.createdAt
  }));

  const activityRows = activities.map((row) => ({
    type: 'quote_activity',
    action: row.action,
    revisionNumber: Number(row.details?.revisionNumber) || revisionNumber || null,
    actor: {
      id: stringifyId(row.author?._id || row.author),
      name: row.details?.actorLabel === 'customer' ? 'Customer' : actorName(row.author),
      email: row.author?.email || null
    },
    comment: row.message || null,
    metadata: row.details || {},
    createdAt: row.createdAt
  }));

  return [...approvalRows, ...activityRows].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

async function getLatestQuoteDocument({ organizationId, quote }) {
  if (!quote?._id) return null;
  const doc = await QuoteDocument.findOne({
    organizationId,
    quoteId: quote._id,
    revisionNumber: Number(quote.revisionNumber) || 1,
    status: { $ne: 'revoked' }
  })
    .sort({ versionNumber: -1, generatedAt: -1 })
    .lean();
  if (!doc) {
    return {
      exists: false,
      quoteId: stringifyId(quote._id),
      revisionNumber: Number(quote.revisionNumber) || 1,
      watermarked: ['Draft', 'Pending Approval'].includes(String(quote.status || ''))
    };
  }
  return {
    exists: true,
    documentId: stringifyId(doc._id),
    quoteId: stringifyId(doc.quoteId),
    quoteNumber: doc.quoteNumber,
    revisionNumber: Number(doc.revisionNumber) || 1,
    versionNumber: Number(doc.versionNumber) || 1,
    filePath: doc.filePath,
    generatedAt: doc.generatedAt,
    generatedBy: stringifyId(doc.generatedBy),
    watermarked: ['Draft', 'Pending Approval'].includes(String(quote.status || '')),
    grandTotal: doc.grandTotal,
    currency: doc.currency
  };
}

async function getQuoteApprovalWorkspace({ organizationId, quoteId, approvalId = null, filters = {} }) {
  const quote = await Quote.findOne({ _id: quoteId, organizationId }).lean();
  if (!quote) {
    const err = new Error('Quote not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const [compare, approvalHistory, pendingApprovals, latestDocument] = await Promise.all([
    compareQuoteRevisions({ organizationId, quoteId, filters }),
    getQuoteApprovalHistory({ organizationId, quoteId: quote._id, revisionNumber: quote.revisionNumber }),
    findPendingProcessApprovalsForQuote({ organizationId, quoteId: quote._id }),
    getLatestQuoteDocument({ organizationId, quote })
  ]);

  return {
    approvalId,
    quote: {
      quoteId: stringifyId(quote._id),
      quoteNumber: quote.quoteNumber,
      quoteTitle: quote.quoteTitle || null,
      revisionNumber: Number(quote.revisionNumber) || 1,
      activeRevision: quote.activeRevision === true,
      status: quote.status,
      approvalRequired: quote.approvalRequired === true,
      approvalStatus: quote.approvalStatus || 'Not Required',
      approvalLocked: quote.approvalLocked === true,
      currency: quote.currency || 'USD',
      grandTotal: Number(quote.grandTotal) || 0,
      validUntil: quote.validUntil || null
    },
    compare,
    approvalHistory,
    pendingApprovals,
    pdfPreview: latestDocument,
    approvalSla: {
      policyId: null,
      startedAt: null,
      dueAt: null,
      breachedAt: null,
      status: 'not_configured'
    }
  };
}

module.exports = {
  getQuoteApprovalWorkspace,
  getQuoteApprovalHistory,
  getLatestQuoteDocument
};

/**
 * Quotes lifecycle contract (platform transactional module).
 *
 * Notes:
 * - Server-side transition enforcement is mandatory.
 * - Commercial edits are additionally restricted by status (see canCommerciallyEditQuote()).
 */

const QUOTE_STATUSES = [
  'Draft',
  'Pending Approval',
  'Approved',
  'Sent',
  'Viewed',
  'Accepted',
  'Partially Accepted',
  'Partially Converted',
  'Rejected',
  'Expired',
  'Cancelled',
  'Converted'
];

const QUOTE_STATUS_DEFAULT = 'Draft';

// Allowed transitions (PRD-driven). Keep explicit for audit safety.
const QUOTE_ALLOWED_TRANSITIONS = {
  Draft: ['Pending Approval', 'Approved', 'Cancelled'],
  'Pending Approval': ['Approved', 'Rejected'],
  Approved: ['Sent', 'Cancelled'],
  Sent: ['Viewed', 'Accepted', 'Partially Accepted', 'Rejected', 'Expired'],
  Viewed: ['Accepted', 'Partially Accepted', 'Rejected', 'Expired'],
  Accepted: ['Partially Converted', 'Converted'],
  'Partially Accepted': ['Partially Converted', 'Converted'],
  'Partially Converted': ['Converted'],
  Rejected: [],
  Expired: [],
  Cancelled: [],
  Converted: []
};

function isQuoteStatus(value) {
  return QUOTE_STATUSES.includes(value);
}

function assertValidStatus(value) {
  if (!isQuoteStatus(value)) {
    const err = new Error('Invalid quote status');
    err.code = 'VALIDATION';
    err.details = { status: value };
    throw err;
  }
}

function canTransitionQuoteStatus(fromStatus, toStatus) {
  if (!isQuoteStatus(fromStatus) || !isQuoteStatus(toStatus)) return false;
  const allowed = QUOTE_ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function assertCanTransitionQuoteStatus(fromStatus, toStatus) {
  assertValidStatus(fromStatus);
  assertValidStatus(toStatus);
  if (!canTransitionQuoteStatus(fromStatus, toStatus)) {
    const err = new Error(`Invalid quote status transition: ${fromStatus} -> ${toStatus}`);
    err.code = 'INVALID_TRANSITION';
    err.details = { fromStatus, toStatus };
    throw err;
  }
}

/**
 * Commercial edit lock (snapshot lock).
 * After Sent (or later), quote lines are commercially locked.
 * Override requires explicit permission + audit; revisions are the preferred mechanism.
 */
function isCommerciallyLockedStatus(status) {
  return ['Sent', 'Viewed', 'Accepted', 'Partially Accepted', 'Partially Converted', 'Converted'].includes(status);
}

const QUOTE_CUSTOMER_SENT_STATUSES = [
  'Sent',
  'Viewed',
  'Accepted',
  'Partially Accepted',
  'Partially Converted',
  'Converted'
];

const { quoteRequiresApprovalBeforeSend } = require('../services/quoteOrgSettingsService');

/**
 * Whether the quote may be emailed to the customer (PDF and/or portal link).
 * - Approved or already sent to customer: allowed
 * - Draft: only when approval is not required (per quote or org policy)
 * - Pending Approval / Rejected / Cancelled / Expired: blocked
 *
 * @param {Object} quote
 * @param {{ requireApprovalBeforeSend?: boolean }|null} [orgQuoteSettings]
 */
function getSendQuoteToCustomerEligibility(quote, orgQuoteSettings = null) {
  const status = String(quote?.status || '').trim();
  if (['Rejected', 'Cancelled', 'Pending Approval', 'Expired'].includes(status)) {
    return { allowed: false, reason: status === 'Pending Approval' ? 'pending_approval' : status.toLowerCase().replace(' ', '_') };
  }
  if (QUOTE_CUSTOMER_SENT_STATUSES.includes(status)) {
    return { allowed: true, reason: null };
  }
  if (status === 'Approved') {
    return { allowed: true, reason: null };
  }
  if (status === 'Draft') {
    if (quoteRequiresApprovalBeforeSend(quote, orgQuoteSettings)) {
      return { allowed: false, reason: 'draft_needs_approval' };
    }
    return { allowed: true, reason: null };
  }
  return { allowed: false, reason: 'invalid_status' };
}

/**
 * Formal public share link (copy link / portal) — same gate as binding customer send, except resend.
 */
function getFormalShareQuoteEligibility(quote, orgQuoteSettings = null) {
  const status = String(quote?.status || '').trim();
  if (QUOTE_CUSTOMER_SENT_STATUSES.includes(status)) {
    return { allowed: true, reason: null };
  }
  if (status === 'Approved') {
    return { allowed: true, reason: null };
  }
  if (status === 'Pending Approval') {
    return { allowed: false, reason: 'pending_approval' };
  }
  if (status === 'Draft') {
    if (quoteRequiresApprovalBeforeSend(quote, orgQuoteSettings)) {
      return { allowed: false, reason: 'draft_needs_approval' };
    }
    return { allowed: false, reason: 'draft_formal_share_blocked' };
  }
  if (['Rejected', 'Cancelled', 'Expired'].includes(status)) {
    return { allowed: false, reason: status.toLowerCase().replace(' ', '_') };
  }
  return { allowed: false, reason: 'invalid_status' };
}

function assertCanShareQuotePublicly(quote, orgQuoteSettings = null) {
  const { allowed, reason } = getFormalShareQuoteEligibility(quote, orgQuoteSettings);
  if (allowed) return;
  const status = String(quote?.status || '').trim();
  const messages = {
    pending_approval: 'Approve this quote before sharing a public link.',
    draft_needs_approval: 'Submit and approve this quote before sharing a public link.',
    draft_formal_share_blocked: 'Approve or send this quote before sharing a binding public link. Use Send draft for review for provisional sharing.',
    rejected: 'Rejected quotes cannot be shared.',
    cancelled: 'Cancelled quotes cannot be shared.',
    expired: 'Expired quotes cannot be shared. Create a new revision first.',
    invalid_status: `Quotes in status "${status}" cannot be shared.`
  };
  const err = new Error(messages[reason] || messages.invalid_status);
  err.code = 'QUOTE_SHARE_NOT_ALLOWED';
  err.details = { reason, status };
  throw err;
}

function isDraftCustomerShare(quote) {
  return String(quote?.customerShareMode || '').trim().toLowerCase() === 'draft';
}

function isFormalCustomerShare(quote) {
  const mode = String(quote?.customerShareMode || '').trim().toLowerCase();
  if (mode === 'formal') return true;
  if (mode === 'draft') return false;
  return QUOTE_CUSTOMER_SENT_STATUSES.includes(String(quote?.status || '').trim());
}

/** Header/line edits blocked; use revise flow or dedicated status endpoints. */
const QUOTE_RECORD_READ_ONLY_STATUSES = [
  'Expired',
  'Cancelled',
  'Partially Converted',
  'Converted',
  'Rejected'
];

function isQuoteRecordReadOnly(status) {
  return QUOTE_RECORD_READ_ONLY_STATUSES.includes(String(status || '').trim());
}

/**
 * @param {{ status?: string }} quote
 */
function assertQuoteRecordEditable(quote) {
  const status = String(quote?.status || '').trim();
  if (!isQuoteRecordReadOnly(status)) return;
  const err = new Error(
    `Quotes in status "${status}" cannot be edited. Create a new revision to continue.`
  );
  err.code = 'QUOTE_RECORD_LOCKED';
  err.details = { status };
  throw err;
}

function resolveCustomerSendMode(quote) {
  const status = String(quote?.status || '').trim();
  if (status === 'Draft' && !isDraftCustomerShare(quote)) {
    return 'draft';
  }
  return 'formal';
}

function assertCanSendQuoteToCustomer(quote, orgQuoteSettings = null) {
  const { allowed, reason } = getSendQuoteToCustomerEligibility(quote, orgQuoteSettings);
  if (allowed) return;
  const status = String(quote?.status || '').trim();
  const messages = {
    pending_approval: 'Approve this quote before sending it to the customer.',
    draft_needs_approval: 'Submit for approval and wait for approval before sending to the customer.',
    rejected: 'Rejected quotes cannot be sent to the customer.',
    cancelled: 'Cancelled quotes cannot be sent to the customer.',
    expired: 'Expired quotes cannot be sent. Create a new revision first.',
    invalid_status: `Quotes in status "${status}" cannot be sent to the customer.`
  };
  const err = new Error(messages[reason] || messages.invalid_status);
  err.code = 'QUOTE_SEND_NOT_ALLOWED';
  err.details = { reason, status };
  throw err;
}

module.exports = {
  QUOTE_STATUSES,
  QUOTE_STATUS_DEFAULT,
  QUOTE_ALLOWED_TRANSITIONS,
  isQuoteStatus,
  assertValidStatus,
  canTransitionQuoteStatus,
  assertCanTransitionQuoteStatus,
  isCommerciallyLockedStatus,
  QUOTE_RECORD_READ_ONLY_STATUSES,
  isQuoteRecordReadOnly,
  assertQuoteRecordEditable,
  QUOTE_CUSTOMER_SENT_STATUSES,
  getSendQuoteToCustomerEligibility,
  getFormalShareQuoteEligibility,
  assertCanShareQuotePublicly,
  assertCanSendQuoteToCustomer,
  isDraftCustomerShare,
  isFormalCustomerShare,
  resolveCustomerSendMode
};


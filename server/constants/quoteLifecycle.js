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
  Sent: ['Viewed', 'Accepted', 'Rejected', 'Expired'],
  Viewed: ['Accepted', 'Rejected', 'Expired'],
  Accepted: ['Converted'],
  'Partially Accepted': ['Converted'],
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
  return ['Sent', 'Viewed', 'Accepted', 'Partially Accepted', 'Converted'].includes(status);
}

module.exports = {
  QUOTE_STATUSES,
  QUOTE_STATUS_DEFAULT,
  QUOTE_ALLOWED_TRANSITIONS,
  isQuoteStatus,
  assertValidStatus,
  canTransitionQuoteStatus,
  assertCanTransitionQuoteStatus,
  isCommerciallyLockedStatus
};


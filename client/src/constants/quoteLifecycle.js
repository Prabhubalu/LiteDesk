export const QUOTE_STATUSES = [
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

export const QUOTE_ALLOWED_TRANSITIONS = {
  Draft: ['Pending Approval', 'Approved', 'Cancelled'],
  'Pending Approval': ['Approved', 'Rejected'],
  Approved: ['Sent', 'Cancelled'],
  Sent: ['Viewed', 'Accepted', 'Partially Accepted', 'Rejected', 'Expired'],
  Viewed: ['Accepted', 'Partially Accepted', 'Rejected', 'Expired'],
  Accepted: ['Converted'],
  'Partially Accepted': ['Converted'],
  Rejected: [],
  Expired: [],
  Cancelled: [],
  Converted: []
};

export function getAllowedNextQuoteStatuses(fromStatus) {
  const from = String(fromStatus || '').trim();
  return QUOTE_ALLOWED_TRANSITIONS[from] || [];
}

/** After Sent, line edits are commercially locked unless admin override + audit. */
export function isCommerciallyLockedStatus(status) {
  return ['Sent', 'Viewed', 'Accepted', 'Partially Accepted', 'Converted'].includes(
    String(status || '').trim()
  );
}

export function getQuoteOrgSettingsFromAuth(authStore) {
  return authStore?.organization?.settings?.quotes || null;
}

export function quoteRequiresApprovalBeforeSend(record, orgSettings = null) {
  if (record?.approvalRequired === true) return true;
  if (orgSettings?.requireApprovalBeforeSend === true) return true;
  return false;
}

/**
 * Formal public link (copy link) — Approved+ or already sent; not draft review.
 */
export function getFormalShareQuoteEligibility(record, orgSettings = null) {
  const status = String(record?.status || '').trim();
  const sent = ['Sent', 'Viewed', 'Accepted', 'Partially Accepted', 'Converted'];
  if (sent.includes(status)) return { allowed: true, reason: null };
  if (status === 'Approved') return { allowed: true, reason: null };
  if (status === 'Pending Approval') return { allowed: false, reason: 'pending_approval' };
  if (status === 'Draft') {
    if (quoteRequiresApprovalBeforeSend(record, orgSettings)) {
      return { allowed: false, reason: 'draft_needs_approval' };
    }
    return { allowed: false, reason: 'draft_formal_share_blocked' };
  }
  if (['Rejected', 'Cancelled', 'Expired'].includes(status)) {
    return { allowed: false, reason: status.toLowerCase() };
  }
  return { allowed: false, reason: 'invalid_status' };
}

/** @deprecated use getFormalShareQuoteEligibility */
export function canShareQuotePublicly(statusOrRecord, orgSettings = null) {
  const record =
    statusOrRecord && typeof statusOrRecord === 'object'
      ? statusOrRecord
      : { status: statusOrRecord };
  return getFormalShareQuoteEligibility(record, orgSettings).allowed;
}

const QUOTE_CUSTOMER_SENT_STATUSES = ['Sent', 'Viewed', 'Accepted', 'Partially Accepted', 'Converted'];

/**
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function getSendQuoteToCustomerEligibility(record, orgSettings = null) {
  const status = String(record?.status || '').trim();
  if (['Rejected', 'Cancelled', 'Pending Approval', 'Expired'].includes(status)) {
    const reason =
      status === 'Pending Approval'
        ? 'pending_approval'
        : status === 'Expired'
          ? 'expired'
          : status.toLowerCase();
    return { allowed: false, reason };
  }
  if (QUOTE_CUSTOMER_SENT_STATUSES.includes(status)) {
    return { allowed: true, reason: null };
  }
  if (status === 'Approved') {
    return { allowed: true, reason: null };
  }
  if (status === 'Draft') {
    if (quoteRequiresApprovalBeforeSend(record, orgSettings)) {
      return { allowed: false, reason: 'draft_needs_approval' };
    }
    return { allowed: true, reason: null };
  }
  return { allowed: false, reason: 'invalid_status' };
}

export function canSendQuoteToCustomer(record, orgSettings = null) {
  return getSendQuoteToCustomerEligibility(record, orgSettings).allowed;
}

export function isQuoteAlreadySentToCustomer(record) {
  return QUOTE_CUSTOMER_SENT_STATUSES.includes(String(record?.status || '').trim());
}

export function isDraftCustomerShare(record) {
  return String(record?.customerShareMode || '').trim().toLowerCase() === 'draft';
}

export function isFormalCustomerShare(record) {
  const mode = String(record?.customerShareMode || '').trim().toLowerCase();
  if (mode === 'formal') return true;
  if (mode === 'draft') return false;
  return isQuoteAlreadySentToCustomer(record);
}

/** @returns {'draft'|'formal'} */
export function resolveCustomerSendMode(record, orgSettings = null) {
  const status = String(record?.status || '').trim();
  if (status === 'Draft' && canSendQuoteToCustomer(record, orgSettings)) return 'draft';
  return 'formal';
}

export function getSendQuoteButtonLabelKey(record) {
  if (isQuoteAlreadySentToCustomer(record) || isFormalCustomerShare(record)) {
    return 'records.quoteActionResendEmail';
  }
  if (resolveCustomerSendMode(record) === 'draft') {
    return 'records.quoteActionSendDraftEmail';
  }
  return 'records.quoteActionSendEmail';
}

const SEND_QUOTE_BLOCK_I18N = {
  pending_approval: 'records.quoteSendEmailBlockedPendingApproval',
  draft_needs_approval: 'records.quoteSendEmailBlockedDraftNeedsApproval',
  rejected: 'records.quoteSendEmailBlockedRejected',
  cancelled: 'records.quoteSendEmailBlockedCancelled',
  expired: 'records.quoteSendEmailBlockedExpired',
  invalid_status: 'records.quoteSendEmailBlockedInvalidStatus'
};

const SHARE_QUOTE_BLOCK_I18N = {
  pending_approval: 'records.quoteShareBlockedPendingApproval',
  draft_needs_approval: 'records.quoteShareBlockedDraftNeedsApproval',
  draft_formal_share_blocked: 'records.quoteShareBlockedDraftFormal',
  rejected: 'records.quoteShareBlockedRejected',
  cancelled: 'records.quoteShareBlockedCancelled',
  expired: 'records.quoteShareBlockedExpired',
  invalid_status: 'records.quoteShareBlockedInvalidStatus'
};

export function getSendQuoteBlockMessageKey(record, orgSettings = null) {
  const { allowed, reason } = getSendQuoteToCustomerEligibility(record, orgSettings);
  if (allowed || !reason) return null;
  return SEND_QUOTE_BLOCK_I18N[reason] || SEND_QUOTE_BLOCK_I18N.invalid_status;
}

export function getShareQuoteBlockMessageKey(record, orgSettings = null) {
  const { allowed, reason } = getFormalShareQuoteEligibility(record, orgSettings);
  if (allowed || !reason) return null;
  return SHARE_QUOTE_BLOCK_I18N[reason] || SHARE_QUOTE_BLOCK_I18N.invalid_status;
}


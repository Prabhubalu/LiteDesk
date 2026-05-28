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
  Sent: ['Viewed', 'Accepted', 'Rejected', 'Expired'],
  Viewed: ['Accepted', 'Rejected', 'Expired'],
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


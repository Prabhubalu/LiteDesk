/**
 * Quote module activity UI — human-readable system event messages.
 */

const QUOTE_ACTIVITY_MESSAGES = {
  quote_created: 'Created this quote',
  quote_updated: 'Updated this quote',
  quote_status_changed: 'Changed quote status',
  quote_submitted_for_approval: 'Submitted for approval',
  quote_approved: 'Approved quote',
  quote_rejected: 'Rejected quote',
  quote_sent: 'Sent quote to customer',
  quote_draft_shared: 'Shared draft for customer review',
  quote_shared: 'Generated public share link',
  quote_share_token_rotated: 'Rotated public share link',
  quote_share_revoked: 'Revoked public share link',
  quote_public_viewed: 'Customer viewed quote (public link)',
  quote_public_accepted: 'Customer accepted quote',
  quote_public_partially_accepted: 'Customer partially accepted quote',
  quote_public_rejected: 'Customer rejected quote',
  quote_public_comment: 'Customer posted a comment',
  quote_line_added: 'Added a line',
  quote_line_updated: 'Updated a line',
  quote_line_deleted: 'Removed a line',
  quote_recalculated: 'Recalculated totals',
  quote_revision_created: 'Created a new revision',
  quote_converted: 'Marked quote as converted',
  quote_document_generated: 'Generated quote PDF'
};

/**
 * @param {object} event - Normalized system activity event
 * @returns {string|null}
 */
export function getQuoteActivityMessage(event) {
  if (!event) return null;
  const action = String(event?.action || event?.payload?.action || '').trim();
  const msg = String(event?.message ?? event?.payload?.message ?? '').trim();
  if (msg && !QUOTE_ACTIVITY_MESSAGES[action]) return msg;
  if (QUOTE_ACTIVITY_MESSAGES[action]) return QUOTE_ACTIVITY_MESSAGES[action];
  if (action === 'quote_status_changed') {
    const d = event?.details || event?.payload?.details || {};
    const from = d.fromStatus ?? d.from;
    const to = d.toStatus ?? d.to;
    if (from != null && to != null) return `Status: ${from} → ${to}`;
  }
  if (action.startsWith('quote_public_')) {
    return QUOTE_ACTIVITY_MESSAGES[action] || 'Customer portal activity';
  }
  return null;
}

/**
 * @param {object} event
 * @returns {string}
 */
export function getQuoteActivityActorLabel(event) {
  const details = event?.details || event?.payload?.details || {};
  if (details.actorLabel === 'customer') return 'Customer';
  return null;
}

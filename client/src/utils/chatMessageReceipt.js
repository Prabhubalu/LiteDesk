/**
 * WhatsApp-style receipt status from persisted timestamps.
 * @param {{ deliveredAt?: string|Date|null, readAt?: string|Date|null }} message
 * @returns {'sent'|'delivered'|'read'}
 */
export function receiptStatusFromMessage(message) {
  if (!message) return 'sent';
  if (message.readAt) return 'read';
  if (message.deliveredAt) return 'delivered';
  return 'sent';
}

/**
 * Apply receipt patch from SSE onto a local message row.
 */
export function applyReceiptPatch(message, patch) {
  if (!message || !patch) return message;
  if (patch.deliveredAt) message.deliveredAt = patch.deliveredAt;
  if (patch.readAt) message.readAt = patch.readAt;
  return message;
}

const ChatMessage = require('../models/ChatMessage');

function normalizeIds(messageIds) {
  if (!Array.isArray(messageIds)) return [];
  return [...new Set(messageIds.map((id) => String(id || '').trim()).filter(Boolean))];
}

/**
 * Mark messages as delivered to the recipient (visitor for outbound, agent for inbound).
 */
async function markDelivered({ sessionId, messageIds, direction }) {
  const ids = normalizeIds(messageIds);
  if (!sessionId || !ids.length || !direction) return { modified: 0 };

  const now = new Date();
  const res = await ChatMessage.updateMany(
    {
      _id: { $in: ids },
      sessionId,
      direction,
      deliveredAt: null
    },
    { $set: { deliveredAt: now, updatedAt: now } }
  );
  return { modified: res.modifiedCount || 0, at: now };
}

/**
 * Mark messages as read by the recipient.
 */
async function markRead({ sessionId, messageIds, direction }) {
  const ids = normalizeIds(messageIds);
  if (!sessionId || !ids.length || !direction) return { modified: 0 };

  const now = new Date();
  const res = await ChatMessage.updateMany(
    {
      _id: { $in: ids },
      sessionId,
      direction
    },
    { $set: { readAt: now, deliveredAt: now, updatedAt: now } }
  );
  return { modified: res.modifiedCount || 0, at: now };
}

/**
 * Agent opened the case chat — mark all visitor messages read.
 */
async function markAllInboundReadForAgent(sessionId) {
  if (!sessionId) return { modified: 0 };
  const now = new Date();
  const res = await ChatMessage.updateMany(
    {
      sessionId,
      direction: 'inbound',
      readAt: null
    },
    { $set: { readAt: now, deliveredAt: now, updatedAt: now } }
  );
  return { modified: res.modifiedCount || 0, at: now };
}

/**
 * Auto-deliver inbound messages to connected agents (first SSE poll).
 */
async function markInboundDeliveredToAgent(sessionId, messageIds) {
  return markDelivered({ sessionId, messageIds, direction: 'inbound' });
}

/**
 * Auto-deliver outbound messages to visitor widget.
 */
async function markOutboundDeliveredToVisitor(sessionId, messageIds) {
  return markDelivered({ sessionId, messageIds, direction: 'outbound' });
}

/**
 * Receipt patches since cursor (for SSE).
 */
async function listReceiptUpdates(sessionId, afterMs) {
  if (!sessionId) return [];
  const after = new Date(Number(afterMs) || 0);
  const rows = await ChatMessage.find({
    sessionId,
    $or: [{ deliveredAt: { $gt: after } }, { readAt: { $gt: after } }]
  })
    .select('_id direction deliveredAt readAt')
    .sort({ updatedAt: 1 })
    .limit(100)
    .lean();
  return rows.map((r) => ({
    _id: String(r._id),
    direction: r.direction,
    deliveredAt: r.deliveredAt || null,
    readAt: r.readAt || null
  }));
}

function receiptStatusFromRow(row) {
  if (row?.readAt) return 'read';
  if (row?.deliveredAt) return 'delivered';
  return 'sent';
}

module.exports = {
  markDelivered,
  markRead,
  markAllInboundReadForAgent,
  markInboundDeliveredToAgent,
  markOutboundDeliveredToVisitor,
  listReceiptUpdates,
  receiptStatusFromRow
};

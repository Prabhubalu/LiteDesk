'use strict';

const MailroomMessage = require('../../../models/MailroomMessage');
const MailroomConversation = require('../../../models/MailroomConversation');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mongo text / regex search across mailroom corpus (OpenSearch optional later).
 */
async function searchMailroom(organizationId, {
  q = '',
  limit = 25,
  channel = null,
  caseId = null
} = {}) {
  const term = String(q || '').trim();
  if (!term || term.length < 2) {
    const err = new Error('Search query must be at least 2 characters');
    err.statusCode = 400;
    throw err;
  }

  const max = Math.min(Math.max(Number(limit) || 25, 1), 50);
  const regex = new RegExp(escapeRegex(term), 'i');

  const messageQuery = {
    organizationId,
    $or: [
      { subject: regex },
      { body: regex },
      { externalMessageId: regex },
      { 'participants.from': regex }
    ]
  };
  if (channel) messageQuery.channel = channel;
  if (caseId) messageQuery.linkedCaseId = caseId;

  const messages = await MailroomMessage.find(messageQuery)
    .sort({ receivedAt: -1, createdAt: -1 })
    .limit(max)
    .select('conversationId linkedCaseId channel subject body externalMessageId receivedAt direction')
    .lean();

  const conversations = await MailroomConversation.find({
    organizationId,
    $or: [
      { lastSubject: regex },
      { lastFromAddress: regex },
      { externalThreadId: regex }
    ]
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(Math.min(max, 15))
    .select('primaryCaseId channel lastSubject lastFromAddress externalThreadId lastMessageAt')
    .lean();

  return {
    query: term,
    messages,
    conversations
  };
}

module.exports = {
  searchMailroom
};

'use strict';

const MailroomConversation = require('../../../models/MailroomConversation');
const MailroomMessage = require('../../../models/MailroomMessage');
const MailroomThreadingLog = require('../../../models/MailroomThreadingLog');
const {
  evaluateThreadingSignal,
  normalizeSubject
} = require('../policies/strategies/threadingStrategies');

function getFromAddress(normalized) {
  const from = normalized?.participants?.from;
  if (!from) return '';
  if (typeof from === 'string') return from.toLowerCase().trim();
  return String(from.address || from.email || '').toLowerCase().trim();
}

async function resolveConversationForThreading({
  organizationId,
  normalizedMessage,
  threadingEvaluation
}) {
  const channel = String(normalizedMessage.channel || 'email').toLowerCase();
  const target = threadingEvaluation?.target || null;

  if (threadingEvaluation?.matched && target?.conversationId) {
    const byId = await MailroomConversation.findOne({
      _id: target.conversationId,
      organizationId
    });
    if (byId) return { conversation: byId, resolution: 'threading_target' };
  }

  const externalThreadId = String(
    normalizedMessage.threadId || normalizedMessage.metadata?.providerThreadId || ''
  ).trim();
  if (externalThreadId) {
    const byThread = await MailroomConversation.findOne({
      organizationId,
      channel,
      externalThreadId
    });
    if (byThread) return { conversation: byThread, resolution: 'external_thread_id' };
  }

  if (threadingEvaluation?.matched && target?.caseId) {
    const byCase = await MailroomConversation.findOne({
      organizationId,
      primaryCaseId: target.caseId
    })
      .sort({ lastMessageAt: -1 });
    if (byCase) return { conversation: byCase, resolution: 'primary_case_id' };
  }

  return { conversation: null, resolution: null };
}

async function createConversation({ organizationId, normalizedMessage, primaryCaseId = null }) {
  const from = getFromAddress(normalizedMessage);
  const externalThreadId = String(normalizedMessage.threadId || '').trim() || null;
  const receivedAt = normalizedMessage.receivedAt
    ? new Date(normalizedMessage.receivedAt)
    : new Date();

  return MailroomConversation.create({
    organizationId,
    channel: String(normalizedMessage.channel || 'email').toLowerCase(),
    externalThreadId,
    subject: normalizedMessage.subject || '',
    lastFromAddress: from,
    lastSubject: normalizedMessage.subject || '',
    primaryCaseId: primaryCaseId || null,
    relatedCaseIds: primaryCaseId ? [primaryCaseId] : [],
    status: 'open',
    lastMessageAt: receivedAt
  });
}

async function touchConversation(conversation, normalizedMessage, linkedCaseId = null) {
  const from = getFromAddress(normalizedMessage);
  const receivedAt = normalizedMessage.receivedAt
    ? new Date(normalizedMessage.receivedAt)
    : new Date();
  const updates = {
    lastFromAddress: from || conversation.lastFromAddress,
    lastSubject: normalizedMessage.subject || conversation.lastSubject,
    lastMessageAt: receivedAt,
    subject: conversation.subject || normalizedMessage.subject || ''
  };

  if (linkedCaseId && !conversation.primaryCaseId) {
    updates.primaryCaseId = linkedCaseId;
    updates.relatedCaseIds = [
      ...new Set([
        ...(conversation.relatedCaseIds || []).map(String),
        String(linkedCaseId)
      ])
    ];
  }

  await MailroomConversation.updateOne({ _id: conversation._id }, { $set: updates });
  return MailroomConversation.findById(conversation._id);
}

/**
 * M2: persist conversation + message + threading audit log after policy evaluation.
 */
async function persistInboundConversationMessage({
  organizationId,
  normalizedMessage,
  threadingEvaluation,
  rawPayloadId = null,
  linkedCommunicationId = null,
  linkedCaseId = null
}) {
  const externalId = String(normalizedMessage.externalMessageId || '').trim();
  if (externalId) {
    const existing = await MailroomMessage.findOne({ organizationId, externalMessageId: externalId }).lean();
    if (existing) {
      const conversation = await MailroomConversation.findById(existing.conversationId).lean();
      return {
        conversation,
        message: existing,
        threadingLog: null,
        conversationCreated: false,
        duplicate: true
      };
    }
  }

  let { conversation, resolution } = await resolveConversationForThreading({
    organizationId,
    normalizedMessage,
    threadingEvaluation
  });
  let conversationCreated = false;

  const caseIdFromThread =
    threadingEvaluation?.target?.caseId || linkedCaseId || null;

  if (!conversation) {
    conversation = await createConversation({
      organizationId,
      normalizedMessage,
      primaryCaseId: caseIdFromThread
    });
    conversationCreated = true;
    resolution = 'new_conversation';
  } else {
    conversation = await touchConversation(conversation, normalizedMessage, linkedCaseId);
  }

  const receivedAt = normalizedMessage.receivedAt
    ? new Date(normalizedMessage.receivedAt)
    : new Date();

  const message = await MailroomMessage.create({
    organizationId,
    conversationId: conversation._id,
    rawPayloadId: rawPayloadId || null,
    channel: String(normalizedMessage.channel || 'email').toLowerCase(),
    direction: normalizedMessage.direction || 'inbound',
    externalMessageId: externalId || null,
    threadId: normalizedMessage.threadId || null,
    inReplyTo: normalizedMessage.inReplyTo || null,
    references: normalizedMessage.references || null,
    subject: normalizedMessage.subject || '',
    body: normalizedMessage.body || '',
    htmlBody: normalizedMessage.htmlBody || null,
    participants: normalizedMessage.participants || {},
    attachmentIds: [],
    linkedCaseId: linkedCaseId || caseIdFromThread || null,
    linkedCommunicationId: linkedCommunicationId || null,
    receivedAt,
    metadata: {
      threadingMatched: Boolean(threadingEvaluation?.matched),
      threadingSignal: threadingEvaluation?.signal || null
    }
  });

  // Attachments: resolve + link after message exists (no binaries in Mongo).
  try {
    const { resolveAndLinkAttachments } = require('./attachmentService');
    const ids = await resolveAndLinkAttachments({
      organizationId,
      normalizedMessage,
      conversationId: conversation._id,
      messageId: message._id
    });
    if (ids?.length) {
      await MailroomMessage.updateOne(
        { _id: message._id, organizationId },
        { $set: { attachmentIds: ids } }
      );
      message.attachmentIds = ids;
    }
  } catch {
    // Best-effort: don't fail ingestion due to attachment linkage.
  }

  const threadingLog = await MailroomThreadingLog.create({
    organizationId,
    conversationId: conversation._id,
    mailroomMessageId: message._id,
    rawPayloadId: rawPayloadId || null,
    matched: Boolean(threadingEvaluation?.matched),
    strategyId: threadingEvaluation?.strategyId || '',
    signal: threadingEvaluation?.signal || '',
    target: threadingEvaluation?.target || null,
    trace: threadingEvaluation?.trace || [],
    fallback: threadingEvaluation?.fallback || null,
    resolution: resolution || ''
  });

  return {
    conversation,
    message,
    threadingLog,
    conversationCreated,
    duplicate: false
  };
}

async function listConversations(organizationId, { limit = 25, channel = null } = {}) {
  const query = { organizationId };
  if (channel) query.channel = String(channel).toLowerCase();
  return MailroomConversation.find(query)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 25, 1), 100))
    .lean();
}

async function getConversationWithMessages(organizationId, conversationId) {
  const conversation = await MailroomConversation.findOne({
    _id: conversationId,
    organizationId
  }).lean();
  if (!conversation) return null;

  const messages = await MailroomMessage.find({
    organizationId,
    conversationId
  })
    .sort({ receivedAt: 1, createdAt: 1 })
    .lean();

  return { conversation, messages };
}

async function listThreadingLogs(organizationId, { limit = 30, conversationId = null } = {}) {
  const query = { organizationId };
  if (conversationId) query.conversationId = conversationId;
  return MailroomThreadingLog.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 30, 1), 100))
    .lean();
}

module.exports = {
  getFromAddress,
  normalizeSubject,
  evaluateThreadingSignal,
  persistInboundConversationMessage,
  listConversations,
  getConversationWithMessages,
  listThreadingLogs
};

'use strict';

const MailroomMessage = require('../../../models/MailroomMessage');
const MailroomConversation = require('../../../models/MailroomConversation');
const { getFromAddress } = require('./conversationPersistenceService');
const { loadAttachmentSummaries } = require('./caseActivityAttachmentService');
const { messageBodyText } = require('./caseTimelineText');

const MESSAGE_ACTIVITY_TYPES = new Set([
  'email_received',
  'channel_message_received',
  'email_sent',
  'agent_message',
  'comment',
  'message_sent',
  'message'
]);

function resolveActorName(msg) {
  const from = getFromAddress(msg.participants || msg);
  if (typeof from === 'string' && from) return from;
  if (from && typeof from === 'object') {
    const name = String(from.name || '').trim();
    const addr = String(from.address || from.email || '').trim();
    if (name && addr) return `${name} <${addr}>`;
    return name || addr || 'Customer';
  }
  return msg.direction === 'outbound' ? 'Agent' : 'Customer';
}

function mapMailroomMessageToActivity(msg, attachmentSummaries = []) {
  const isOutbound = String(msg.direction || '').toLowerCase() === 'outbound';
  const internal = msg.metadata?.internal === true;
  return {
    _id: `mailroom:${msg._id}`,
    activityType: isOutbound ? 'agent_message' : 'channel_message_received',
    message: messageBodyText(msg) || msg.subject || '—',
    channel: msg.channel || null,
    internal,
    metadata: {
      mailroomMessageId: String(msg._id),
      mailroomAttachments: attachmentSummaries,
      source: 'mailroom',
      subject: msg.subject || null,
      externalMessageId: msg.externalMessageId || null
    },
    actorId: null,
    actorName: resolveActorName(msg),
    createdAt: msg.receivedAt || msg.createdAt || new Date()
  };
}

function isMessageActivity(activity) {
  const type = String(activity?.activityType || '').trim();
  return MESSAGE_ACTIVITY_TYPES.has(type);
}

function activityMailroomId(activity) {
  return activity?.metadata?.mailroomMessageId
    ? String(activity.metadata.mailroomMessageId)
    : null;
}

/**
 * Merge embedded case activities with Mailroom messages (mailroom is authoritative for body/attachments).
 */
async function buildCaseTimelineActivities(organizationId, caseId, embeddedActivities = []) {
  if (!organizationId || !caseId) {
    return Array.isArray(embeddedActivities) ? embeddedActivities : [];
  }

  const conversationIds = await MailroomConversation.find({
    organizationId,
    primaryCaseId: caseId
  })
    .distinct('_id');

  const messageQuery = {
    organizationId,
    $or: [{ linkedCaseId: caseId }]
  };
  if (conversationIds.length) {
    messageQuery.$or.push({ conversationId: { $in: conversationIds } });
  }

  const messages = await MailroomMessage.find(messageQuery)
    .sort({ receivedAt: 1, createdAt: 1 })
    .lean();

  if (!messages.length) {
    return embeddedActivities;
  }

  const allAttachmentIds = new Set();
  for (const msg of messages) {
    for (const id of msg.attachmentIds || []) {
      if (id) allAttachmentIds.add(String(id));
    }
  }
  const summaryById = new Map();
  const summaries = await loadAttachmentSummaries(organizationId, [...allAttachmentIds]);
  for (const s of summaries) summaryById.set(s.id, s);

  const mailroomActivities = messages.map((msg) => {
    const ids = (msg.attachmentIds || []).map(String).filter(Boolean);
    const att = ids.map((id) => summaryById.get(id)).filter(Boolean);
    return mapMailroomMessageToActivity(msg, att);
  });

  const mailroomById = new Map(
    mailroomActivities.map((a) => [String(a.metadata.mailroomMessageId), a])
  );
  const consumedMailroomIds = new Set();

  const merged = [];

  for (const raw of embeddedActivities) {
    const act = typeof raw.toObject === 'function' ? raw.toObject() : { ...raw };
    const msgId = activityMailroomId(act);

    if (msgId && mailroomById.has(msgId)) {
      merged.push(mailroomById.get(msgId));
      consumedMailroomIds.add(msgId);
      continue;
    }

    if (isMessageActivity(act) && !msgId) {
      const preview = String(act.metadata?.bodyPreview || act.message || '').slice(0, 80);
      const duplicate = mailroomActivities.find((m) => {
        if (consumedMailroomIds.has(String(m.metadata.mailroomMessageId))) return false;
        const body = String(m.message || '').slice(0, 80);
        return preview && body && (body.includes(preview) || preview.includes(body));
      });
      if (duplicate) {
        merged.push(duplicate);
        consumedMailroomIds.add(String(duplicate.metadata.mailroomMessageId));
        continue;
      }
    }

    merged.push(act);
  }

  for (const m of mailroomActivities) {
    const id = String(m.metadata.mailroomMessageId);
    if (!consumedMailroomIds.has(id)) {
      merged.push(m);
    }
  }

  merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return merged;
}

module.exports = {
  buildCaseTimelineActivities,
  mapMailroomMessageToActivity
};

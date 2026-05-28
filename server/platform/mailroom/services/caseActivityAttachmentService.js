const Case = require('../../../models/Case');
const MailroomAttachment = require('../../../models/MailroomAttachment');
const MailroomMessage = require('../../../models/MailroomMessage');
const { messageBodyText } = require('./caseTimelineText');

async function loadAttachmentSummaries(organizationId, attachmentIds = []) {
  const ids = [...new Set(attachmentIds.map(String).filter(Boolean))];
  if (!ids.length) return [];

  const rows = await MailroomAttachment.find({
    organizationId,
    _id: { $in: ids },
    status: { $ne: 'deleted' }
  })
    .select('_id originalFileName mimeType sizeBytes status')
    .lean();

  return rows.map((r) => ({
    id: String(r._id),
    originalFileName: r.originalFileName || 'attachment',
    mimeType: r.mimeType || 'application/octet-stream',
    sizeBytes: r.sizeBytes || 0,
    status: r.status
  }));
}

/**
 * After Mailroom persists a message, attach metadata to the latest inbound case activity.
 */
async function syncCaseActivityMailroomMetadata({
  organizationId,
  caseId,
  mailroomMessageId,
  attachmentIds = []
}) {
  if (!organizationId || !caseId || !mailroomMessageId) return;

  const caseRecord = await Case.findOne({
    _id: caseId,
    organizationId,
    deletedAt: null
  });
  if (!caseRecord?.activities?.length) return;

  const mailroomAttachments = await loadAttachmentSummaries(organizationId, attachmentIds);
  const mailroomMsg = await MailroomMessage.findOne({
    _id: mailroomMessageId,
    organizationId
  }).lean();

  for (let i = caseRecord.activities.length - 1; i >= 0; i -= 1) {
    const act = caseRecord.activities[i];
    const type = String(act.activityType || '');
    if (type !== 'email_received' && type !== 'channel_message_received') continue;
    if (act.metadata?.mailroomMessageId) continue;

    const bodyText = mailroomMsg ? messageBodyText(mailroomMsg) : '';
    if (bodyText) {
      act.message = bodyText;
    }
    if (mailroomMsg?.channel) {
      act.channel = mailroomMsg.channel;
    }
    act.metadata = {
      ...(act.metadata || {}),
      mailroomMessageId: String(mailroomMessageId),
      mailroomAttachments
    };
    await caseRecord.save();
    return;
  }
}

/**
 * Enrich case activities for API responses (backfill when metadata missing).
 */
async function enrichCaseActivitiesWithMailroomAttachments(organizationId, activities, caseId) {
  if (!organizationId || !caseId || !Array.isArray(activities) || !activities.length) {
    return activities;
  }

  const MailroomMessage = require('../../../models/MailroomMessage');
  const messages = await MailroomMessage.find({
    organizationId,
    linkedCaseId: caseId
  })
    .select('_id attachmentIds receivedAt')
    .lean();

  if (!messages.length) return activities;

  const allIds = new Set();
  for (const msg of messages) {
    for (const id of msg.attachmentIds || []) {
      if (id) allIds.add(String(id));
    }
  }

  const summaryById = new Map();
  const summaries = await loadAttachmentSummaries(organizationId, [...allIds]);
  for (const s of summaries) summaryById.set(s.id, s);

  const byMessageId = new Map();
  for (const msg of messages) {
    const ids = (msg.attachmentIds || []).map(String).filter(Boolean);
    if (!ids.length) continue;
    byMessageId.set(
      String(msg._id),
      ids.map((id) => summaryById.get(id)).filter(Boolean)
    );
  }

  return activities.map((act) => {
    const plain = typeof act.toObject === 'function' ? act.toObject() : { ...act };
    const msgId = plain.metadata?.mailroomMessageId;
    if (msgId && byMessageId.has(String(msgId))) {
      plain.metadata = {
        ...(plain.metadata || {}),
        mailroomAttachments: byMessageId.get(String(msgId))
      };
    } else if (
      Array.isArray(plain.metadata?.mailroomAttachments)
      && plain.metadata.mailroomAttachments.length
    ) {
      // already synced on ingest
    }
    return plain;
  });
}

module.exports = {
  loadAttachmentSummaries,
  syncCaseActivityMailroomMetadata,
  enrichCaseActivitiesWithMailroomAttachments
};

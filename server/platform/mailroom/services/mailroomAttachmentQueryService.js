const mongoose = require('mongoose');
const MailroomAttachment = require('../../../models/MailroomAttachment');
const MailroomMessage = require('../../../models/MailroomMessage');
const MailroomConversation = require('../../../models/MailroomConversation');

function serializeMailroomAttachment(row) {
  if (!row) return null;
  return {
    attachmentId: row._id,
    originalFileName: row.originalFileName || '',
    mimeType: row.mimeType || 'application/octet-stream',
    sizeBytes: row.sizeBytes || 0,
    status: row.status,
    source: row.source || null,
    linkedConversationId: row.linkedConversationId || null,
    linkedMessageId: row.linkedMessageId || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function listAttachmentsByIds(organizationId, attachmentIds) {
  const ids = (attachmentIds || [])
    .map((id) => String(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return [];

  const rows = await MailroomAttachment.find({
    organizationId,
    _id: { $in: ids },
    status: { $ne: 'deleted' }
  })
    .sort({ createdAt: 1 })
    .lean();

  return rows.map(serializeMailroomAttachment);
}

async function listAttachmentsForConversation(organizationId, conversationId) {
  if (!mongoose.Types.ObjectId.isValid(String(conversationId))) {
    const err = new Error('Invalid conversationId');
    err.statusCode = 400;
    throw err;
  }

  const conversation = await MailroomConversation.findOne({
    _id: conversationId,
    organizationId
  }).lean();
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  const rows = await MailroomAttachment.find({
    organizationId,
    linkedConversationId: conversationId,
    status: { $ne: 'deleted' }
  })
    .sort({ createdAt: 1 })
    .lean();

  return {
    conversationId,
    primaryCaseId: conversation.primaryCaseId || null,
    attachments: rows.map(serializeMailroomAttachment)
  };
}

async function listAttachmentsForMessage(organizationId, messageId) {
  if (!mongoose.Types.ObjectId.isValid(String(messageId))) {
    const err = new Error('Invalid messageId');
    err.statusCode = 400;
    throw err;
  }

  const message = await MailroomMessage.findOne({
    _id: messageId,
    organizationId
  }).lean();
  if (!message) {
    const err = new Error('Message not found');
    err.statusCode = 404;
    throw err;
  }

  const attachmentIds = message.attachmentIds || [];
  const attachments = await listAttachmentsByIds(organizationId, attachmentIds);

  return {
    messageId,
    conversationId: message.conversationId,
    linkedCaseId: message.linkedCaseId || null,
    attachments
  };
}

module.exports = {
  serializeMailroomAttachment,
  listAttachmentsByIds,
  listAttachmentsForConversation,
  listAttachmentsForMessage
};

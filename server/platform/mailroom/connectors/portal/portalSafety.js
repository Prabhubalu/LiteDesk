const mongoose = require('mongoose');
const MailroomAttachment = require('../../../../models/MailroomAttachment');
const MailroomMessage = require('../../../../models/MailroomMessage');
const MailroomConversation = require('../../../../models/MailroomConversation');
const mailroomConfigService = require('../../../../services/mailroomConfigService');

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getPortalUserEmail(user) {
  return normalizeEmail(user?.email);
}

async function assertPortalUserCanAccessCase({ organizationId, caseId, user, portalConfig }) {
  if (!mongoose.Types.ObjectId.isValid(String(caseId))) {
    const err = new Error('Invalid caseId');
    err.statusCode = 400;
    throw err;
  }

  let resolvedPortalConfig = portalConfig;
  if (!resolvedPortalConfig) {
    const mailroomConfig = await mailroomConfigService.getOrCreateConfig(organizationId);
    resolvedPortalConfig = mailroomConfig?.connectors?.portal;
  }

  const { findPortalAccessibleCase } = require('../../../../services/portalCaseAccessService');
  const caseRow = await findPortalAccessibleCase(organizationId, caseId, user, {
    portalConfig: resolvedPortalConfig
  });
  if (!caseRow) {
    const err = new Error('You do not have access to this case');
    err.statusCode = 403;
    throw err;
  }
  return caseRow;
}

async function assertPortalUserCanAccessConversation({ organizationId, conversationId, user }) {
  const conversation = await MailroomConversation.findOne({
    _id: conversationId,
    organizationId
  })
    .select('_id primaryCaseId relatedCaseIds')
    .lean();
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  const caseIds = [
    conversation.primaryCaseId,
    ...(conversation.relatedCaseIds || [])
  ].filter(Boolean);

  for (const caseId of caseIds) {
    try {
      await assertPortalUserCanAccessCase({ organizationId, caseId, user });
      return conversation;
    } catch (error) {
      if (error.statusCode !== 403) throw error;
    }
  }

  const err = new Error('You do not have access to this conversation');
  err.statusCode = 403;
  throw err;
}

async function assertPortalUserCanAccessAttachment({ organizationId, attachmentId, user }) {
  const row = await MailroomAttachment.findOne({
    _id: attachmentId,
    organizationId,
    status: { $ne: 'deleted' }
  }).lean();
  if (!row) {
    const err = new Error('Attachment not found');
    err.statusCode = 404;
    throw err;
  }

  if (row.uploadedByUserId && String(row.uploadedByUserId) === String(user?._id)) {
    return row;
  }

  if (row.linkedMessageId) {
    const message = await MailroomMessage.findOne({
      _id: row.linkedMessageId,
      organizationId
    })
      .select('linkedCaseId conversationId metadata')
      .lean();
    if (message?.metadata?.portalUserId && String(message.metadata.portalUserId) === String(user?._id)) {
      return row;
    }
    if (message?.linkedCaseId) {
      await assertPortalUserCanAccessCase({
        organizationId,
        caseId: message.linkedCaseId,
        user
      });
      return row;
    }
    if (message?.conversationId) {
      await assertPortalUserCanAccessConversation({
        organizationId,
        conversationId: message.conversationId,
        user
      });
      return row;
    }
  }

  const err = new Error('You do not have access to this attachment');
  err.statusCode = 403;
  throw err;
}

/** Strip internal policy/engine details from connector responses shown to portal users. */
function sanitizePortalIngestResponse(data) {
  if (!data || typeof data !== 'object') return data;
  const caseLink = data.caseLink || data.caseResult || null;
  return {
    mailroom: data.mailroom === true,
    idempotent: data.idempotent === true,
    rawPayloadId: data.rawPayloadId || null,
    messageId: data.messageId
      || data.conversation?.message?._id
      || data.conversationResult?.message?._id
      || null,
    conversationId: data.conversationId
      || data.conversation?.conversation?._id
      || data.conversationResult?.conversation?._id
      || null,
    linkedCaseId: data.linkedCaseId
      || caseLink?.caseId
      || data.conversation?.message?.linkedCaseId
      || null,
    caseLink: caseLink
      ? {
        executed: caseLink.executed === true,
        action: caseLink.action || null,
        caseId: caseLink.caseId || null
      }
      : null
  };
}

module.exports = {
  normalizeEmail,
  getPortalUserEmail,
  assertPortalUserCanAccessCase,
  assertPortalUserCanAccessConversation,
  assertPortalUserCanAccessAttachment,
  sanitizePortalIngestResponse
};

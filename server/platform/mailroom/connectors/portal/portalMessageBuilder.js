const { v4: uuidv4 } = require('uuid');
const MailroomConversation = require('../../../../models/MailroomConversation');
const { validateAndNormalizeIngestMessage } = require('../publicApi/ingestValidator');
const { resolvePortalAudience, getMailroomChannelKey } = require('./portalAudience');
const { mergePortalConnector } = require('./portalConnectorDefaults');
const mailroomConfigService = require('../../../../services/mailroomConfigService');

async function resolveConversationIdForCase(organizationId, caseId) {
  const row = await MailroomConversation.findOne({
    organizationId,
    primaryCaseId: caseId
  })
    .sort({ lastMessageAt: -1 })
    .select('_id externalThreadId')
    .lean();
  return row?._id ? String(row._id) : null;
}

/**
 * Build a validated Mailroom message for portal case create/reply.
 * Supplies idempotency key and thread/conversation hints when the client omits them.
 */
async function buildPortalCaseMailroomMessage(input = {}, {
  organizationId,
  caseId,
  user,
  subjectFallback = '',
  portalAudience = null,
  portalConfig = null,
  metadataAllowKeys = ['caseId', 'portalUserId', 'portalUserEmail', 'portalAudience', 'channel']
} = {}) {
  const raw = input && typeof input === 'object' ? input : {};
  const caseIdStr = String(caseId);
  const userEmail = user?.email || raw.participants?.from || null;

  let audience = portalAudience;
  if (!audience && organizationId) {
    let connector = portalConfig;
    if (!connector) {
      const mailroomConfig = await mailroomConfigService.getOrCreateConfig(organizationId);
      connector = mailroomConfig?.connectors?.portal;
    }
    audience = await resolvePortalAudience(user, mergePortalConnector(connector || {}));
  }
  audience = audience || 'customer';
  const channelKey = getMailroomChannelKey(audience);

  let conversationId = raw.conversationId || null;
  if (!conversationId && organizationId) {
    conversationId = await resolveConversationIdForCase(organizationId, caseIdStr);
  }

  const externalMessageId =
    raw.externalMessageId
    || raw.messageId
    || `portal-${caseIdStr}-${uuidv4()}`;

  const threadId =
    raw.threadId
    || (conversationId ? null : `portal-case:${caseIdStr}`);

  return validateAndNormalizeIngestMessage({
    ...raw,
    channel: channelKey,
    externalMessageId,
    conversationId: conversationId || undefined,
    threadId: threadId || undefined,
    subject: String(raw.subject || subjectFallback || '').trim(),
    body: String(raw.body || '').trim(),
    participants: {
      ...(raw.participants || {}),
      from: userEmail
    },
    metadata: {
      ...(raw.metadata || {}),
      caseId: caseIdStr,
      portalUserId: String(user?._id || ''),
      portalUserEmail: String(userEmail || ''),
      portalAudience: audience,
      channel: channelKey
    }
  }, {
    defaultChannel: channelKey,
    metadataAllowKeys
  });
}

module.exports = {
  buildPortalCaseMailroomMessage,
  resolveConversationIdForCase
};

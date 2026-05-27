const { v4: uuidv4 } = require('uuid');
const { validateAndNormalizeIngestMessage } = require('../publicApi/ingestValidator');

/**
 * Build a validated Mailroom message for Live Chat.
 *
 * The chat system may not have email-style thread IDs; we use `chat-session:<id>` as `threadId`
 * when a conversationId is not provided.
 */
async function buildChatMailroomMessage(input = {}, {
  sessionId,
  subjectFallback = 'Live chat',
  metadataAllowKeys = [
    'caseId',
    'linkedCaseId',
    'chatSessionId',
    'chatVisitorId',
    'chatAgentUserId',
    'source'
  ]
} = {}) {
  const raw = input && typeof input === 'object' ? input : {};
  const chatSessionId = String(sessionId || raw.metadata?.chatSessionId || '').trim() || null;

  const externalMessageId =
    raw.externalMessageId
    || raw.messageId
    || (chatSessionId ? `chat-${chatSessionId}-${uuidv4()}` : `chat-${uuidv4()}`);

  const threadId =
    raw.threadId
    || raw.conversationId
    ? null
    : (chatSessionId ? `chat-session:${chatSessionId}` : null);

  return validateAndNormalizeIngestMessage({
    ...raw,
    channel: 'chat',
    externalMessageId,
    threadId: threadId || undefined,
    subject: String(raw.subject || subjectFallback || '').trim(),
    body: String(raw.body || '').trim(),
    metadata: {
      ...(raw.metadata || {}),
      chatSessionId: chatSessionId || undefined
    }
  }, {
    defaultChannel: 'chat',
    metadataAllowKeys
  });
}

module.exports = {
  buildChatMailroomMessage
};


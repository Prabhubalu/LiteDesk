'use strict';

const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const { buildChatSessionScopeFilter } = require('../utils/liveChatSessionQueryUtils');

function sanitizeSessionForExport(row) {
  if (!row) return null;
  return {
    _id: row._id,
    sessionKey: row.sessionKey || null,
    status: row.status || null,
    lifecycleStatus: row.lifecycleStatus || null,
    outcome: row.outcome || null,
    channel: row.channel || null,
    visitor: row.visitor || {},
    subject: row.subject || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    summary: row.summary || '',
    csatScore: typeof row.csatScore === 'number' ? row.csatScore : null,
    feedbackComment: row.feedbackComment || '',
    consentGiven: Boolean(row.consentGiven),
    consentTimestamp: row.consentTimestamp || null,
    sessionArchived: Boolean(row.sessionArchived),
    archiveDate: row.archiveDate || null,
    exported: Boolean(row.exported),
    createdAt: row.createdAt || null,
    endedAt: row.endedAt || null,
    lastMessageAt: row.lastMessageAt || null,
  };
}

function sanitizeMessageForExport(row) {
  if (!row) return null;
  return {
    _id: row._id,
    direction: row.direction,
    authorType: row.authorType,
    authorName: row.authorName || '',
    body: row.body || '',
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    deliveredAt: row.deliveredAt || null,
    readAt: row.readAt || null,
    createdAt: row.createdAt || null,
  };
}

async function loadSessionForOrg(sessionId, organizationId) {
  const scope = buildChatSessionScopeFilter(organizationId);
  return ChatSession.findOne({ _id: sessionId, ...scope }).lean();
}

async function archiveSession({ organizationId, sessionId, archived = true }) {
  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) {
    const err = new Error('Session not found');
    err.statusCode = 404;
    throw err;
  }

  const archiveDate = archived ? new Date() : null;
  const scope = buildChatSessionScopeFilter(organizationId);
  await ChatSession.updateOne(
    { _id: sessionId, ...scope },
    {
      $set: {
        sessionArchived: archived === true,
        archiveDate,
        updatedAt: new Date(),
      },
    },
  );

  return {
    sessionId,
    sessionArchived: archived === true,
    archiveDate,
  };
}

async function buildSessionTranscriptExport({ organizationId, sessionId, markExported = true }) {
  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) {
    const err = new Error('Session not found');
    err.statusCode = 404;
    throw err;
  }

  const messages = await ChatMessage.find({ sessionId: session._id })
    .sort({ createdAt: 1 })
    .lean();

  if (markExported) {
    const scope = buildChatSessionScopeFilter(organizationId);
    await ChatSession.updateOne(
      { _id: session._id, ...scope },
      { $set: { exported: true, updatedAt: new Date() } },
    );
  }

  return {
    exportedAt: new Date().toISOString(),
    session: sanitizeSessionForExport(session),
    messages: messages.map(sanitizeMessageForExport).filter(Boolean),
  };
}

async function buildOrganizationTranscriptExport({
  organizationId,
  status = 'closed',
  limit = 200,
  markExported = false,
}) {
  const scope = buildChatSessionScopeFilter(organizationId);
  const filter = { ...scope };
  if (status === 'open' || status === 'closed') {
    filter.status = status;
  }

  const sessions = await ChatSession.find(filter)
    .sort({ endedAt: -1, createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 200, 1), 500))
    .lean();

  const sessionIds = sessions.map((row) => row._id);
  const messages = sessionIds.length
    ? await ChatMessage.find({ sessionId: { $in: sessionIds } })
      .sort({ createdAt: 1 })
      .lean()
    : [];

  const messagesBySessionId = new Map();
  for (const message of messages) {
    const key = String(message.sessionId);
    if (!messagesBySessionId.has(key)) messagesBySessionId.set(key, []);
    messagesBySessionId.get(key).push(sanitizeMessageForExport(message));
  }

  if (markExported && sessionIds.length) {
    await ChatSession.updateMany(
      { _id: { $in: sessionIds }, ...scope },
      { $set: { exported: true, updatedAt: new Date() } },
    );
  }

  return {
    exportedAt: new Date().toISOString(),
    organizationId,
    sessionCount: sessions.length,
    sessions: sessions.map((row) => ({
      session: sanitizeSessionForExport(row),
      messages: messagesBySessionId.get(String(row._id)) || [],
    })),
  };
}

module.exports = {
  archiveSession,
  buildSessionTranscriptExport,
  buildOrganizationTranscriptExport,
  sanitizeSessionForExport,
};

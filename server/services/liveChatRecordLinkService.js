const mongoose = require('mongoose');
const ChatSession = require('../models/ChatSession');

const ALLOWED_MODULE_KEYS = new Set(['cases', 'people', 'deals', 'organizations']);

function normalizeModuleKey(moduleKey) {
  return String(moduleKey || '').trim().toLowerCase();
}

const {
  buildChatSessionScopeFilter,
  isValidSessionObjectId,
} = require('../utils/liveChatSessionQueryUtils');

async function loadSessionForOrg(sessionId, organizationId) {
  if (!isValidSessionObjectId(sessionId)) return null;
  const scope = buildChatSessionScopeFilter(organizationId);
  return ChatSession.findOne({ _id: sessionId, ...scope });
}

function hasExistingLink(session, moduleKey, recordId) {
  const mod = normalizeModuleKey(moduleKey);
  const rid = String(recordId || '');
  if (!mod || !rid) return false;
  return (session.linkedRecords || []).some(
    (row) => normalizeModuleKey(row?.moduleKey) === mod && String(row?.recordId) === rid,
  );
}

/**
 * Append a polymorphic business record link on a chat session (idempotent).
 */
async function linkSessionToRecord({
  organizationId,
  sessionId,
  moduleKey,
  recordId,
  linkType = 'linked',
  linkedBy = null,
}) {
  const mod = normalizeModuleKey(moduleKey);
  if (!ALLOWED_MODULE_KEYS.has(mod)) {
    const err = new Error(`Unsupported moduleKey: ${moduleKey}`);
    err.statusCode = 400;
    throw err;
  }
  if (!mongoose.Types.ObjectId.isValid(recordId)) {
    const err = new Error('Invalid recordId');
    err.statusCode = 400;
    throw err;
  }

  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) {
    const err = new Error('Chat session not found');
    err.statusCode = 404;
    throw err;
  }

  if (hasExistingLink(session, mod, recordId)) {
    return { session, linked: false };
  }

  const link = {
    moduleKey: mod,
    recordId,
    linkType: linkType === 'created' ? 'created' : 'linked',
    linkedAt: new Date(),
    ...(linkedBy ? { linkedBy } : {}),
  };

  await ChatSession.updateOne({ _id: session._id }, { $push: { linkedRecords: link } });

  const { syncSessionIdentityFromLinks } = require('./liveChatSessionIdentityService');
  await syncSessionIdentityFromLinks(session._id);

  const updated = await ChatSession.findById(session._id).lean();
  return { session: updated, linked: true, link };
}

module.exports = {
  linkSessionToRecord,
  loadSessionForOrg,
  ALLOWED_MODULE_KEYS,
};

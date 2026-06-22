'use strict';

const ChatSession = require('../models/ChatSession');
const {
  LIVE_CHAT_VISITOR_TYPES,
  normalizeVisitorType,
} = require('../constants/liveChatSessionIdentity');

function normalizeModuleKey(moduleKey) {
  return String(moduleKey || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function buildDenormalizedLinkFields(linkedRecords = []) {
  let linkedContactId = null;
  let linkedOrganizationId = null;

  for (const row of linkedRecords) {
    const mod = normalizeModuleKey(row?.moduleKey);
    if (mod === 'people' && row?.recordId && !linkedContactId) {
      linkedContactId = row.recordId;
    }
    if (mod === 'organizations' && row?.recordId && !linkedOrganizationId) {
      linkedOrganizationId = row.recordId;
    }
  }

  return { linkedContactId, linkedOrganizationId };
}

function resolveVisitorTypeAfterLink({ currentVisitorType, linkedRecords = [] }) {
  const explicit = normalizeVisitorType(currentVisitorType);
  if (explicit === LIVE_CHAT_VISITOR_TYPES.PARTNER) return explicit;

  const { linkedContactId } = buildDenormalizedLinkFields(linkedRecords);
  if (linkedContactId) {
    return LIVE_CHAT_VISITOR_TYPES.CUSTOMER;
  }

  return explicit;
}

async function syncSessionIdentityFromLinks(sessionId) {
  if (!sessionId) return null;

  const session = await ChatSession.findById(sessionId)
    .select('linkedRecords visitorType visitor')
    .lean();
  if (!session) return null;

  const links = buildDenormalizedLinkFields(session.linkedRecords);
  const visitorType = resolveVisitorTypeAfterLink({
    currentVisitorType: session.visitorType,
    linkedRecords: session.linkedRecords,
  });

  const patch = {
    linkedContactId: links.linkedContactId,
    linkedOrganizationId: links.linkedOrganizationId,
    updatedAt: new Date(),
  };
  if (visitorType) patch.visitorType = visitorType;

  await ChatSession.updateOne({ _id: sessionId }, { $set: patch });
  return patch;
}

module.exports = {
  buildDenormalizedLinkFields,
  resolveVisitorTypeAfterLink,
  syncSessionIdentityFromLinks,
};

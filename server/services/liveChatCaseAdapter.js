const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const Case = require('../models/Case');
const User = require('../models/User');
const { isAppEnabledForOrg } = require('../utils/appAccessUtils');
const { APP_KEYS } = require('../constants/appKeys');
const { createCaseFromChannelInteraction } = require('./helpdeskChannelIngestionService');
const { linkSessionToRecord, loadSessionForOrg } = require('./liveChatRecordLinkService');

function buildSessionRefNote(session) {
  const key = String(session?.sessionKey || '').trim();
  const id = String(session?._id || '').trim();
  if (key) return `Live Chat session ${key}. View the full transcript in Live Chat → Sessions.`;
  if (id) return `Live Chat session ${id}. View the full transcript in Live Chat → Sessions.`;
  return 'Live Chat session linked. View the transcript in Live Chat → Sessions.';
}

function buildLiveChatCaseCustomFields(session, agentId = null) {
  return {
    liveChat: {
      sessionId: String(session._id),
      sessionKey: session.sessionKey || null,
      outcome: session.outcome || null,
      agentId: agentId ? String(agentId) : session.endedByAgentId ? String(session.endedByAgentId) : null,
      linkedAt: new Date().toISOString(),
      source: 'live_chat_addon',
    },
  };
}

async function assertHelpdeskAvailable(organizationId) {
  const org = await Organization.findById(organizationId).select('enabledApps').lean();
  if (!org || !isAppEnabledForOrg(org, APP_KEYS.HELPDESK)) {
    const err = new Error('Helpdesk is not enabled for this organization');
    err.statusCode = 403;
    err.code = 'HELPDESK_NOT_ENABLED';
    throw err;
  }
}

async function resolveActorObjectId(actorId, organizationId) {
  if (!actorId || !mongoose.Types.ObjectId.isValid(actorId)) return null;
  const exists = await User.exists({ _id: actorId, organizationId });
  return exists ? actorId : null;
}

/**
 * Create a Helpdesk case from a live chat session (reference only — no transcript body).
 */
async function createCaseFromLiveChatSession({
  organizationId,
  sessionId,
  actorId = null,
  title = null,
}) {
  await assertHelpdeskAvailable(organizationId);

  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) {
    const err = new Error('Chat session not found');
    err.statusCode = 404;
    throw err;
  }

  const sessionLean = session.toObject ? session.toObject() : session;
  const visitorName = String(sessionLean.visitor?.name || '').trim() || 'Visitor';
  const sessionKey = String(sessionLean.sessionKey || '').trim();
  const subject =
    String(title || '').trim() ||
    (sessionKey ? `Live Chat — ${visitorName} (${sessionKey})` : `Live Chat — ${visitorName}`);

  const actorObjectId = await resolveActorObjectId(actorId, organizationId);
  const caseRecord = await createCaseFromChannelInteraction({
    organizationId,
    actorId: actorObjectId,
    channel: 'Live Chat',
    subject,
    message: buildSessionRefNote(sessionLean),
    externalReference: sessionKey || String(sessionLean._id),
    links: {},
  });

  const customFields = buildLiveChatCaseCustomFields(sessionLean, actorObjectId);
  await Case.updateOne(
    { _id: caseRecord._id, organizationId },
    { $set: { 'customFields.liveChat': customFields.liveChat } },
  );

  await linkSessionToRecord({
    organizationId,
    sessionId: sessionLean._id,
    moduleKey: 'cases',
    recordId: caseRecord._id,
    linkType: 'created',
    linkedBy: actorObjectId,
  });

  return {
    caseRecord,
    sessionId: String(sessionLean._id),
    caseId: String(caseRecord._id),
  };
}

/**
 * Link an existing case to a session and store session ref on the case.
 */
async function linkExistingCaseToSession({
  organizationId,
  sessionId,
  caseId,
  actorId = null,
}) {
  await assertHelpdeskAvailable(organizationId);

  if (!mongoose.Types.ObjectId.isValid(caseId)) {
    const err = new Error('Invalid case id');
    err.statusCode = 400;
    throw err;
  }

  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) {
    const err = new Error('Chat session not found');
    err.statusCode = 404;
    throw err;
  }

  const caseRecord = await Case.findOne({
    _id: caseId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!caseRecord) {
    const err = new Error('Case not found');
    err.statusCode = 404;
    throw err;
  }

  const sessionLean = session.toObject ? session.toObject() : session;
  const actorObjectId = await resolveActorObjectId(actorId, organizationId);
  const customFields = buildLiveChatCaseCustomFields(sessionLean, actorObjectId);

  await Case.updateOne(
    { _id: caseRecord._id, organizationId },
    { $set: { 'customFields.liveChat': customFields.liveChat } },
  );

  await linkSessionToRecord({
    organizationId,
    sessionId: sessionLean._id,
    moduleKey: 'cases',
    recordId: caseRecord._id,
    linkType: 'linked',
    linkedBy: actorObjectId,
  });

  return {
    caseId: String(caseRecord._id),
    sessionId: String(sessionLean._id),
  };
}

/**
 * Read-only session summary for case UI (no message bodies).
 */
async function getLiveChatSummaryForCase({ organizationId, caseRecord }) {
  const ref = caseRecord?.customFields?.liveChat;
  if (!ref?.sessionId) return null;

  const session = await loadSessionForOrg(ref.sessionId, organizationId);
  if (!session) {
    return {
      sessionId: ref.sessionId,
      sessionKey: ref.sessionKey || null,
      missing: true,
    };
  }

  const sessionLean = session.toObject ? session.toObject() : session;
  const createdAt = sessionLean.createdAt ? new Date(sessionLean.createdAt) : null;
  const endedAt = sessionLean.endedAt ? new Date(sessionLean.endedAt) : null;
  let durationSeconds = null;
  if (createdAt && endedAt) {
    durationSeconds = Math.max(0, Math.round((endedAt.getTime() - createdAt.getTime()) / 1000));
  }

  return {
    sessionId: String(sessionLean._id),
    sessionKey: sessionLean.sessionKey || ref.sessionKey || null,
    outcome: sessionLean.outcome || ref.outcome || null,
    lifecycleStatus: sessionLean.lifecycleStatus || null,
    status: sessionLean.status || null,
    durationSeconds,
    agentId: ref.agentId || (sessionLean.endedByAgentId ? String(sessionLean.endedByAgentId) : null),
    visitorName: String(sessionLean.visitor?.name || '').trim() || null,
    missing: false,
  };
}

async function syncLinkedCaseMetadataForSession({ organizationId, sessionId }) {
  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) return;

  const sessionLean = session.toObject ? session.toObject() : session;
  const caseLinks = (sessionLean.linkedRecords || []).filter(
    (row) => String(row?.moduleKey || '').toLowerCase() === 'cases' && row?.recordId,
  );
  if (!caseLinks.length) return;

  const patch = buildLiveChatCaseCustomFields(sessionLean);
  await Promise.all(
    caseLinks.map((link) =>
      Case.updateOne(
        { _id: link.recordId, organizationId },
        { $set: { 'customFields.liveChat': patch.liveChat } },
      ),
    ),
  );
}

module.exports = {
  createCaseFromLiveChatSession,
  linkExistingCaseToSession,
  getLiveChatSummaryForCase,
  buildLiveChatCaseCustomFields,
  syncLinkedCaseMetadataForSession,
};

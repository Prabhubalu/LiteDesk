const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const People = require('../models/People');
const ChatSession = require('../models/ChatSession');
const LiveChatVisitor = require('../models/LiveChatVisitor');
const User = require('../models/User');
const { isAppEnabledForOrg } = require('../utils/appAccessUtils');
const { APP_KEYS } = require('../constants/appKeys');
const { assignResolvedSource } = require('../services/sourceResolver');
const { computeAndSetDerivedStatus } = require('../services/derivedStatusService');
const { linkSessionToRecord, loadSessionForOrg } = require('./liveChatRecordLinkService');
const { buildChatSessionScopeFilter } = require('../utils/liveChatSessionQueryUtils');

function buildSessionRefNote(session) {
  const key = String(session?.sessionKey || '').trim();
  const id = String(session?._id || '').trim();
  if (key) return `Live Chat session ${key}. View the full transcript in Live Chat → Sessions.`;
  if (id) return `Live Chat session ${id}. View the full transcript in Live Chat → Sessions.`;
  return 'Live Chat session linked. View the transcript in Live Chat → Sessions.';
}

function splitVisitorName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { first_name: 'Visitor', last_name: '' };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function buildLiveChatPeopleCustomFields(session, agentId = null) {
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

async function assertSalesAvailable(organizationId) {
  const org = await Organization.findById(organizationId).select('enabledApps').lean();
  if (!org || !isAppEnabledForOrg(org, APP_KEYS.SALES)) {
    const err = new Error('Sales is not enabled for this organization');
    err.statusCode = 403;
    err.code = 'SALES_NOT_ENABLED';
    throw err;
  }
}

async function resolveActorObjectId(actorId, organizationId) {
  if (!actorId || !mongoose.Types.ObjectId.isValid(actorId)) return null;
  const exists = await User.exists({ _id: actorId, organizationId });
  return exists ? actorId : null;
}

async function appendVisitorLinkedRecord({
  organizationId,
  visitorId,
  moduleKey,
  recordId,
  linkType = 'linked',
}) {
  if (!visitorId || !mongoose.Types.ObjectId.isValid(visitorId)) return;

  const visitor = await LiveChatVisitor.findOne({ _id: visitorId, organizationId }).lean();
  if (!visitor) return;

  const mod = String(moduleKey || '').trim().toLowerCase();
  const rid = String(recordId || '');
  const exists = (visitor.linkedRecords || []).some(
    (row) => String(row?.moduleKey || '').toLowerCase() === mod && String(row?.recordId) === rid,
  );
  if (exists) return;

  await LiveChatVisitor.updateOne(
    { _id: visitorId, organizationId },
    {
      $push: {
        linkedRecords: {
          moduleKey: mod,
          recordId,
          linkType: linkType === 'created' ? 'created' : 'linked',
          linkedAt: new Date(),
        },
      },
    },
  );
}

async function findExistingPersonByEmail(organizationId, email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  return People.findOne({
    organizationId,
    email: normalized,
    deletedAt: null,
  }).lean();
}

function sessionHasPeopleLink(sessionLean) {
  return (sessionLean?.linkedRecords || []).some(
    (row) => String(row?.moduleKey || '').toLowerCase() === 'people' && row?.recordId,
  );
}

async function resolveExistingPersonForSession({ organizationId, sessionLean, visitorId }) {
  const email = String(sessionLean?.visitor?.email || '').trim().toLowerCase();
  if (email) {
    const byEmail = await findExistingPersonByEmail(organizationId, email);
    if (byEmail) return byEmail;
  }

  if (!visitorId) return null;

  const visitor = await LiveChatVisitor.findOne({ _id: visitorId, organizationId }).lean();
  const peopleLinks = (visitor?.linkedRecords || []).filter(
    (row) => String(row?.moduleKey || '').toLowerCase() === 'people' && row?.recordId,
  );
  if (!peopleLinks.length) return null;

  const latestLink = peopleLinks[peopleLinks.length - 1];
  return People.findOne({
    _id: latestLink.recordId,
    organizationId,
    deletedAt: null,
  }).lean();
}

async function applyPersonLinkToSession({
  organizationId,
  sessionLean,
  personRecord,
  actorId = null,
  linkType = 'linked',
}) {
  const actorObjectId = await resolveActorObjectId(actorId, organizationId);
  const customFields = buildLiveChatPeopleCustomFields(sessionLean, actorObjectId);

  await People.updateOne(
    { _id: personRecord._id, organizationId },
    { $set: { 'customFields.liveChat': customFields.liveChat } },
  );

  await linkSessionToRecord({
    organizationId,
    sessionId: sessionLean._id,
    moduleKey: 'people',
    recordId: personRecord._id,
    linkType,
    linkedBy: actorObjectId,
  });

  if (sessionLean.visitorId) {
    await appendVisitorLinkedRecord({
      organizationId,
      visitorId: sessionLean.visitorId,
      moduleKey: 'people',
      recordId: personRecord._id,
      linkType,
    });
  }

  return {
    personId: String(personRecord._id),
    sessionId: String(sessionLean._id),
  };
}

/**
 * Link session to an existing Sales person when visitor email or profile matches.
 * No-op when Sales is disabled, session is already linked, or no match is found.
 */
async function tryAutoLinkExistingPersonToSession({
  organizationId,
  sessionId,
  actorId = null,
}) {
  if (!organizationId || !sessionId) return null;

  const org = await Organization.findById(organizationId).select('enabledApps').lean();
  if (!org || !isAppEnabledForOrg(org, APP_KEYS.SALES)) return null;

  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) return null;

  const sessionLean = session.toObject ? session.toObject() : session;
  if (sessionHasPeopleLink(sessionLean)) return null;

  const personRecord = await resolveExistingPersonForSession({
    organizationId,
    sessionLean,
    visitorId: sessionLean.visitorId,
  });
  if (!personRecord) return null;

  const result = await applyPersonLinkToSession({
    organizationId,
    sessionLean,
    personRecord,
    actorId,
    linkType: 'linked',
  });

  return { ...result, autoLinked: true };
}

async function runPeopleAssignment({ organizationId, personId, actorId }) {
  try {
    const { runImmediateAssignmentForSalesRecord } = require('./assignmentExecutionService');
    const fresh = await People.findById(personId);
    if (!fresh) return;
    await runImmediateAssignmentForSalesRecord({
      record: fresh,
      moduleKey: 'people',
      appKey: APP_KEYS.SALES,
      actorId,
      triggerSource: 'immediate',
      changedFields: [],
      tenantOrganizationId: organizationId,
    });
  } catch (err) {
    console.warn('[liveChatCrmAdapter] assignment skipped:', err?.message || err);
  }
}

/**
 * Create or associate a Sales lead from a live chat session visitor (reference only).
 */
async function createLeadFromLiveChatSession({
  organizationId,
  sessionId,
  actorId = null,
}) {
  await assertSalesAvailable(organizationId);

  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) {
    const err = new Error('Chat session not found');
    err.statusCode = 404;
    throw err;
  }

  const sessionLean = session.toObject ? session.toObject() : session;
  const visitor = sessionLean.visitor || {};
  const actorObjectId = await resolveActorObjectId(actorId, organizationId);

  let personRecord = await resolveExistingPersonForSession({
    organizationId,
    sessionLean,
    visitorId: sessionLean.visitorId,
  });
  let linkType = personRecord ? 'linked' : 'created';

  if (!personRecord) {
    const email = String(visitor.email || '').trim().toLowerCase();
    const { first_name, last_name } = splitVisitorName(visitor.name);
    const createPayload = {
      organizationId,
      createdBy: actorObjectId,
      assignedTo: actorObjectId,
      first_name,
      last_name,
      email: email || undefined,
      phone: String(visitor.phone || '').trim() || undefined,
      participations: {
        SALES: {
          role: 'Lead',
          lead_status: 'New',
        },
      },
      activityLogs: [{
        user: 'Live Chat',
        userId: actorObjectId,
        action: 'record_created',
        message: 'Created from live chat session',
        details: { type: 'create', source: 'live_chat_addon', note: buildSessionRefNote(sessionLean) },
        timestamp: new Date(),
      }],
    };
    assignResolvedSource(createPayload, 'chat');
    personRecord = await People.create(createPayload);
    await computeAndSetDerivedStatus('people', personRecord, APP_KEYS.SALES);
    if (personRecord.isModified && personRecord.isModified()) {
      await personRecord.save();
    }
    await runPeopleAssignment({
      organizationId,
      personId: personRecord._id,
      actorId: actorObjectId,
    });
    personRecord = personRecord.toObject ? personRecord.toObject() : personRecord;
  }

  const linkResult = await applyPersonLinkToSession({
    organizationId,
    sessionLean,
    personRecord,
    actorId: actorObjectId,
    linkType,
  });

  return {
    ...linkResult,
    created: linkType === 'created',
    linked: true,
  };
}

async function linkExistingPersonToSession({
  organizationId,
  sessionId,
  personId,
  actorId = null,
}) {
  await assertSalesAvailable(organizationId);

  if (!mongoose.Types.ObjectId.isValid(personId)) {
    const err = new Error('Invalid person id');
    err.statusCode = 400;
    throw err;
  }

  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) {
    const err = new Error('Chat session not found');
    err.statusCode = 404;
    throw err;
  }

  const personRecord = await People.findOne({
    _id: personId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!personRecord) {
    const err = new Error('Person not found');
    err.statusCode = 404;
    throw err;
  }

  const sessionLean = session.toObject ? session.toObject() : session;

  return applyPersonLinkToSession({
    organizationId,
    sessionLean,
    personRecord,
    actorId,
    linkType: 'linked',
  });
}

async function syncLinkedPeopleMetadataForSession({ organizationId, sessionId }) {
  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) return;

  const sessionLean = session.toObject ? session.toObject() : session;
  const peopleLinks = (sessionLean.linkedRecords || []).filter(
    (row) => String(row?.moduleKey || '').toLowerCase() === 'people' && row?.recordId,
  );
  if (!peopleLinks.length) return;

  const patch = buildLiveChatPeopleCustomFields(sessionLean);
  await Promise.all(
    peopleLinks.map((link) =>
      People.updateOne(
        { _id: link.recordId, organizationId },
        { $set: { 'customFields.liveChat': patch.liveChat } },
      ),
    ),
  );
}

function readPersonLiveChatRef(personRecord) {
  return personRecord?.customFields?.liveChat || personRecord?.liveChat || null;
}

async function findLatestSessionLinkedToPerson(organizationId, personId) {
  if (!personId || !mongoose.Types.ObjectId.isValid(String(personId))) return null;
  const personObjectId = new mongoose.Types.ObjectId(String(personId));
  const scope = buildChatSessionScopeFilter(organizationId);
  return ChatSession.findOne({
    ...scope,
    linkedRecords: {
      $elemMatch: {
        moduleKey: 'people',
        recordId: personObjectId,
      },
    },
  }).sort({ updatedAt: -1 });
}

function buildPersonSessionSummary({ ref, sessionLean }) {
  const createdAt = sessionLean.createdAt ? new Date(sessionLean.createdAt) : null;
  const endedAt = sessionLean.endedAt ? new Date(sessionLean.endedAt) : null;
  let durationSeconds = null;
  if (createdAt && endedAt) {
    durationSeconds = Math.max(0, Math.round((endedAt.getTime() - createdAt.getTime()) / 1000));
  }

  return {
    sessionId: String(sessionLean._id),
    sessionKey: sessionLean.sessionKey || ref?.sessionKey || null,
    outcome: sessionLean.outcome || ref?.outcome || null,
    lifecycleStatus: sessionLean.lifecycleStatus || null,
    status: sessionLean.status || null,
    durationSeconds,
    agentId: ref?.agentId || (sessionLean.endedByAgentId ? String(sessionLean.endedByAgentId) : null),
    visitorName: String(sessionLean.visitor?.name || '').trim() || null,
    missing: false,
  };
}

/**
 * Read-only session summary for people UI (no message bodies).
 */
async function getLiveChatSummaryForPerson({ organizationId, personRecord }) {
  const ref = readPersonLiveChatRef(personRecord);
  let session = ref?.sessionId ? await loadSessionForOrg(ref.sessionId, organizationId) : null;
  let resolvedViaLinkedRecords = false;

  if (!session && personRecord?._id) {
    session = await findLatestSessionLinkedToPerson(organizationId, personRecord._id);
    resolvedViaLinkedRecords = !!session;
  }

  if (!session) {
    if (ref?.sessionId) {
      return {
        sessionId: String(ref.sessionId),
        sessionKey: ref.sessionKey || null,
        missing: true,
      };
    }
    return null;
  }

  const sessionLean = session.toObject ? session.toObject() : session;

  if (resolvedViaLinkedRecords && personRecord?._id) {
    const patch = buildLiveChatPeopleCustomFields(sessionLean);
    await People.updateOne(
      { _id: personRecord._id, organizationId },
      { $set: { 'customFields.liveChat': patch.liveChat } },
    );
  }

  return buildPersonSessionSummary({ ref, sessionLean });
}

module.exports = {
  createLeadFromLiveChatSession,
  linkExistingPersonToSession,
  tryAutoLinkExistingPersonToSession,
  syncLinkedPeopleMetadataForSession,
  buildLiveChatPeopleCustomFields,
  getLiveChatSummaryForPerson,
  resolveExistingPersonForSession,
};

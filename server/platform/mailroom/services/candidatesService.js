const Communication = require('../../../models/Communication');
const Case = require('../../../models/Case');
const MailroomConversation = require('../../../models/MailroomConversation');
const MailroomMessage = require('../../../models/MailroomMessage');
const { getFromAddress, normalizeSubject } = require('../services/conversationPersistenceService');

const OPEN_CASE_STATUSES = ['New', 'Assigned', 'In Progress', 'On Hold'];

function emptyCandidates() {
  return {
    messages: [],
    conversations: [],
    openCases: [],
    resolvedCases: [],
    explicitCaseId: null
  };
}

/**
 * Build policy evaluation candidates from CRM + Mailroom data (M2).
 */
async function buildEmailCandidates(organizationId, normalizedMessage) {
  const candidates = emptyCandidates();

  if (!organizationId) return candidates;

  const fromAddress = getFromAddress(normalizedMessage);
  const externalId = String(normalizedMessage.externalMessageId || '').trim();
  const inReplyTo = String(normalizedMessage.inReplyTo || '').trim();
  const refs = String(normalizedMessage.references || '').trim().split(/\s+/).filter(Boolean);
  const threadId = String(normalizedMessage.threadId || '').trim();

  const messageIdSet = new Set();
  const pushMessageCandidate = (row) => {
    const key = String(row.externalMessageId || row.messageId || '');
    if (!key || messageIdSet.has(key)) return;
    messageIdSet.add(key);
    candidates.messages.push(row);
  };

  const commQueries = [];
  if (externalId) commQueries.push({ organizationId, messageId: externalId });
  if (inReplyTo) commQueries.push({ organizationId, messageId: inReplyTo });
  for (const ref of refs) {
    commQueries.push({ organizationId, messageId: ref });
  }

  for (const q of commQueries) {
    const comm = await Communication.findOne(q).select('messageId relatedTo').lean();
    if (!comm) continue;
    const caseId =
      comm.relatedTo?.moduleKey === 'cases' ? comm.relatedTo.recordId : null;
    pushMessageCandidate({
      externalMessageId: comm.messageId,
      messageId: comm.messageId,
      conversationId: null,
      caseId
    });
  }

  const mailroomIdQueries = [];
  if (externalId) mailroomIdQueries.push({ organizationId, externalMessageId: externalId });
  if (inReplyTo) mailroomIdQueries.push({ organizationId, externalMessageId: inReplyTo });
  for (const ref of refs) {
    mailroomIdQueries.push({ organizationId, externalMessageId: ref });
  }

  for (const q of mailroomIdQueries) {
    const msg = await MailroomMessage.findOne(q)
      .select('externalMessageId conversationId linkedCaseId')
      .lean();
    if (!msg) continue;
    pushMessageCandidate({
      externalMessageId: msg.externalMessageId,
      messageId: msg.externalMessageId,
      conversationId: msg.conversationId,
      caseId: msg.linkedCaseId || null
    });
  }

  const convQuery = { organizationId, channel: 'email' };
  const convFilters = [];
  if (threadId) convFilters.push({ externalThreadId: threadId });
  if (fromAddress) {
    const normalizedSub = normalizeSubject(normalizedMessage.subject);
    if (normalizedSub) {
      convFilters.push({
        lastFromAddress: fromAddress,
        lastSubject: new RegExp(normalizedSub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      });
    }
  }

  if (convFilters.length) {
    const convRows = await MailroomConversation.find({
      ...convQuery,
      $or: convFilters
    })
      .select('_id externalThreadId lastFromAddress lastSubject primaryCaseId')
      .sort({ lastMessageAt: -1 })
      .limit(20)
      .lean();

    candidates.conversations = convRows.map((c) => ({
      id: c._id,
      _id: c._id,
      externalThreadId: c.externalThreadId,
      threadId: c.externalThreadId,
      lastFromAddress: c.lastFromAddress,
      lastSubject: c.lastSubject,
      primaryCaseId: c.primaryCaseId
    }));
  } else {
    const recent = await MailroomConversation.find(convQuery)
      .select('_id externalThreadId lastFromAddress lastSubject primaryCaseId')
      .sort({ lastMessageAt: -1 })
      .limit(10)
      .lean();
    candidates.conversations = recent.map((c) => ({
      id: c._id,
      _id: c._id,
      externalThreadId: c.externalThreadId,
      threadId: c.externalThreadId,
      lastFromAddress: c.lastFromAddress,
      lastSubject: c.lastSubject,
      primaryCaseId: c.primaryCaseId
    }));
  }

  if (fromAddress) {
    const senderComms = await Communication.find({
      organizationId,
      'relatedTo.moduleKey': 'cases',
      fromAddress
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('relatedTo.recordId subject')
      .lean();

    const senderCaseIdSet = new Set(
      senderComms
        .map((row) => row.relatedTo?.recordId)
        .filter(Boolean)
        .map(String)
    );

    const allOpenCases = await Case.find({
      organizationId,
      deletedAt: null,
      status: { $in: OPEN_CASE_STATUSES }
    })
      .select('_id status updatedAt')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    candidates.openCases = senderCaseIdSet.size
      ? allOpenCases.filter((c) => senderCaseIdSet.has(String(c._id)))
      : [];

    candidates.resolvedCases = await Case.find({
      organizationId,
      deletedAt: null,
      status: { $in: ['Resolved', 'Closed'] },
      ...(senderCaseIdSet.size ? { _id: { $in: [...senderCaseIdSet] } } : {})
    })
      .select('_id status updatedAt closedAt')
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();
  }

  return candidates;
}

/**
 * Generic candidates builder for non-email channels (M5+).
 * Keeps threading/dedup/case-link working without depending on `Communication`.
 */
async function buildCandidatesForMessage(organizationId, normalizedMessage) {
  const candidates = emptyCandidates();
  if (!organizationId) return candidates;

  const externalId = String(normalizedMessage.externalMessageId || '').trim();
  const inReplyTo = String(normalizedMessage.inReplyTo || '').trim();
  const refs = String(normalizedMessage.references || '').trim().split(/\s+/).filter(Boolean);
  const threadId = String(normalizedMessage.threadId || '').trim();
  const channel = String(normalizedMessage.channel || '').trim().toLowerCase();
  const conversationId = normalizedMessage.conversationId || null;

  const messageIdSet = new Set();
  const pushMessageCandidate = (row) => {
    const key = String(row.externalMessageId || row.messageId || '');
    if (!key || messageIdSet.has(key)) return;
    messageIdSet.add(key);
    candidates.messages.push(row);
  };

  const mailroomIdQueries = [];
  if (externalId) mailroomIdQueries.push({ organizationId, externalMessageId: externalId });
  if (inReplyTo) mailroomIdQueries.push({ organizationId, externalMessageId: inReplyTo });
  for (const ref of refs) {
    mailroomIdQueries.push({ organizationId, externalMessageId: ref });
  }

  for (const q of mailroomIdQueries) {
    const msg = await MailroomMessage.findOne(q)
      .select('externalMessageId conversationId linkedCaseId')
      .lean();
    if (!msg) continue;
    pushMessageCandidate({
      externalMessageId: msg.externalMessageId,
      messageId: msg.externalMessageId,
      conversationId: msg.conversationId,
      caseId: msg.linkedCaseId || null
    });
  }

  if (conversationId) {
    const conv = await MailroomConversation.findOne({
      _id: conversationId,
      organizationId
    })
      .select('_id externalThreadId primaryCaseId channel lastMessageAt')
      .lean();
    if (conv) {
      candidates.conversations = [{
        id: conv._id,
        _id: conv._id,
        externalThreadId: conv.externalThreadId,
        threadId: conv.externalThreadId,
        primaryCaseId: conv.primaryCaseId,
        channel: conv.channel,
        lastMessageAt: conv.lastMessageAt
      }];
    }
  } else if (threadId) {
    const convs = await MailroomConversation.find({
      organizationId,
      ...(channel ? { channel } : {}),
      externalThreadId: threadId
    })
      .select('_id externalThreadId primaryCaseId channel lastMessageAt')
      .sort({ lastMessageAt: -1 })
      .limit(10)
      .lean();
    candidates.conversations = convs.map((c) => ({
      id: c._id,
      _id: c._id,
      externalThreadId: c.externalThreadId,
      threadId: c.externalThreadId,
      primaryCaseId: c.primaryCaseId,
      channel: c.channel,
      lastMessageAt: c.lastMessageAt
    }));
  }

  // Optional: allow connectors to hint an explicit case id (policy can prefer it).
  const hintedCaseId = normalizedMessage?.metadata?.caseId || normalizedMessage?.metadata?.linkedCaseId;
  if (hintedCaseId) {
    candidates.explicitCaseId = String(hintedCaseId);
    const Case = require('../../../models/Case');
    const row = await Case.findOne({
      _id: hintedCaseId,
      organizationId,
      deletedAt: null
    }).select('_id status updatedAt closedAt').lean();
    if (row) {
      if (OPEN_CASE_STATUSES.includes(row.status)) candidates.openCases = [row];
      if (row.status === 'Resolved' || row.status === 'Closed') candidates.resolvedCases = [row];
    }
  }

  return candidates;
}

module.exports = {
  buildEmailCandidates,
  buildCandidatesForMessage
};

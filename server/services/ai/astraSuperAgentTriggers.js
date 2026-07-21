'use strict';

/**
 * Super Agent event triggers → AstraProposal + in-thread reply on @agent mentions.
 * Never silent CRM writes.
 */

const mongoose = require('mongoose');
const Notification = require('../../models/Notification');
const AiTenantAgent = require('../../models/AiTenantAgent');
const { getAstraSkill } = require('./aiAstraSkillsRegistry');
const { upsertProposalsForUser } = require('./astraAutopilotService');
const {
  isSuperAgentsEnabled,
  ensureBuiltinSuperAgents,
  resolveAgentMention,
} = require('./astraSuperAgentService');

const AGENT_MENTION_REGEX = /@\[([^\]]+)\]\(agent:([^)]+)\)/g;

function parseAgentMentions(content) {
  const hits = [];
  if (!content || typeof content !== 'string') return hits;
  AGENT_MENTION_REGEX.lastIndex = 0;
  let match;
  while ((match = AGENT_MENTION_REGEX.exec(content)) !== null) {
    hits.push({
      name: String(match[1] || '').trim(),
      agentId: String(match[2] || '').trim(),
    });
  }
  return hits;
}

function stripMentions(content) {
  return String(content || '')
    .replace(/@\[[^\]]+\]\((?:user|group|agent):[^)]+\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findAgentDoc({ organizationId, agentId, name }) {
  if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
    const byId = await AiTenantAgent.findOne({
      _id: agentId,
      organizationId,
      enabled: true,
      mentionable: true,
    }).lean();
    if (byId) return byId;
  }
  if (name) {
    return AiTenantAgent.findOne({
      organizationId,
      enabled: true,
      mentionable: true,
      name: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    }).lean();
  }
  return null;
}

async function notifyAgentEngaged({
  organizationId,
  userId,
  appKey = 'SALES',
  title,
  body,
  entityType,
  entityId,
  recordTitle = '',
}) {
  try {
    const normalizedAppKey = String(appKey || 'SALES').toUpperCase();
    if (!['SALES', 'AUDIT', 'PORTAL', 'HELPDESK', 'PLATFORM'].includes(normalizedAppKey)) return;
    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(userId)) return;

    const entity = {};
    if (entityType) entity.type = entityType;
    if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
      entity.id = new mongoose.Types.ObjectId(entityId);
    }
    if (recordTitle) entity.title = String(recordTitle).slice(0, 200);

    const doc = await Notification.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      userId: new mongoose.Types.ObjectId(userId),
      appKey: normalizedAppKey,
      sourceAppKey: normalizedAppKey,
      eventType: 'ASTRA_SUPER_AGENT_MENTION',
      title: String(title || 'Astra Super Agent').slice(0, 120),
      body: String(body || '').slice(0, 500),
      entity: Object.keys(entity).length ? entity : undefined,
      channel: 'IN_APP',
      priority: 'NORMAL',
      source: 'SYSTEM',
    });
    try {
      const { deliverNotificationSSE } = require('../notificationSSEDeliver');
      await deliverNotificationSSE({
        userId: doc.userId,
        organizationId: doc.organizationId,
        appKey: doc.appKey,
        payload: {
          id: String(doc._id),
          appKey: doc.appKey,
          eventType: doc.eventType,
          title: doc.title,
          body: doc.body,
        },
      });
    } catch (_) { /* sse optional */ }
  } catch (err) {
    console.warn('[astraSuperAgentTriggers] notify skipped:', err?.message || err);
  }
}

function formatAgentReplyContent(agent, body) {
  const text = String(body || '').trim().slice(0, 6000);
  return `@[${agent.name}](agent:${agent._id})\n${text}`;
}

/**
 * Post a visible Activity reply so @agent mentions feel interactive.
 */
async function postAgentReplyComment({
  organizationId,
  moduleKey,
  recordId,
  parentCommentId = null,
  authorId,
  agent,
  body,
}) {
  const content = formatAgentReplyContent(agent, body);
  const mod = String(moduleKey || '').toLowerCase();
  const parentId = parentCommentId && mongoose.Types.ObjectId.isValid(parentCommentId)
    ? parentCommentId
    : null;

  if (mod === 'deals') {
    const DealComment = require('../../models/DealComment');
    return DealComment.create({
      dealId: recordId,
      organizationId,
      content,
      author: authorId,
      parentCommentId: parentId,
    });
  }
  if (mod === 'tasks') {
    const TaskComment = require('../../models/TaskComment');
    return TaskComment.create({
      taskId: recordId,
      organizationId,
      content,
      author: authorId,
      parentCommentId: parentId,
    });
  }

  const RecordActivity = require('../../models/RecordActivity');
  const rid = mongoose.Types.ObjectId.isValid(recordId)
    ? new mongoose.Types.ObjectId(recordId)
    : String(recordId);
  return RecordActivity.create({
    organizationId,
    moduleKey: mod || 'people',
    recordId: rid,
    type: 'comment',
    content,
    parentCommentId: parentId,
    details: {
      astraAgentReply: true,
      astraAgentId: String(agent._id),
      astraAgentName: agent.name,
    },
    author: authorId,
  });
}

async function runAgentAskAndReply({
  organizationId,
  ownerId,
  appKey,
  moduleKey,
  recordId,
  parentCommentId,
  agent,
  question,
}) {
  const { runTenantAgentAsk } = require('./aiTenantAgentService');
  let answer = '';
  try {
    const result = await runTenantAgentAsk({
      organizationId,
      userId: ownerId,
      agentId: String(agent._id),
      question,
      appKey: appKey || 'SALES',
      moduleKey: String(moduleKey || '').trim(),
      recordId: String(recordId || '').trim(),
      history: [],
    });
    answer = String(
      result?.answer
      || result?.structured?.detail
      || result?.structured?.headline
      || result?.message
      || '',
    ).trim();
    if (!answer && Array.isArray(result?.structured?.bullets) && result.structured.bullets.length) {
      answer = result.structured.bullets.map((b) => `• ${b}`).join('\n');
    }
    if (!answer) {
      answer = 'I reviewed this record but do not have a grounded next step yet. Ask me a more specific question.';
    }
  } catch (err) {
    console.error(
      `[astraSuperAgentTriggers] ask failed agent=${agent?._id}:`,
      err?.message || err,
    );
    answer = `I could not finish that yet (${String(err?.message || 'error').slice(0, 160)}). Try again from Astra or re-mention me.`;
  }

  try {
    await postAgentReplyComment({
      organizationId,
      moduleKey,
      recordId,
      parentCommentId,
      authorId: ownerId,
      agent,
      body: answer,
    });
  } catch (err) {
    console.error('[astraSuperAgentTriggers] reply comment failed:', err?.message || err);
  }
}

/**
 * @mention Super Agent in a record comment → in-thread reply + proposal + notification.
 */
async function processSuperAgentCommentMentions(opts = {}) {
  if (!isSuperAgentsEnabled()) {
    console.warn('[astraSuperAgentTriggers] Super Agents disabled — mention ignored');
    return { handled: 0, reason: 'disabled' };
  }
  const {
    organizationId,
    userId,
    authorId,
    authorName = 'Someone',
    appKey = 'SALES',
    moduleKey = '',
    recordId = '',
    recordTitle = '',
    commentId = '',
    commentContent = '',
    entityType = '',
  } = opts;
  const ownerId = authorId || userId;
  if (!organizationId || !ownerId || !commentContent) {
    return { handled: 0, reason: 'missing_context' };
  }

  await ensureBuiltinSuperAgents({ organizationId, userId: ownerId });

  const structured = parseAgentMentions(commentContent);
  const agents = [];
  for (const hit of structured) {
    const doc = await findAgentDoc({
      organizationId,
      agentId: hit.agentId,
      name: hit.name,
    });
    if (doc) agents.push(doc);
  }

  if (!agents.length) {
    const mentionable = await AiTenantAgent.find({
      organizationId,
      enabled: true,
      mentionable: true,
    }).lean();
    const resolved = resolveAgentMention(commentContent, mentionable.map((a) => ({
      ...a,
      _id: String(a._id),
    })));
    if (resolved?.agent) {
      const doc = await findAgentDoc({
        organizationId,
        agentId: resolved.agent._id,
        name: resolved.agent.name,
      });
      if (doc) agents.push(doc);
    }
  }

  if (!agents.length) {
    console.warn(
      '[astraSuperAgentTriggers] no agent matched mention',
      { organizationId, preview: String(commentContent).slice(0, 120) },
    );
    return { handled: 0, reason: 'no_agent' };
  }

  const rest = stripMentions(commentContent);
  let handled = 0;

  for (const agent of agents.slice(0, 2)) {
    const skillId = Array.isArray(agent.skillIds) ? agent.skillIds[0] : '';
    const skill = skillId ? getAstraSkill(skillId) : null;
    const seed = rest
      || skill?.seedQuestion
      || 'What is the next best action on this record?';
    const question = [
      recordTitle ? `Record: ${recordTitle} (${moduleKey || 'crm'})` : '',
      recordId ? `RecordId: ${recordId}` : '',
      moduleKey ? `Module: ${moduleKey}` : '',
      `User ${authorName} mentioned you in a comment on this CRM record.`,
      `Request: ${seed}`,
      'Reply with grounded CRM guidance. Propose writes; never send email or mutate silently.',
    ].filter(Boolean).join('\n');

    const action = {
      label: `@${agent.name}: respond on ${recordTitle || 'record'}`.slice(0, 120),
      kind: 'review_record',
      moduleKey: String(moduleKey || agent.moduleKeys?.[0] || '').toLowerCase(),
      recordId: String(recordId || ''),
      rationale: `Mentioned by ${authorName} — replied in Activity`.slice(0, 240),
      priority: 'high',
      targetLabel: agent.name,
      executeNow: false,
      fields: {
        superAgentId: String(agent._id),
        askQuestion: question.slice(0, 2000),
        fromComment: true,
      },
    };

    try {
      await upsertProposalsForUser({
        organizationId,
        userId: ownerId,
        actions: [action],
        ttlHours: 48,
        triggerOverride: `sa_comment:${String(agent._id).slice(-6)}`.slice(0, 64),
      });
    } catch (err) {
      console.warn('[astraSuperAgentTriggers] proposal upsert failed:', err?.message || err);
    }

    await notifyAgentEngaged({
      organizationId,
      userId: ownerId,
      appKey,
      title: `${agent.name} is responding`,
      body: `${agent.name} is working on your comment${recordTitle ? ` on ${recordTitle}` : ''}. Check Activity for the reply.`,
      entityType,
      entityId: recordId,
      recordTitle,
    });

    try {
      await postAgentReplyComment({
        organizationId,
        moduleKey,
        recordId,
        parentCommentId: commentId,
        authorId: ownerId,
        agent,
        body: 'Working on this…',
      });
    } catch (err) {
      console.warn('[astraSuperAgentTriggers] ack reply failed:', err?.message || err);
    }

    // Full answer follows asynchronously
    void runAgentAskAndReply({
      organizationId,
      ownerId,
      appKey,
      moduleKey,
      recordId,
      parentCommentId: commentId,
      agent,
      question,
    });

    handled += 1;
  }

  return { handled };
}

async function proposeFromEvent({
  organizationId,
  userId,
  catalogId,
  action,
  trigger,
}) {
  if (!isSuperAgentsEnabled() || !organizationId || !userId || !action?.label) {
    return { created: 0 };
  }
  await ensureBuiltinSuperAgents({ organizationId, userId });
  if (action.kind === 'create_record' || action.kind === 'update_record') {
    action.executeNow = false;
  }
  const result = await upsertProposalsForUser({
    organizationId,
    userId,
    actions: [action],
    ttlHours: 72,
    triggerOverride: String(trigger || `sa_event:${catalogId || 'x'}`).slice(0, 64),
  });
  return { created: result.created || 0, refreshed: result.refreshed || 0 };
}

async function onDealStageChanged({
  organizationId,
  userId,
  deal,
  fromStage = '',
  toStage = '',
} = {}) {
  if (!deal?._id || !userId) return { created: 0 };
  const name = deal.name || 'Deal';
  return proposeFromEvent({
    organizationId,
    userId,
    catalogId: 'deal_closer',
    trigger: `sa_stage:${String(deal._id).slice(-8)}`,
    action: {
      label: `Review stage change: ${name}`.slice(0, 120),
      kind: 'review_record',
      moduleKey: 'deals',
      recordId: String(deal._id),
      rationale: `Stage ${fromStage || '?'} → ${toStage || '?'}. Deal Closer / Revenue Pulse check-in.`.slice(0, 240),
      priority: 'medium',
      targetLabel: name,
      executeNow: false,
      fields: {
        askQuestion: `Deal "${name}" moved from "${fromStage}" to "${toStage}". What should we do next? Propose confirmable follow-ups.`,
        fromStage,
        toStage,
        superAgentCatalogId: 'deal_closer',
      },
    },
  });
}

async function onCaseCreated({
  organizationId,
  userId,
  caseRecord,
} = {}) {
  if (!caseRecord?._id || !userId) return { created: 0 };
  const subject = caseRecord.subject || caseRecord.caseNumber || 'Case';
  return proposeFromEvent({
    organizationId,
    userId,
    catalogId: 'case_triage',
    trigger: `sa_case:${String(caseRecord._id).slice(-8)}`,
    action: {
      label: `Triage new case: ${subject}`.slice(0, 120),
      kind: 'review_record',
      moduleKey: 'cases',
      recordId: String(caseRecord._id),
      rationale: 'New case created — Case Triage intake.',
      priority: 'high',
      targetLabel: subject,
      executeNow: false,
      fields: {
        askQuestion: `New case "${subject}" was created. Triage priority, SLA risk, and propose the next best action.`,
        superAgentCatalogId: 'case_triage',
      },
    },
  });
}

module.exports = {
  processSuperAgentCommentMentions,
  onDealStageChanged,
  onCaseCreated,
  parseAgentMentions,
  proposeFromEvent,
  postAgentReplyComment,
};

'use strict';

/**
 * Astra Super Agents — mentionable / schedulable Tenant Agents.
 * Scheduled runs only write AstraProposal (propose→confirm). Flag: ASTRA_SUPER_AGENTS_V1
 */

const AiTenantAgent = require('../../models/AiTenantAgent');
const Organization = require('../../models/Organization');
const dbConnectionManager = require('../../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../../utils/tenantContext');
const { buildNextBestActions } = require('./aiAstraNextBestActionService');
const { upsertProposalsForUser } = require('./astraAutopilotService');
const { getAstraSkill } = require('./aiAstraSkillsRegistry');

const MIN_SCHEDULE_GAP_MS = 55 * 60 * 1000;
const MAX_ACTIONS_PER_RUN = 3;

function isSuperAgentsEnabled() {
  if (String(process.env.ASTRA_SUPER_AGENTS_V1 || '').toLowerCase() === 'false') return false;
  if (String(process.env.ASTRA_SUPER_AGENTS_V1 || '').toLowerCase() === 'true') return true;
  return true;
}

function normalizeMentionToken(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Parse leading @AgentName from question. Matches mentionable agents by name.
 * @returns {{ agent: object, question: string, skill: object|null } | null}
 */
function resolveAgentMention(question, agents = []) {
  if (!isSuperAgentsEnabled()) return null;
  const raw = String(question || '').trim();
  if (!raw.startsWith('@')) return null;
  const rest = raw.slice(1);
  const mentionable = (Array.isArray(agents) ? agents : [])
    .filter((a) => a?.mentionable && a?.enabled !== false)
    .slice()
    .sort((a, b) => String(b.name || '').length - String(a.name || '').length);

  for (const agent of mentionable) {
    const name = String(agent.name || '').trim();
    if (!name) continue;
    if (!rest.toLowerCase().startsWith(name.toLowerCase())) continue;
    const after = rest.slice(name.length);
    // Require boundary after name (end, whitespace, or punctuation)
    if (after && !/^[\s,.:;!?]/.test(after)) continue;
    let q = after.replace(/^[\s,.:;!?]+/, '').trim();
    let skill = null;
    if (!q && Array.isArray(agent.skillIds) && agent.skillIds.length) {
      skill = getAstraSkill(agent.skillIds[0]);
      if (skill?.seedQuestion) q = skill.seedQuestion;
    }
    return {
      agent,
      question: q || 'Run your specialist workflow for this context.',
      skill,
    };
  }

  // Fallback: first token (@Coach …)
  const m = rest.match(/^([A-Za-z0-9][\w-]{0,79})\b\s*([\s\S]*)$/);
  if (!m) return null;
  const token = normalizeMentionToken(m[1]);
  const agent = mentionable.find((a) => normalizeMentionToken(a.name) === token)
    || mentionable.find((a) => normalizeMentionToken(a.name).startsWith(token))
    || null;
  if (!agent) return null;
  let q = String(m[2] || '').trim();
  let skill = null;
  if (!q && Array.isArray(agent.skillIds) && agent.skillIds.length) {
    skill = getAstraSkill(agent.skillIds[0]);
    if (skill?.seedQuestion) q = skill.seedQuestion;
  }
  return {
    agent,
    question: q || 'Run your specialist workflow for this context.',
    skill,
  };
}

function filterActionsForAgent(actions, agent) {
  const modules = new Set(
    [
      ...(Array.isArray(agent?.moduleKeys) ? agent.moduleKeys : []),
      ...(Array.isArray(agent?.knowledgeScope?.modules) ? agent.knowledgeScope.modules : []),
    ].map((m) => String(m || '').toLowerCase()).filter(Boolean),
  );
  let list = Array.isArray(actions) ? actions.filter((a) => a?.label && a?.kind) : [];
  if (modules.size) {
    const narrowed = list.filter((a) => modules.has(String(a.moduleKey || '').toLowerCase()));
    if (narrowed.length) list = narrowed;
  }
  return list.slice(0, MAX_ACTIONS_PER_RUN).map((action) => {
    const next = { ...action };
    if (next.kind === 'create_record' || next.kind === 'update_record') {
      next.executeNow = false;
    }
    const agentName = String(agent?.name || 'Super Agent').slice(0, 40);
    next.rationale = [`${agentName} schedule`, String(next.rationale || '').trim()]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 240);
    return next;
  });
}

async function runScheduledAgentOnce({ organizationId, agent }) {
  const ownerId = agent.scheduleOwnerUserId || agent.createdBy;
  if (!ownerId) {
    return { skipped: true, reason: 'no_owner' };
  }
  const trigger = `sa:${String(agent._id).slice(-8)}`.slice(0, 64);
  const actions = await buildNextBestActions({
    organizationId,
    userId: ownerId,
    limit: MAX_ACTIONS_PER_RUN + 2,
  });
  const filtered = filterActionsForAgent(actions, agent);
  if (!filtered.length) {
    await AiTenantAgent.updateOne(
      { _id: agent._id, organizationId },
      { $set: { lastScheduledAt: new Date() } },
    );
    return { skipped: true, reason: 'no_actions', created: 0, refreshed: 0 };
  }
  const result = await upsertProposalsForUser({
    organizationId,
    userId: ownerId,
    actions: filtered,
    ttlHours: 72,
    triggerOverride: trigger,
  });
  await AiTenantAgent.updateOne(
    { _id: agent._id, organizationId },
    { $set: { lastScheduledAt: new Date() } },
  );
  return {
    skipped: false,
    agentId: String(agent._id),
    created: result.created || 0,
    refreshed: result.refreshed || 0,
    trigger,
  };
}

async function tickSuperAgentSchedules({ now = new Date() } = {}) {
  if (!isSuperAgentsEnabled()) {
    return { skipped: true, reason: 'disabled' };
  }
  const orgs = await Organization.find({ 'aiSettings.enabled': true })
    .select('_id')
    .lean();
  let agentsProcessed = 0;
  let created = 0;
  let refreshed = 0;
  let errors = 0;

  for (const org of orgs) {
    const organizationId = org._id;
    try {
      await dbConnectionManager.ensureTenantConnection(organizationId);
      await runWithTenantContext({ organizationId }, async () => {
        const agents = await AiTenantAgent.find({
          organizationId,
          enabled: true,
          scheduleCron: { $nin: [null, ''] },
        }).lean();

        for (const agent of agents) {
          if (agent.lastScheduledAt) {
            const gap = now.getTime() - new Date(agent.lastScheduledAt).getTime();
            if (gap < MIN_SCHEDULE_GAP_MS) continue;
          }
          try {
            const result = await runScheduledAgentOnce({ organizationId, agent });
            agentsProcessed += 1;
            created += result.created || 0;
            refreshed += result.refreshed || 0;
          } catch (err) {
            errors += 1;
            console.error(
              `[astraSuperAgent] schedule failed org=${organizationId} agent=${agent._id}:`,
              err?.message || err,
            );
          }
        }
      });
    } catch (err) {
      errors += 1;
      console.error(`[astraSuperAgent] tenant tick failed org=${organizationId}:`, err?.message || err);
    }
  }

  return {
    skipped: false,
    tenants: orgs.length,
    agentsProcessed,
    created,
    refreshed,
    errors,
  };
}

async function listMentionableAgents(organizationId) {
  if (!isSuperAgentsEnabled()) return [];
  const rows = await AiTenantAgent.find({
    organizationId,
    enabled: true,
    mentionable: true,
  }).sort({ name: 1 }).lean();
  return rows.map((row) => ({
    _id: String(row._id),
    name: row.name,
    description: row.description || '',
    moduleKeys: Array.isArray(row.moduleKeys) ? row.moduleKeys : [],
    skillIds: Array.isArray(row.skillIds) ? row.skillIds : [],
    catalogId: row.sourceQuestion && String(row.sourceQuestion).startsWith('catalog:')
      ? String(row.sourceQuestion).slice('catalog:'.length)
      : '',
    scheduleCron: row.scheduleCron || '',
  }));
}

/**
 * Upsert all built-in Super Agents for a tenant (idempotent by name).
 * Marks catalog agents via sourceQuestion = catalog:<id> and autoCreated=false.
 */
async function ensureBuiltinSuperAgents({ organizationId, userId = null } = {}) {
  if (!isSuperAgentsEnabled() || !organizationId) {
    return { enabled: false, created: 0, updated: 0, agents: [] };
  }
  const { ASTRA_SUPER_AGENTS } = require('./aiAstraSuperAgentsCatalog');
  let created = 0;
  let updated = 0;
  const agents = [];

  for (const spec of ASTRA_SUPER_AGENTS) {
    const sourceQuestion = `catalog:${spec.catalogId}`;
    let doc = await AiTenantAgent.findOne({
      organizationId,
      $or: [
        { sourceQuestion },
        { name: spec.name },
      ],
    });

    const payload = {
      name: spec.name,
      description: spec.description,
      systemPrompt: spec.systemPrompt,
      triggerPhrases: spec.triggerPhrases || [],
      moduleKeys: spec.moduleKeys || [],
      capabilities: (spec.toolAllowlist || []).includes('propose_write')
        ? ['crm_write']
        : [],
      mentionable: true,
      scheduleCron: spec.scheduleCron || '',
      skillIds: spec.skillIds || [],
      toolAllowlist: spec.toolAllowlist || [],
      knowledgeScope: {
        modules: spec.moduleKeys || [],
        sources: ['crm'],
      },
      enabled: true,
      autoCreated: false,
      sourceQuestion,
      updatedBy: userId || null,
    };

    if (!doc) {
      doc = await AiTenantAgent.create({
        organizationId,
        ...payload,
        createdBy: userId || null,
        scheduleOwnerUserId: userId || null,
      });
      created += 1;
    } else {
      Object.assign(doc, payload);
      if (!doc.scheduleOwnerUserId && userId) {
        doc.scheduleOwnerUserId = userId;
      }
      await doc.save();
      updated += 1;
    }
    agents.push({
      _id: String(doc._id),
      name: doc.name,
      description: doc.description || '',
      moduleKeys: doc.moduleKeys || [],
      skillIds: doc.skillIds || [],
      catalogId: spec.catalogId,
      scheduleCron: doc.scheduleCron || '',
      mentionable: true,
    });
  }

  return { enabled: true, created, updated, agents };
}

module.exports = {
  isSuperAgentsEnabled,
  resolveAgentMention,
  tickSuperAgentSchedules,
  runScheduledAgentNow: runScheduledAgentOnce,
  listMentionableAgents,
  ensureBuiltinSuperAgents,
  filterActionsForAgent,
};

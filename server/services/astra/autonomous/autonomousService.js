'use strict';

/**
 * autonomousService — goals + Next-Best-Action (NBA) + surface contracts.
 *
 * This is the proactive side of Astra: durable goals (AstraGoal) and the
 * contracts each product surface uses to request/render suggestions. NBA
 * ranking is intentionally a grounded stub here — it composes existing tools
 * rather than inventing a new ranking engine.
 */

const AstraGoal = require('../../../models/AstraGoal');
const toolRegistry = require('../tools/toolRegistry');
const { ensureBootstrapped } = (() => {
  // Call-time resolve avoids circular bootstrap capture of undefined
  return {
    ensureBootstrapped: () => require('../bootstrap').ensureBootstrapped(),
  };
})();

function goalModel(deps) {
  return deps?.AstraGoal || AstraGoal;
}

// --- surface contracts ------------------------------------------------------

/**
 * The stable contract each surface implements to host autonomous suggestions.
 * Surfaces render `cards`; each card maps to a tool the user can run/confirm.
 */
const SURFACE_CONTRACTS = Object.freeze({
  home: { id: 'home', maxCards: 3, allow: ['reports.run', 'crm.deals'] },
  deals: { id: 'deals', maxCards: 4, allow: ['crm.deals', 'reports.run', 'email.draft'] },
  inbox: { id: 'inbox', maxCards: 4, allow: ['crm.cases', 'email.draft', 'calendar.createEvent'] },
});

function getSurfaceContract(surface) {
  return SURFACE_CONTRACTS[String(surface || '').toLowerCase()] || null;
}

// --- goals ------------------------------------------------------------------

async function listGoals({ organizationId, userId = null, status = 'active' }, deps = {}) {
  if (!organizationId) return [];
  const filter = { organizationId };
  if (userId) filter.userId = userId;
  if (status) filter.status = status;
  return goalModel(deps).find(filter).sort({ updatedAt: -1 }).limit(100).lean();
}

async function createGoal({ organizationId, userId, title, description = '', surface = '', target = {}, dueAt = null }, deps = {}) {
  if (!organizationId || !title) throw new Error('organizationId and title are required');
  return goalModel(deps).create({
    organizationId,
    userId: userId || null,
    title,
    description,
    surface,
    target,
    dueAt,
    createdBy: userId || null,
    status: 'active',
  });
}

async function updateGoal({ organizationId, goalId, patch = {} }, deps = {}) {
  if (!organizationId || !goalId) throw new Error('organizationId and goalId are required');
  const allowed = {};
  for (const key of ['title', 'description', 'status', 'surface', 'target', 'progress', 'dueAt']) {
    if (patch[key] !== undefined) allowed[key] = patch[key];
  }
  return goalModel(deps).findOneAndUpdate(
    { _id: goalId, organizationId },
    { $set: allowed },
    { new: true },
  ).lean();
}

// --- Next-Best-Action (grounded stub) --------------------------------------

/**
 * Module list / workspace suggestions when there is no record focus.
 * @param {string} moduleKey
 * @returns {object[]}
 */
function buildModuleListCards(moduleKey) {
  const mk = String(moduleKey || '').trim().toLowerCase();
  if (!mk || mk === 'home' || mk === 'record') return [];

  /** @type {object[]} */
  const byModule = {
    people: [
      {
        id: 'people-followups',
        title: 'Who should I follow up with this week?',
        rationale: 'Surface contacts that need attention.',
        kind: 'ask',
        prompt: 'Who should I follow up with this week?',
        moduleKey: 'people',
        risk: 'read',
      },
      {
        id: 'people-find',
        title: 'Find a contact by name',
        rationale: 'Look someone up in your CRM.',
        kind: 'ask',
        prompt: 'Find a contact by name',
        moduleKey: 'people',
        risk: 'read',
      },
    ],
    organizations: [
      {
        id: 'orgs-active',
        title: 'Which accounts have open deals?',
        rationale: 'Focus on accounts in active pipeline.',
        kind: 'ask',
        prompt: 'Which organizations have open deals?',
        moduleKey: 'organizations',
        risk: 'read',
      },
    ],
    deals: [
      {
        id: 'deals-open',
        title: 'Review your open pipeline',
        rationale: 'Stay on top of deals still in play.',
        kind: 'ask',
        prompt: 'List my open deals',
        moduleKey: 'deals',
        risk: 'read',
      },
      {
        id: 'deals-count',
        title: 'How many open deals do you have?',
        rationale: 'Quick pipeline pulse.',
        kind: 'ask',
        prompt: 'How many open deals do I have?',
        moduleKey: 'deals',
        risk: 'read',
      },
    ],
    cases: [
      {
        id: 'cases-open',
        title: 'Show my open cases',
        rationale: 'Triage helpdesk work in flight.',
        kind: 'ask',
        prompt: 'Show my open cases',
        moduleKey: 'cases',
        risk: 'read',
      },
    ],
    tasks: [
      {
        id: 'tasks-due',
        title: 'What tasks are due soon?',
        rationale: 'Keep your to-do list moving.',
        kind: 'ask',
        prompt: 'What tasks are due soon?',
        moduleKey: 'tasks',
        risk: 'read',
      },
    ],
    events: [
      {
        id: 'events-upcoming',
        title: 'What meetings do I have coming up?',
        rationale: 'Prep for the next conversations.',
        kind: 'ask',
        prompt: 'What meetings do I have coming up?',
        moduleKey: 'events',
        risk: 'read',
      },
    ],
    quotes: [
      {
        id: 'quotes-open',
        title: 'Show open quotes',
        rationale: 'Track proposals still awaiting a decision.',
        kind: 'ask',
        prompt: 'Show open quotes',
        moduleKey: 'quotes',
        risk: 'read',
      },
    ],
  };

  return (byModule[mk] || []).slice(0, 4);
}

/**
 * Personalized home / workspace NBA from the user's open work.
 * @returns {Promise<object[]>}
 */
/**
 * Ranked home suggestions from the user's live workload.
 * Mixes categories (tasks / quotes / deals / cases / people) so the grid
 * reflects priorities — not four copies of the same overdue-task pattern.
 */
async function buildWorkspaceHomeCards({ organizationId, userId }, deps = {}) {
  if (!organizationId) return [];

  const Deal = deps.Deal || require('../../../models/Deal');
  const Task = deps.Task || require('../../../models/Task');
  const Case = deps.Case || require('../../../models/Case');
  const Quote = deps.Quote || require('../../../models/Quote');
  const People = deps.People || require('../../../models/People');
  const { DEAL_STATUS } = require('../../../constants/dealStatus');

  const now = new Date();
  const uid = userId || null;
  const assignee = uid ? { assignedTo: uid } : {};
  const short = (text, max = 56) => {
    const s = String(text || '').trim();
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
  };

  /** @type {Record<string, object[]>} */
  const buckets = { tasks: [], quotes: [], deals: [], cases: [], people: [] };

  const push = (bucket, card) => {
    if (!card?.title || !card?.prompt) return;
    const list = buckets[bucket];
    if (!list) return;
    if (list.some((c) => c.id === card.id || c.prompt === card.prompt)) return;
    list.push(card);
  };

  try {
    const overdue = await Task.find({
      organizationId,
      deletedAt: null,
      status: { $nin: ['completed', 'cancelled', 'done', 'Canceled'] },
      dueDate: { $lt: now },
      ...assignee,
    })
      .sort({ dueDate: 1 })
      .limit(4)
      .select('title dueDate status priority')
      .lean();
    for (const t of overdue || []) {
      const title = t.title || 'Untitled task';
      push('tasks', {
        id: `home-task-${t._id}`,
        title: short(`Clear overdue: ${title}`),
        rationale: t.dueDate
          ? `Was due ${new Date(t.dueDate).toLocaleDateString()}.`
          : 'Overdue on your list.',
        kind: 'ask',
        prompt: `Help me finish overdue task "${title}". What's the practical next step?`,
        moduleKey: 'tasks',
        recordId: String(t._id),
        risk: 'read',
        iconKey: 'task',
        priority: 98,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const quotes = await Quote.find({
      organizationId,
      deletedAt: null,
      status: { $regex: /^expir/i },
      ...assignee,
    })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select('quoteNumber quoteTitle name title status total amount contactId')
      .lean();
    for (const q of quotes || []) {
      const title = q.quoteTitle || q.name || q.title || q.quoteNumber || 'Expired quote';
      push('quotes', {
        id: `home-quote-${q._id}`,
        title: short(`Revive ${q.quoteNumber || title}`),
        rationale: `${q.quoteNumber || 'Quote'} expired — revise, re-send, or close.`,
        kind: 'ask',
        prompt: `Expired quote "${title}"${q.quoteNumber ? ` (${q.quoteNumber})` : ''}: what's the best next step, and draft a short follow-up if useful.`,
        moduleKey: 'quotes',
        recordId: String(q._id),
        risk: 'write',
        iconKey: 'document',
        priority: 95,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    let deals = await Deal.find({
      organizationId,
      deletedAt: null,
      status: DEAL_STATUS.OPEN,
      ...assignee,
    })
      .sort({ expectedCloseDate: 1, updatedAt: -1 })
      .limit(4)
      .select('name stage status amount expectedCloseDate')
      .lean();
    // Org backfill when this user has no open deals assigned.
    if ((!deals || !deals.length) && uid) {
      deals = await Deal.find({
        organizationId,
        deletedAt: null,
        status: DEAL_STATUS.OPEN,
      })
        .sort({ updatedAt: -1 })
        .limit(4)
        .select('name stage status amount expectedCloseDate')
        .lean();
    }
    for (const d of deals || []) {
      const name = d.name || 'Untitled deal';
      const stage = d.stage || d.status || 'Open';
      const hot = /negotiat|proposal/i.test(String(stage));
      const closeHint = d.expectedCloseDate
        ? `Close target ${new Date(d.expectedCloseDate).toLocaleDateString()}.`
        : 'Open in your pipeline.';
      push('deals', {
        id: `home-deal-${d._id}`,
        title: short(hot ? `Unblock ${name}` : `Advance ${name}`),
        rationale: `${stage} · ${closeHint}`,
        kind: 'ask',
        prompt: `What's the best next action on deal "${name}" (stage ${stage})? Use related quotes, people, and recent activity.`,
        moduleKey: 'deals',
        recordId: String(d._id),
        risk: 'read',
        iconKey: 'briefcase',
        priority: hot ? 92 : 80,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const cases = await Case.find({
      organizationId,
      deletedAt: null,
      status: { $nin: ['Resolved', 'Closed', 'Cancelled', 'Canceled'] },
      ...assignee,
    })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select('title subject status priority')
      .lean();
    for (const c of cases || []) {
      const title = c.title || c.subject || 'Untitled case';
      push('cases', {
        id: `home-case-${c._id}`,
        title: short(`Triage: ${title}`),
        rationale: `${c.status || 'Open'}${c.priority ? ` · ${c.priority}` : ''}`,
        kind: 'ask',
        prompt: `Suggest the best next action for open case "${title}" (${c.status || 'Open'}).`,
        moduleKey: 'cases',
        recordId: String(c._id),
        risk: 'read',
        iconKey: 'ticket',
        priority: 88,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const recentPeople = await People.find({
      organizationId,
      deletedAt: null,
      ...assignee,
    })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select('first_name last_name email updatedAt')
      .lean();
    for (const p of recentPeople || []) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || 'Contact';
      push('people', {
        id: `home-person-${p._id}`,
        title: short(`Catch up: ${name}`),
        rationale: 'Recently updated contact on your plate.',
        kind: 'ask',
        prompt: `Summarize the current situation for ${name} using related records, emails, and activity. End with one best next action.`,
        moduleKey: 'people',
        recordId: String(p._id),
        risk: 'read',
        iconKey: 'user',
        priority: 70,
      });
    }
  } catch {
    /* ignore */
  }

  // Prefer one card per priority lane, then fill remaining slots by score.
  const order = ['tasks', 'quotes', 'deals', 'cases', 'people'];
  /** @type {object[]} */
  const picked = [];
  const seen = new Set();
  for (const key of order) {
    const list = (buckets[key] || []).slice().sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const top = list[0];
    if (!top || seen.has(top.id)) continue;
    seen.add(top.id);
    picked.push(top);
    if (picked.length >= 4) break;
  }
  if (picked.length < 4) {
    const rest = order
      .flatMap((key) => buckets[key] || [])
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const card of rest) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      picked.push(card);
      if (picked.length >= 4) break;
    }
  }

  return picked.slice(0, 4).map(({ priority, ...rest }) => rest);
}

/**
 * Produce ranked, tool-backed suggestion cards for a surface.
 * When moduleKey + recordId are provided, returns record-grounded ask suggestions.
 * @returns {Promise<{ surface: string, cards: object[] }>}
 */
async function nextBestActions(
  {
    organizationId,
    userId = null,
    surface = 'home',
    moduleKey = null,
    recordId = null,
    recordName = null,
  },
  deps = {},
) {
  ensureBootstrapped();

  const mk = String(moduleKey || '').trim().toLowerCase();
  const rid = String(recordId || '').trim();

  if (organizationId && mk && rid) {
    try {
      const { buildSituationContext } = require('../context/situationContext');
      const situation = await buildSituationContext({
        organizationId,
        moduleKey: mk,
        recordId: rid,
        name: recordName || '',
        deps,
      });
      if (situation?.ok) {
        const cardsSource = Array.isArray(situation.suggestionCards) && situation.suggestionCards.length
          ? situation.suggestionCards
          : (situation.suggestions || []).map((prompt, index) => ({
            id: `situation-${rid}-${index}`,
            title: String(prompt).slice(0, 72),
            prompt: String(prompt),
            rationale: 'Based on this record and related activity.',
            risk: /draft|email|send|create|update/i.test(String(prompt)) ? 'write' : 'read',
          }));
        const cards = cardsSource.slice(0, 4).map((card, index) => ({
          id: card.id || `situation-${rid}-${index}`,
          title: card.title || String(card.prompt || '').slice(0, 72),
          rationale: card.rationale
            || (situation.signals?.expiredQuotes?.length
              ? 'Urgent: related quote needs attention.'
              : 'Grounded on related records, emails, and activity.'),
          kind: 'ask',
          prompt: card.prompt || card.title,
          moduleKey: mk,
          recordId: rid,
          iconKey: card.iconKey || undefined,
          risk: card.risk || (/draft|email|send|create|update/i.test(String(card.prompt || card.title || '')) ? 'write' : 'read'),
        }));
        if (cards.length) {
          return { surface: 'record', cards };
        }
      }
    } catch {
      /* fall through — no static record templates */
    }
    // Situation is the SoT for record NBA; never invent canned prompts.
    return { surface: 'record', cards: [] };
  }

  const moduleCards = buildModuleListCards(mk || surface);
  if (moduleCards.length) {
    return { surface: mk || String(surface || 'home'), cards: moduleCards };
  }

  // Home / workspace: personalize from the user's live workload.
  if (organizationId && (!mk || surface === 'home' || surface === 'copilot' || surface === 'side_panel')) {
    try {
      const homeCards = await buildWorkspaceHomeCards({ organizationId, userId }, deps);
      if (homeCards.length) {
        return { surface: 'home', cards: homeCards };
      }
    } catch {
      /* fall through to generic pipeline cards */
    }
  }

  const contract = getSurfaceContract(surface) || SURFACE_CONTRACTS.home;
  const registry = deps.toolRegistry || toolRegistry;

  const cards = [];
  if (contract.allow.includes('crm.deals') && registry.hasTool('crm.deals')) {
    cards.push({
      id: 'review-open-pipeline',
      title: 'Review your open pipeline',
      rationale: 'Stay on top of deals still in play.',
      kind: 'ask',
      prompt: 'List my open deals',
      tool: 'crm.deals',
      input: { query: 'open deals' },
      risk: 'read',
    });
  }
  if (contract.allow.includes('reports.run') && registry.hasTool('reports.run')) {
    cards.push({
      id: 'open-deal-count',
      title: 'How many open deals do you have?',
      rationale: 'Quick pipeline pulse.',
      kind: 'ask',
      prompt: 'How many open deals do I have?',
      tool: 'reports.run',
      input: { entity: 'deals', openOnly: true, report: 'count' },
      risk: 'read',
    });
  }

  return { surface: contract.id, cards: cards.slice(0, contract.maxCards) };
}

module.exports = {
  SURFACE_CONTRACTS,
  getSurfaceContract,
  listGoals,
  createGoal,
  updateGoal,
  nextBestActions,
};

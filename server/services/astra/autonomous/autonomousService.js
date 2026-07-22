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
const { ensureBootstrapped } = require('../bootstrap');

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
 * Produce ranked, tool-backed suggestion cards for a surface.
 * Grounded: each card references a concrete tool + input, never free text.
 * @returns {Promise<{ surface: string, cards: object[] }>}
 */
async function nextBestActions({ organizationId, userId = null, surface = 'home' }, deps = {}) {
  ensureBootstrapped();
  const contract = getSurfaceContract(surface) || SURFACE_CONTRACTS.home;
  const registry = deps.toolRegistry || toolRegistry;

  const cards = [];
  if (contract.allow.includes('crm.deals') && registry.hasTool('crm.deals')) {
    cards.push({
      id: 'review-open-pipeline',
      title: 'Review your open pipeline',
      rationale: 'Stay on top of deals still in play.',
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

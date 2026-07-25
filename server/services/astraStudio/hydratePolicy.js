'use strict';

/**
 * Per-canvas-type hydrate policy — drives brief kind, fill gates, analytics seeds.
 */

const { SCOPE_BY_TYPE } = require('./canvasIntent');

/**
 * @typedef {object} HydratePolicy
 * @property {string} canvasType
 * @property {import('./canvasIntent').CanvasScope} scope
 * @property {'party'|'org'|'account'|'case'|'project'|'abstract'|'none'} brief
 * @property {boolean} fillWithoutParty
 * @property {boolean} seedAnalytics
 * @property {boolean} seedTimeline
 * @property {boolean} seedComms
 * @property {boolean} seedTasks
 * @property {boolean} allowWebCompetitors
 * @property {'party'|'org'|'abstract'} specialistMode
 * @property {string[]} preferredFocusModules
 */

/** @type {Record<string, Omit<HydratePolicy, 'canvasType'>>} */
const POLICY = Object.freeze({
  meeting_preparation: {
    scope: 'party',
    brief: 'party',
    fillWithoutParty: false,
    seedAnalytics: false,
    seedTimeline: true,
    seedComms: true,
    seedTasks: true,
    allowWebCompetitors: false,
    specialistMode: 'party',
    preferredFocusModules: ['people', 'organizations', 'deals'],
  },
  opportunity_war_room: {
    scope: 'deal',
    brief: 'party',
    fillWithoutParty: false,
    seedAnalytics: true,
    seedTimeline: true,
    seedComms: true,
    seedTasks: true,
    allowWebCompetitors: true,
    specialistMode: 'party',
    preferredFocusModules: ['deals', 'people', 'organizations'],
  },
  customer_360: {
    scope: 'account',
    brief: 'account',
    fillWithoutParty: false,
    seedAnalytics: true,
    seedTimeline: true,
    seedComms: true,
    seedTasks: true,
    allowWebCompetitors: false,
    specialistMode: 'party',
    preferredFocusModules: ['organizations', 'people', 'deals'],
  },
  executive_report: {
    scope: 'org',
    brief: 'org',
    fillWithoutParty: true,
    seedAnalytics: true,
    seedTimeline: false,
    seedComms: false,
    seedTasks: false,
    allowWebCompetitors: false,
    specialistMode: 'org',
    preferredFocusModules: [],
  },
  account_planning: {
    scope: 'account',
    brief: 'account',
    fillWithoutParty: false,
    seedAnalytics: true,
    seedTimeline: true,
    seedComms: true,
    seedTasks: true,
    allowWebCompetitors: false,
    specialistMode: 'party',
    preferredFocusModules: ['organizations', 'deals', 'people'],
  },
  quarterly_business_review: {
    scope: 'account',
    brief: 'account',
    fillWithoutParty: true, // can fall back to org rollup if no account
    seedAnalytics: true,
    seedTimeline: true,
    seedComms: false,
    seedTasks: true,
    allowWebCompetitors: false,
    specialistMode: 'org',
    preferredFocusModules: ['organizations', 'deals'],
  },
  customer_success_plan: {
    scope: 'account',
    brief: 'account',
    fillWithoutParty: false,
    seedAnalytics: true,
    seedTimeline: true,
    seedComms: true,
    seedTasks: true,
    allowWebCompetitors: false,
    specialistMode: 'party',
    preferredFocusModules: ['organizations', 'people', 'cases'],
  },
  renewal_workspace: {
    scope: 'account',
    brief: 'account',
    fillWithoutParty: false,
    seedAnalytics: true,
    seedTimeline: true,
    seedComms: true,
    seedTasks: true,
    allowWebCompetitors: true,
    specialistMode: 'party',
    preferredFocusModules: ['organizations', 'deals', 'quotes'],
  },
  support_investigation: {
    scope: 'case',
    brief: 'case',
    fillWithoutParty: false,
    seedAnalytics: false,
    seedTimeline: true,
    seedComms: true,
    seedTasks: true,
    allowWebCompetitors: false,
    specialistMode: 'party',
    preferredFocusModules: ['cases', 'people', 'organizations'],
  },
  project_workspace: {
    scope: 'project',
    brief: 'project',
    fillWithoutParty: true,
    seedAnalytics: true,
    seedTimeline: true,
    seedComms: false,
    seedTasks: true,
    allowWebCompetitors: false,
    specialistMode: 'abstract',
    preferredFocusModules: ['projects', 'tasks'],
  },
  workflow_design: {
    scope: 'abstract',
    brief: 'abstract',
    fillWithoutParty: true,
    seedAnalytics: false,
    seedTimeline: false,
    seedComms: false,
    seedTasks: false,
    allowWebCompetitors: false,
    specialistMode: 'abstract',
    preferredFocusModules: [],
  },
  brainstorming: {
    scope: 'abstract',
    brief: 'abstract',
    fillWithoutParty: true,
    seedAnalytics: false,
    seedTimeline: false,
    seedComms: false,
    seedTasks: false,
    allowWebCompetitors: false,
    specialistMode: 'abstract',
    preferredFocusModules: [],
  },
  strategy_workspace: {
    scope: 'org',
    brief: 'org',
    fillWithoutParty: true,
    seedAnalytics: true,
    seedTimeline: false,
    seedComms: false,
    seedTasks: false,
    allowWebCompetitors: true,
    specialistMode: 'org',
    preferredFocusModules: [],
  },
  blank: {
    scope: 'abstract',
    brief: 'none',
    fillWithoutParty: true,
    seedAnalytics: false,
    seedTimeline: false,
    seedComms: false,
    seedTasks: false,
    allowWebCompetitors: false,
    specialistMode: 'abstract',
    preferredFocusModules: [],
  },
});

/**
 * @param {string} canvasType
 * @param {{ scope?: string }} [intent]
 * @returns {HydratePolicy}
 */
function getHydratePolicy(canvasType = '', intent = null) {
  const type = String(canvasType || 'blank');
  const base = POLICY[type] || POLICY.blank;
  const scope = intent?.scope || base.scope || SCOPE_BY_TYPE[type] || 'abstract';
  // Intent can promote QBR without account → org brief
  let brief = base.brief;
  if (scope === 'org' && (brief === 'account' || brief === 'party')) {
    brief = 'org';
  }
  if (scope === 'abstract' && brief === 'party') {
    brief = 'abstract';
  }
  return {
    canvasType: type,
    scope,
    brief,
    fillWithoutParty: Boolean(base.fillWithoutParty || scope === 'org' || scope === 'abstract'),
    seedAnalytics: Boolean(base.seedAnalytics),
    seedTimeline: Boolean(base.seedTimeline),
    seedComms: Boolean(base.seedComms),
    seedTasks: Boolean(base.seedTasks),
    allowWebCompetitors: Boolean(base.allowWebCompetitors),
    specialistMode: scope === 'org' ? 'org' : (base.specialistMode || 'party'),
    preferredFocusModules: [...(base.preferredFocusModules || [])],
  };
}

function listHydratePolicies() {
  return Object.keys(POLICY).map((k) => getHydratePolicy(k));
}

module.exports = {
  POLICY,
  getHydratePolicy,
  listHydratePolicies,
};

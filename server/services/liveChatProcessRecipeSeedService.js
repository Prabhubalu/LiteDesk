'use strict';

const Process = require('../models/Process');
const Organization = require('../models/Organization');
const domainEvents = require('../constants/domainEvents');
const { isAppEnabledForOrg } = require('../utils/appAccessUtils');
const { APP_KEYS } = require('../constants/appKeys');

const RECIPE_PREFIX = 'live_chat_recipe:';

const RECIPE_DEFINITIONS = [
  {
    recipeKey: 'missed_notify',
    name: 'Live Chat — Missed chat: supervisor task',
    description: `${RECIPE_PREFIX}missed_notify — Creates a follow-up task when a session ends with outcome missed.`,
    always: true,
    buildAction: () => ({
      actionType: 'create_task',
      params: {
        title: 'Review missed live chat session',
        description: 'A visitor chat ended with outcome missed. Open Live Chat → Sessions to review.',
        assignee: 'triggeredBy',
        dueInDays: 1,
        relatedEntity: { entityId: '__trigger__' },
      },
    }),
  },
  {
    recipeKey: 'missed_create_case',
    name: 'Live Chat — Missed chat: create Helpdesk case',
    description: `${RECIPE_PREFIX}missed_create_case — Creates a Helpdesk case when a session ends missed (session reference only).`,
    requiresApp: APP_KEYS.HELPDESK,
    buildAction: () => ({
      actionType: 'live_chat_create_case',
      params: {},
    }),
  },
  {
    recipeKey: 'missed_create_lead',
    name: 'Live Chat — Missed chat: create Sales lead',
    description: `${RECIPE_PREFIX}missed_create_lead — Creates or links a Sales lead when a session ends missed (session reference only).`,
    requiresApp: APP_KEYS.SALES,
    buildAction: () => ({
      actionType: 'live_chat_create_lead',
      params: {},
    }),
  },
];

function buildMissedOutcomeProcess({ name, description, actionConfig, createdBy }) {
  const actionNodeId = 'action_1';
  return {
    name,
    description,
    appKey: 'PLATFORM',
    entityType: 'live_chat_session',
    trigger: {
      type: 'domain_event',
      eventType: domainEvents.LIVE_CHAT_SESSION_ENDED,
    },
    triggerConfigured: true,
    status: 'active',
    version: 1,
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        config: { entityType: 'live_chat_session' },
        order: 1,
      },
      {
        id: 'condition_1',
        type: 'condition',
        config: {
          field: 'event.currentState.outcome',
          operator: 'equals',
          value: 'missed',
        },
        order: 2,
      },
      {
        id: actionNodeId,
        type: 'action',
        config: actionConfig,
        order: 3,
      },
      {
        id: 'end_1',
        type: 'end',
        config: {},
        order: 4,
      },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'trigger_1', toNodeId: 'condition_1' },
      { id: 'e2', fromNodeId: 'condition_1', toNodeId: actionNodeId, condition: true },
      { id: 'e3', fromNodeId: 'condition_1', toNodeId: 'end_1', condition: false },
      { id: 'e4', fromNodeId: actionNodeId, toNodeId: 'end_1' },
    ],
    createdBy: createdBy || null,
  };
}

async function recipeAlreadySeeded(organizationId, recipeKey) {
  const marker = `${RECIPE_PREFIX}${recipeKey}`;
  const existing = await Process.findOne({
    description: { $regex: marker },
  })
    .select('_id')
    .lean();
  return Boolean(existing);
}

async function seedLiveChatProcessRecipesForOrganization(organizationId, { initiatedByUserId = null } = {}) {
  if (!organizationId) {
    return { seeded: 0, skipped: 0, recipes: [] };
  }

  const org = await Organization.findById(organizationId).select('enabledApps').lean();
  if (!org) {
    return { seeded: 0, skipped: 0, recipes: [], error: 'ORG_NOT_FOUND' };
  }

  const results = [];
  let seeded = 0;
  let skipped = 0;

  for (const recipe of RECIPE_DEFINITIONS) {
    if (recipe.requiresApp && !isAppEnabledForOrg(org, recipe.requiresApp)) {
      skipped += 1;
      results.push({ recipeKey: recipe.recipeKey, status: 'skipped_app_disabled' });
      continue;
    }

    if (await recipeAlreadySeeded(organizationId, recipe.recipeKey)) {
      skipped += 1;
      results.push({ recipeKey: recipe.recipeKey, status: 'skipped_exists' });
      continue;
    }

    const payload = buildMissedOutcomeProcess({
      name: recipe.name,
      description: recipe.description,
      actionConfig: recipe.buildAction(),
      createdBy: initiatedByUserId,
    });

    const row = await Process.create(payload);
    seeded += 1;
    results.push({ recipeKey: recipe.recipeKey, status: 'seeded', processId: String(row._id) });
  }

  return { seeded, skipped, recipes: results };
}

module.exports = {
  RECIPE_PREFIX,
  RECIPE_DEFINITIONS,
  seedLiveChatProcessRecipesForOrganization,
};

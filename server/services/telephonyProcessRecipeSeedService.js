'use strict';

const Process = require('../models/Process');
const Organization = require('../models/Organization');
const domainEvents = require('../constants/domainEvents');

const RECIPE_PREFIX = 'telephony_recipe:';

const RECIPE_DEFINITIONS = [
  {
    recipeKey: 'missed_create_task',
    name: 'Telephony — Missed call: create task',
    description: `${RECIPE_PREFIX}missed_create_task — Creates a follow-up task when a call is missed.`,
    always: true,
    buildAction: () => ({
      actionType: 'create_task',
      params: {
        title: 'Follow up on missed call',
        description: 'A telephony call was missed. Open Telephony → Calls to review and follow up.',
        assignee: 'triggeredBy',
        dueInDays: 1,
        relatedEntity: { entityId: '__trigger__' },
      },
    }),
  },
];

function buildMissedCallProcess({ name, description, actionConfig, createdBy }) {
  const actionNodeId = 'action_1';
  return {
    name,
    description,
    appKey: 'PLATFORM',
    entityType: 'telephony_call',
    trigger: {
      type: 'domain_event',
      eventType: domainEvents.TELEPHONY_CALL_MISSED,
    },
    triggerConfigured: true,
    status: 'active',
    version: 1,
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        config: { entityType: 'telephony_call' },
        order: 1,
      },
      {
        id: actionNodeId,
        type: 'action',
        config: actionConfig,
        order: 2,
      },
      {
        id: 'end_1',
        type: 'end',
        config: {},
        order: 3,
      },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'trigger_1', toNodeId: actionNodeId },
      { id: 'e2', fromNodeId: actionNodeId, toNodeId: 'end_1' },
    ],
    createdBy: createdBy || null,
  };
}

async function recipeAlreadySeeded(organizationId, recipeKey) {
  const marker = `${RECIPE_PREFIX}${recipeKey}`;
  const existing = await Process.findOne({
    organizationId,
    description: { $regex: marker },
  })
    .select('_id')
    .lean();
  return Boolean(existing);
}

async function seedTelephonyProcessRecipesForOrganization(
  organizationId,
  { initiatedByUserId = null } = {}
) {
  if (!organizationId) {
    return { seeded: 0, skipped: 0, recipes: [] };
  }

  const org = await Organization.findById(organizationId).select('_id').lean();
  if (!org) {
    return { seeded: 0, skipped: 0, recipes: [], error: 'ORG_NOT_FOUND' };
  }

  const results = [];
  let seeded = 0;
  let skipped = 0;

  for (const recipe of RECIPE_DEFINITIONS) {
    if (await recipeAlreadySeeded(organizationId, recipe.recipeKey)) {
      skipped += 1;
      results.push({ recipeKey: recipe.recipeKey, status: 'skipped_exists' });
      continue;
    }

    const payload = buildMissedCallProcess({
      name: recipe.name,
      description: recipe.description,
      actionConfig: recipe.buildAction(),
      createdBy: initiatedByUserId,
    });

    const row = await Process.create({ ...payload, organizationId });
    seeded += 1;
    results.push({
      recipeKey: recipe.recipeKey,
      status: 'seeded',
      processId: String(row._id),
    });
  }

  return { seeded, skipped, recipes: results };
}

module.exports = {
  seedTelephonyProcessRecipesForOrganization,
  RECIPE_DEFINITIONS,
};

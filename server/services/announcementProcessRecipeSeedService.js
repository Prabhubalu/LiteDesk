'use strict';

const Process = require('../models/Process');
const domainEvents = require('../constants/domainEvents');

const RECIPE_PREFIX = 'announcements_recipe:';

function buildLinearProcess({
  name,
  description,
  eventType,
  actionConfig,
  createdBy,
}) {
  return {
    name,
    description,
    appKey: 'PLATFORM',
    entityType: 'announcement',
    trigger: {
      type: 'domain_event',
      eventType,
    },
    triggerConfigured: true,
    status: 'active',
    version: 1,
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        config: { entityType: 'announcement' },
        order: 1,
      },
      {
        id: 'action_1',
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
      { id: 'e1', fromNodeId: 'trigger_1', toNodeId: 'action_1' },
      { id: 'e2', fromNodeId: 'action_1', toNodeId: 'end_1' },
    ],
    createdBy: createdBy || null,
  };
}

const RECIPE_DEFINITIONS = [
  {
    recipeKey: 'ack_follow_up_task',
    name: 'Announcements — Acknowledgement follow-up',
    description: `${RECIPE_PREFIX}ack_follow_up_task — Creates a follow-up task when a user acknowledges an announcement.`,
    buildProcess: ({ createdBy }) => buildLinearProcess({
      name: 'Announcements — Acknowledgement follow-up',
      description: `${RECIPE_PREFIX}ack_follow_up_task — Creates a follow-up task when a user acknowledges an announcement.`,
      eventType: domainEvents.ANNOUNCEMENT_ACKNOWLEDGED,
      createdBy,
      actionConfig: {
        actionType: 'create_task',
        params: {
          title: 'Follow up on announcement acknowledgement',
          description: 'A user acknowledged an announcement. Review engagement if needed.',
          assignee: 'triggeredBy',
          dueInDays: 1,
          relatedEntity: { entityId: '__trigger__' },
        },
      },
    }),
  },
  {
    recipeKey: 'cta_follow_up_task',
    name: 'Announcements — CTA click follow-up',
    description: `${RECIPE_PREFIX}cta_follow_up_task — Creates a follow-up task when a user clicks an announcement CTA.`,
    buildProcess: ({ createdBy }) => buildLinearProcess({
      name: 'Announcements — CTA click follow-up',
      description: `${RECIPE_PREFIX}cta_follow_up_task — Creates a follow-up task when a user clicks an announcement CTA.`,
      eventType: domainEvents.ANNOUNCEMENT_CTA_CLICKED,
      createdBy,
      actionConfig: {
        actionType: 'create_task',
        params: {
          title: 'Follow up on announcement CTA click',
          description: 'A user clicked a CTA on an announcement. Follow up if conversion support is needed.',
          assignee: 'triggeredBy',
          dueInDays: 1,
          relatedEntity: { entityId: '__trigger__' },
        },
      },
    }),
  },
  {
    recipeKey: 'published_owner_notify',
    name: 'Announcements — Notify publisher on publish',
    description: `${RECIPE_PREFIX}published_owner_notify — Sends an in-app alert to the publisher when an announcement is published.`,
    buildProcess: ({ createdBy }) => buildLinearProcess({
      name: 'Announcements — Notify publisher on publish',
      description: `${RECIPE_PREFIX}published_owner_notify — Sends an in-app alert to the publisher when an announcement is published.`,
      eventType: domainEvents.ANNOUNCEMENT_PUBLISHED,
      createdBy,
      actionConfig: {
        actionType: 'notify_user',
        params: {
          message: 'Your announcement was published and is now live for the audience.',
          recipient: 'triggeredBy',
        },
      },
    }),
  },
];

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

async function seedAnnouncementProcessRecipesForOrganization(organizationId, { initiatedByUserId = null } = {}) {
  if (!organizationId) {
    return { seeded: 0, skipped: 0, recipes: [] };
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

    const payload = recipe.buildProcess({ createdBy: initiatedByUserId });
    const row = await Process.create({
      ...payload,
      organizationId,
    });
    seeded += 1;
    results.push({ recipeKey: recipe.recipeKey, status: 'seeded', processId: String(row._id) });
  }

  return { seeded, skipped, recipes: results };
}

module.exports = {
  RECIPE_PREFIX,
  RECIPE_DEFINITIONS,
  seedAnnouncementProcessRecipesForOrganization,
};

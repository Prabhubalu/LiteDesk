'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const domainEvents = require('../../constants/domainEvents');
const {
  RECIPE_DEFINITIONS,
  RECIPE_PREFIX,
} = require('../announcementProcessRecipeSeedService');

describe('announcementProcessRecipeSeedService', () => {
  it('defines ack, cta, and published recipes with unique keys', () => {
    const keys = RECIPE_DEFINITIONS.map((r) => r.recipeKey);
    assert.deepEqual(keys.sort(), [
      'ack_follow_up_task',
      'cta_follow_up_task',
      'published_owner_notify',
    ].sort());
    assert.equal(new Set(keys).size, keys.length);
  });

  it('builds processes with marker descriptions and wired domain events', () => {
    const byKey = Object.fromEntries(
      RECIPE_DEFINITIONS.map((recipe) => [recipe.recipeKey, recipe]),
    );

    const ack = byKey.ack_follow_up_task.buildProcess({ createdBy: null });
    assert.match(ack.description, new RegExp(`${RECIPE_PREFIX}ack_follow_up_task`));
    assert.equal(ack.trigger.eventType, domainEvents.ANNOUNCEMENT_ACKNOWLEDGED);
    assert.equal(ack.nodes.find((n) => n.type === 'action')?.config?.actionType, 'create_task');

    const cta = byKey.cta_follow_up_task.buildProcess({ createdBy: null });
    assert.match(cta.description, new RegExp(`${RECIPE_PREFIX}cta_follow_up_task`));
    assert.equal(cta.trigger.eventType, domainEvents.ANNOUNCEMENT_CTA_CLICKED);
    assert.equal(cta.nodes.find((n) => n.type === 'action')?.config?.actionType, 'create_task');

    const published = byKey.published_owner_notify.buildProcess({ createdBy: null });
    assert.match(published.description, new RegExp(`${RECIPE_PREFIX}published_owner_notify`));
    assert.equal(published.trigger.eventType, domainEvents.ANNOUNCEMENT_PUBLISHED);
    assert.equal(published.nodes.find((n) => n.type === 'action')?.config?.actionType, 'notify_user');
  });

  it('keeps trigger → action → end graph intact', () => {
    for (const recipe of RECIPE_DEFINITIONS) {
      const process = recipe.buildProcess({ createdBy: 'user-1' });
      const nodeIds = new Set(process.nodes.map((n) => n.id));
      assert.ok(nodeIds.has('trigger_1'));
      assert.ok(nodeIds.has('action_1'));
      assert.ok(nodeIds.has('end_1'));
      assert.equal(process.edges.length, 2);
      assert.equal(process.status, 'active');
      assert.equal(process.entityType, 'announcement');
      assert.equal(process.createdBy, 'user-1');
    }
  });
});

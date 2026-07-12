'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveTriggerBehaviour,
  buildFirstTimeKey
} = require('../processTriggerUtils');

describe('triggerBehaviour helpers', () => {
  it('resolveTriggerBehaviour defaults to every_time', () => {
    assert.equal(resolveTriggerBehaviour(null), 'every_time');
    assert.equal(resolveTriggerBehaviour({}), 'every_time');
    assert.equal(resolveTriggerBehaviour({ triggerBehaviour: 'every_time' }), 'every_time');
    assert.equal(resolveTriggerBehaviour({ triggerBehaviour: 'first_time' }), 'first_time');
  });

  it('resolveTriggerBehaviour forces every_time for schedule', () => {
    assert.equal(
      resolveTriggerBehaviour({
        triggerBehaviour: 'first_time',
        trigger: { type: 'schedule', schedule: { preset: 'daily' } }
      }),
      'every_time'
    );
  });

  it('triggerBehaviourApplies is false for schedule', () => {
    const { triggerBehaviourApplies } = require('../processTriggerUtils');
    assert.equal(triggerBehaviourApplies({ trigger: { type: 'schedule' } }), false);
    assert.equal(
      triggerBehaviourApplies({
        entityType: 'people',
        trigger: { type: 'domain_event', eventType: 'people.created' }
      }),
      true
    );
  });

  it('buildFirstTimeKey scopes process + entity + org', () => {
    assert.equal(buildFirstTimeKey(null, 'e1', 'o1'), null);
    assert.equal(buildFirstTimeKey('p1', null, 'o1'), null);
    assert.equal(buildFirstTimeKey('p1', '', 'o1'), null);
    assert.equal(buildFirstTimeKey('p1', 'e1', 'o1'), 'p1:e1:o1');
    assert.equal(buildFirstTimeKey('p1', 'e1', null), 'p1:e1:');
  });
});

describe('record_created_or_updated matching', () => {
  it('domainEventProcessMatchFilter includes created counterpart', () => {
    const { domainEventProcessMatchFilter } = require('../processTriggerUtils');
    const filter = domainEventProcessMatchFilter('people.created');
    assert.deepEqual(filter.$or, [
      { 'trigger.eventType': 'people.created' },
      { 'trigger.includeCreated': true, 'trigger.eventType': 'people.updated' }
    ]);
  });

  it('matchesUpdateWatch allows create when includeCreated', () => {
    const { matchesUpdateWatch } = require('../processTriggerUtils');
    assert.equal(
      matchesUpdateWatch(
        { type: 'domain_event', includeCreated: true, updateWatch: { mode: 'fields', fields: ['stage'] } },
        { eventType: 'deal.created', changedFields: [] }
      ),
      true
    );
  });

  it('resolveCoreTriggerFromProcess detects includeCreated', () => {
    const { resolveCoreTriggerFromProcess } = require('../processTriggerUtils');
    assert.equal(
      resolveCoreTriggerFromProcess({
        entityType: 'people',
        trigger: { type: 'domain_event', eventType: 'people.updated', includeCreated: true }
      }),
      'record_created_or_updated'
    );
  });
});

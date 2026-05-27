const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  mapChannelDuplicateHandling,
  mapChannelRuleToMailroomPolicies,
  buildMigrationPlan,
  mergeMailroomPolicies
} = require('../../platform/mailroom/migration/channelRulesMapper');

describe('channelRules → Mailroom policies mapper', () => {
  it('maps duplicateHandling variants', () => {
    assert.equal(
      mapChannelDuplicateHandling({ duplicateHandling: 'flag_for_review' }),
      'flag_for_review'
    );
    assert.equal(
      mapChannelDuplicateHandling({ onDuplicate: 'create_child_case' }),
      'create_child_case'
    );
    assert.equal(mapChannelDuplicateHandling({}), 'append_to_existing_open_case');
  });

  it('maps channel rule to dedup + caseLink defaults', () => {
    const patch = mapChannelRuleToMailroomPolicies({
      duplicateHandling: 'flag_for_review',
      defaultCaseType: 'Complaint',
      defaultPriority: 'High'
    });
    assert.equal(patch.dedup.onDuplicate, 'flag_for_review');
    assert.equal(patch.caseLink.defaults.caseType, 'Complaint');
    assert.equal(patch.caseLink.defaults.priority, 'High');
  });

  it('buildMigrationPlan merges into template base', () => {
    const plan = buildMigrationPlan({
      channelRules: {
        Email: {
          duplicateHandling: 'append_to_existing_open_case',
          defaultCaseType: 'Service Request',
          defaultPriority: 'Low'
        }
      },
      mailroomRow: null
    });
    assert.equal(plan.skipped, false);
    assert.equal(plan.channel, 'Email');
    assert.equal(plan.policies.dedup.onDuplicate, 'append_to_existing_open_case');
    assert.equal(plan.policies.caseLink.defaults.caseType, 'Service Request');
    assert.ok(Array.isArray(plan.policies.threading?.strategies));
  });

  it('skips when channel rules empty', () => {
    const plan = buildMigrationPlan({ channelRules: {}, mailroomRow: null });
    assert.equal(plan.skipped, true);
  });

  it('mergeMailroomPolicies preserves threading signals', () => {
    const base = {
      threading: { strategies: [{ id: 'a', signal: 'message_id', enabled: true }] },
      dedup: { signals: [{ signal: 'thread_id', weight: 90 }], onDuplicate: 'ignore' },
      caseLink: { defaults: { caseType: 'Support Ticket' } }
    };
    const merged = mergeMailroomPolicies(base, {
      dedup: { onDuplicate: 'flag_for_review' },
      caseLink: { defaults: { priority: 'Critical' } }
    });
    assert.equal(merged.threading.strategies.length, 1);
    assert.equal(merged.dedup.onDuplicate, 'flag_for_review');
    assert.equal(merged.dedup.signals.length, 1);
    assert.equal(merged.caseLink.defaults.caseType, 'Support Ticket');
    assert.equal(merged.caseLink.defaults.priority, 'Critical');
  });
});

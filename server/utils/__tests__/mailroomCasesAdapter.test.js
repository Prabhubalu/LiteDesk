const { describe, it } = require('node:test');
const assert = require('node:assert');
const { resolveCaseExecutionPlan } = require('../../platform/mailroom/adapters/casesAdapter');

describe('mailroom cases adapter', () => {
  it('prefers threading case for dedup append', () => {
    const plan = resolveCaseExecutionPlan({
      threading: {
        matched: true,
        target: { caseId: 'case-thread', conversationId: 'conv1' }
      },
      dedup: {
        isDuplicate: true,
        behavior: 'append_to_existing_open_case'
      },
      caseLink: {
        action: 'append',
        caseId: 'case-other',
        reason: 'open_case_match'
      }
    });
    assert.equal(plan.action, 'append');
    assert.equal(plan.caseId, 'case-thread');
    assert.equal(plan.reason, 'dedup_append');
  });

  it('honors dedup ignore', () => {
    const plan = resolveCaseExecutionPlan({
      dedup: { isDuplicate: true, behavior: 'ignore' },
      caseLink: { action: 'create_case', caseId: null }
    });
    assert.equal(plan.action, 'no_op');
  });

  it('uses case_link create when no duplicate', () => {
    const plan = resolveCaseExecutionPlan({
      dedup: { isDuplicate: false, behavior: 'continue' },
      caseLink: { action: 'create_case', caseId: null, reason: 'no_match' }
    });
    assert.equal(plan.action, 'create_case');
  });
});

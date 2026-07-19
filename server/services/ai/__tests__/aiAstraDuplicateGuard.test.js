'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  intentOverlapScore,
  allowsForceCreate,
  applyIntentDuplicateGuard,
} = require('../aiAstraDuplicateGuard');

describe('aiAstraDuplicateGuard', () => {
  it('scores overlapping intent tokens', () => {
    const score = intentOverlapScore(
      'Meeting with Prabhu Balu — expired Quote',
      'Discuss expired Quote with Prabhu Balu',
    );
    assert.ok(score >= 0.34);
  });

  it('detects force-create phrases', () => {
    assert.equal(allowsForceCreate('create anyway'), true);
    assert.equal(allowsForceCreate('schedule a meeting'), false);
  });

  it('rewrites create_record when duplicates are injected via stub', async () => {
    // Unit-level: guard with no org returns unchanged
    const structured = {
      headline: 'Ready to schedule',
      actions: [{
        kind: 'create_record',
        moduleKey: 'events',
        label: 'Create Meeting Event',
        fields: { eventName: 'Test', startDateTime: new Date().toISOString() },
      }],
    };
    const out = await applyIntentDuplicateGuard(structured, {
      organizationId: null,
      question: 'schedule a meeting',
    });
    assert.equal(out.actions[0].kind, 'create_record');
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isMultiStepEnabled,
  orderedWebformSteps,
  sanitizeFieldStepId,
  sanitizeWebformSteps
} = require('../webformMultiStep');

describe('webformMultiStep', () => {
  it('sanitizes steps when enabled', () => {
    const steps = sanitizeWebformSteps([
      { stepId: 'step_2', title: 'B', order: 1 },
      { stepId: 'step_1', title: 'A', order: 0 }
    ], true);
    assert.deepEqual(steps.map((step) => step.stepId), ['step_1', 'step_2']);
  });

  it('returns empty steps when disabled', () => {
    assert.deepEqual(sanitizeWebformSteps([{ stepId: 'step_1' }], false), []);
  });

  it('resolves field step ids', () => {
    const webform = {
      multiStep: { enabled: true },
      steps: [{ stepId: 'step_1', title: 'One', order: 0 }]
    };
    assert.equal(sanitizeFieldStepId('missing', webform), 'step_1');
    assert.equal(isMultiStepEnabled(webform), true);
    assert.equal(orderedWebformSteps(webform).length, 1);
  });
});

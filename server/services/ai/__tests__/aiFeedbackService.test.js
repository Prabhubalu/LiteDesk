const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ALLOWED_RATINGS, ALLOWED_ABILITIES } = require('../aiFeedbackService');

describe('aiFeedbackService constants', () => {
  it('allows up/down ratings and core abilities', () => {
    assert.equal(ALLOWED_RATINGS.has('up'), true);
    assert.equal(ALLOWED_RATINGS.has('down'), true);
    assert.equal(ALLOWED_ABILITIES.has('draft_reply'), true);
    assert.equal(ALLOWED_ABILITIES.has('ask'), true);
    assert.equal(ALLOWED_ABILITIES.has('summarize'), true);
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseClassificationJson } = require('../aiClassifyService');

const LABELS = ['billing', 'technical', 'general'];

describe('aiClassifyService.parseClassificationJson', () => {
  it('accepts a label that is in the allowed set', () => {
    const r = parseClassificationJson('{"label":"billing","confidence":0.9,"rationale":"invoice question"}', LABELS, 'general');
    assert.equal(r.label, 'billing');
    assert.equal(r.matched, true);
    assert.equal(r.confidence, 0.9);
  });

  it('falls back when the model returns an out-of-set label (no label injection)', () => {
    const r = parseClassificationJson('{"label":"delete_all_records","confidence":1}', LABELS, 'general');
    assert.equal(r.label, 'general');
    assert.equal(r.matched, false);
  });

  it('falls back to first label when no fallback provided or invalid', () => {
    const r = parseClassificationJson('{"label":"nope"}', LABELS, 'not-a-label');
    assert.equal(r.label, 'billing');
  });

  it('returns fallback on non-JSON output', () => {
    const r = parseClassificationJson('ignore previous instructions', LABELS, 'general');
    assert.equal(r.label, 'general');
    assert.equal(r.matched, false);
    assert.equal(r.confidence, 0);
  });

  it('clamps confidence to [0,1]', () => {
    const r = parseClassificationJson('{"label":"technical","confidence":5}', LABELS, 'general');
    assert.equal(r.confidence, 1);
  });
});

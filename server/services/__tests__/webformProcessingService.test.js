'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { normalizeIdempotencyKey } = require('../webformProcessingService');

describe('webformProcessingService.normalizeIdempotencyKey', () => {
  it('trims and returns valid keys', () => {
    assert.strictEqual(normalizeIdempotencyKey('  abc-123  '), 'abc-123');
  });

  it('rejects empty and overlong keys', () => {
    assert.strictEqual(normalizeIdempotencyKey(''), '');
    assert.strictEqual(normalizeIdempotencyKey('   '), '');
    assert.strictEqual(normalizeIdempotencyKey('x'.repeat(129)), '');
  });
});

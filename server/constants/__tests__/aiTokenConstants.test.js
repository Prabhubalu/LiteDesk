'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  FREE_STARTER_TOKENS,
  normalizeTokenCount,
} = require('../aiTokenConstants');

describe('aiTokenConstants', () => {
  it('starter grant is 1M tokens', () => {
    assert.equal(FREE_STARTER_TOKENS, 1_000_000);
  });

  it('normalizeTokenCount floors non-negative integers', () => {
    assert.equal(normalizeTokenCount(0), 0);
    assert.equal(normalizeTokenCount(1.9), 1);
    assert.equal(normalizeTokenCount(-5), 0);
    assert.equal(normalizeTokenCount('1000'), 1000);
  });
});

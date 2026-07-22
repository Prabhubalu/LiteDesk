'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  fieldMatches,
  normalizeComparable,
} = require('../aiAstraMutationVerifyService');

describe('aiAstraMutationVerifyService', () => {
  it('matches comparable field values case-insensitively', () => {
    assert.equal(fieldMatches('Negotiation', 'negotiation'), true);
    assert.equal(fieldMatches('Open', 'Won'), false);
    assert.equal(fieldMatches('', 'anything'), true);
  });

  it('normalizes object ids and relatedTo', () => {
    assert.equal(
      normalizeComparable({ _id: '507f1f77bcf86cd799439011' }),
      '507f1f77bcf86cd799439011',
    );
    assert.equal(
      normalizeComparable({ type: 'deal', id: '507f1f77bcf86cd799439011' }),
      'deal:507f1f77bcf86cd799439011',
    );
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMergeTagExpression } = require('../mergeTagPathNormalizer');

describe('mergeTagPathNormalizer', () => {
  it('normalizes uppercase scope and field segments', () => {
    assert.equal(normalizeMergeTagExpression('ORGANIZATION.NAME'), 'Organization.name');
    assert.equal(normalizeMergeTagExpression('organization.name'), 'Organization.name');
    assert.equal(normalizeMergeTagExpression('CurrentOrganization.NAME'), 'CurrentOrganization.name');
  });

  it('preserves format pipes', () => {
    assert.equal(
      normalizeMergeTagExpression('QUOTE.GRANDTOTAL|currency'),
      'Quote.grandtotal|currency'
    );
  });
});

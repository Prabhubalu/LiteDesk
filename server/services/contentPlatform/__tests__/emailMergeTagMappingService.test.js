'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeMergeMappings
} = require('../emailMergeTagMappingService');

describe('emailMergeTagMappingService', () => {
  it('normalizes valid mappings and drops invalid entries', () => {
    const result = normalizeMergeMappings({
      '{{FirstName}}': { path: 'People.firstName' },
      '*|FNAME|*': { skip: true },
      '': { path: 'People.lastName' },
      bad: { path: '' }
    });

    assert.deepEqual(result, {
      '{{FirstName}}': { path: 'People.firstName', skip: false },
      '*|FNAME|*': { skip: true }
    });
  });

  it('rejects mappings above the max entry count', () => {
    const input = {};
    for (let i = 0; i <= 500; i += 1) {
      input[`tag-${i}`] = { path: `People.field${i}` };
    }

    assert.throws(
      () => normalizeMergeMappings(input),
      (error) => error?.statusCode === 400
    );
  });
});

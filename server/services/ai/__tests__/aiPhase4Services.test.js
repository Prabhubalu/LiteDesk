'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseJsonObject } = require('../aiMarketingService');
const { parseMappingSuggestions } = require('../aiImportMappingService');
const { getPrompt } = require('../prompts/promptRegistry');

describe('Phase 4 marketing + import AI helpers', () => {
  it('parseJsonObject extracts fenced object', () => {
    const obj = parseJsonObject('Here:\n{"subjects":["A","B"]}');
    assert.deepEqual(obj.subjects, ['A', 'B']);
  });

  it('parseMappingSuggestions rejects unknown fieldKeys and unknown headers', () => {
    const mappings = parseMappingSuggestions(
      JSON.stringify({
        mappings: [
          { header: 'Email Address', fieldKey: 'email', confidence: 0.9 },
          { header: 'Email Address', fieldKey: 'email', confidence: 0.5 },
          { header: 'Bogus', fieldKey: 'email', confidence: 1 },
          { header: 'Phone', fieldKey: 'not_a_real_field', confidence: 1 },
        ],
      }),
      ['Email Address', 'Phone'],
      [{ fieldKey: 'email', label: 'Email' }, { fieldKey: 'phone', label: 'Phone' }]
    );
    assert.equal(mappings.length, 1);
    assert.equal(mappings[0].fieldKey, 'email');
    assert.equal(mappings[0].confirmRequired, true);
  });

  it('registers phase 4 prompts', () => {
    for (const key of [
      'marketing_subject_system',
      'marketing_body_system',
      'marketing_summary_system',
      'import_mapping_system',
    ]) {
      assert.equal(getPrompt(key).version, 'v1');
    }
  });
});

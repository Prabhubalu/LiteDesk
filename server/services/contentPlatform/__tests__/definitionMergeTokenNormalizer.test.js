'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeDefinitionMergeTokens } = require('../engines/definitionMergeTokenNormalizer');
const { resolveComponentTree } = require('../engines/componentResolver');

describe('definitionMergeTokenNormalizer', () => {
  it('converts builder merge chip HTML back to merge tokens', () => {
    const definition = {
      id: 'root',
      type: 'Page',
      children: [{
        id: 'p1',
        type: 'Paragraph',
        bindings: {
          text: '<span class="builder-merge-chip" contenteditable="false" data-merge-path="People.first_name">People.first_name</span>'
        },
        children: []
      }]
    };

    const normalized = normalizeDefinitionMergeTokens(definition);
    assert.equal(normalized.children[0].bindings.text, '{{People.first_name}}');

    const scope = { People: { first_name: 'Jane' } };
    const { root } = resolveComponentTree(normalized, scope, { lenient: true });
    assert.equal(root.children[0].bindings.text, 'Jane');
  });
});

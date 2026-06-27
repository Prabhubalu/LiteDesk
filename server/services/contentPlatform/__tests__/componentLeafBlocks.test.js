'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { CONTENT_COMPONENT_TYPES } = require('../../../constants/contentComponentRegistry');
const { resolveComponentTree } = require('../engines/componentResolver');
const { buildLayoutTree } = require('../engines/layoutTreeBuilder');
const { renderLayoutTreeToHtml } = require('../renderers/htmlRenderer');
const { buildComponentLeafBlock } = require('../engines/componentLeafBlocks');

describe('componentLeafBlocks', () => {
  it('builds link blocks with href', () => {
    const block = buildComponentLeafBlock({
      type: CONTENT_COMPONENT_TYPES.LINK,
      name: 'Link',
      bindings: { text: 'Visit site', href: 'https://example.com' }
    });
    assert.equal(block.type, 'Link');
    assert.equal(block.href, 'https://example.com');
    assert.equal(block.html, 'Visit site');
  });

  it('builds list blocks from items array', () => {
    const block = buildComponentLeafBlock({
      type: CONTENT_COMPONENT_TYPES.LIST,
      bindings: { items: ['Alpha', 'Beta'], ordered: true }
    });
    assert.equal(block.type, 'List');
    assert.deepEqual(block.items, ['Alpha', 'Beta']);
    assert.equal(block.ordered, true);
  });

  it('builds placeholder blocks for CRM components', () => {
    const block = buildComponentLeafBlock({
      type: CONTENT_COMPONENT_TYPES.ADDRESS_BLOCK,
      name: 'Address Block',
      bindings: { path: 'Organization' }
    });
    assert.equal(block.type, 'ComponentPlaceholder');
    assert.match(block.html, /Organization/);
  });
});

describe('content render pipeline (component coverage)', () => {
  it('renders catalog stub components in HTML preview', () => {
    const definition = {
      id: 'page-1',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      name: 'Page',
      bindings: {},
      children: [
        {
          id: 'link-1',
          type: CONTENT_COMPONENT_TYPES.LINK,
          bindings: { text: 'Portal', href: 'https://portal.example.com' },
          children: []
        },
        {
          id: 'list-1',
          type: CONTENT_COMPONENT_TYPES.LIST,
          bindings: { items: ['One', 'Two'], ordered: false },
          children: []
        },
        {
          id: 'qr-1',
          type: CONTENT_COMPONENT_TYPES.QR_CODE,
          bindings: { value: '{{Quote.id}}' },
          children: []
        },
        {
          id: 'totals-1',
          type: CONTENT_COMPONENT_TYPES.TOTALS,
          bindings: { showSubtotal: true, showTax: true, showGrandTotal: true },
          children: []
        },
        {
          id: 'section-1',
          type: CONTENT_COMPONENT_TYPES.SECTION,
          bindings: {},
          children: [
            {
              id: 'heading-1',
              type: CONTENT_COMPONENT_TYPES.HEADING,
              bindings: { text: 'Nested heading', level: 2 },
              children: []
            }
          ]
        }
      ]
    };

    const scope = { Quote: { id: 'QT-1' } };
    const { root, issues } = resolveComponentTree(definition, scope, { lenient: true });
    assert.equal(issues.length, 0);

    const layoutTree = buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    });
    const html = renderLayoutTreeToHtml(layoutTree);

    assert.match(html, /Portal/);
    assert.match(html, /<ul/);
    assert.match(html, /One/);
    assert.match(html, /ld-component-placeholder/);
    assert.match(html, /Totals/);
    assert.match(html, /Nested heading/);
  });
});

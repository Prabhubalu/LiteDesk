'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveMergeTagsInString,
  resolveMergeExpression
} = require('../engines/mergeTagEngine');
const { resolveComponentTree } = require('../engines/componentResolver');
const { buildLayoutTree } = require('../engines/layoutTreeBuilder');
const { renderLayoutTreeToHtml } = require('../renderers/htmlRenderer');
const { buildQuoteTemplateDefinition } = require('../../../constants/contentTemplateSeeds');
const { CONTENT_COMPONENT_TYPES } = require('../../../constants/contentComponentRegistry');

describe('mergeTagEngine', () => {
  it('resolves nested merge tags with formatting', () => {
    const scope = {
      Quote: { quoteNumber: 'QT-0001', grandTotal: 1200.5 },
      Organization: { name: 'Acme Corp' },
      parameters: { currency: 'USD' }
    };

    const text = resolveMergeTagsInString(
      'Quote {{Quote.quoteNumber}} for {{Organization.name}} — {{Quote.grandTotal|currency}}',
      scope
    );

    assert.match(text, /QT-0001/);
    assert.match(text, /Acme Corp/);
    assert.match(text, /1,200.50 USD/);
  });

  it('reports unresolved merge tags', () => {
    const issues = [];
    const text = resolveMergeTagsInString('Hello {{Missing.field}}', {}, { collectIssues: issues });
    assert.equal(text, 'Hello ');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, 'MERGE_TAG_UNRESOLVED');
  });

  it('resolves line item fields from flattened row scope', () => {
    const result = resolveMergeExpression(
      { description: 'Widget', lineTotal: 99, parameters: { currency: 'USD' } },
      'lineTotal|currency'
    );
    assert.equal(result.resolved, true);
    assert.match(String(result.value), /99.00/);
  });
});

describe('content render pipeline (html)', () => {
  it('renders quote template with line items to HTML', () => {
    const scope = {
      Quote: { quoteNumber: 'QT-100', grandTotal: 500, currency: 'USD', customerName: 'Acme Corp' },
      System: { Today: '2026-06-25' },
      lines: [
        { description: 'Service A', quantity: 1, unitPrice: 300, lineTotal: 300 },
        { description: 'Service B', quantity: 2, unitPrice: 100, lineTotal: 200 }
      ],
      parameters: { currency: 'USD' }
    };

    const { root, issues } = resolveComponentTree(buildQuoteTemplateDefinition(), scope);
    assert.equal(issues.length, 0);

    const layoutTree = buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    });
    const html = renderLayoutTreeToHtml(layoutTree);

    assert.match(html, /Quote QT-100/);
    assert.match(html, /Service A/);
    assert.match(html, /Service B/);
    assert.match(html, /<table/);
  });

  it('renders table column widths and alignment in HTML preview', () => {
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      children: [
        {
          id: 'table-1',
          type: CONTENT_COMPONENT_TYPES.TABLE,
          bindings: {
            collection: 'lines',
            showFooter: true,
            columns: [
              { header: 'Description', path: 'description', width: 240, align: 'left' },
              { header: 'Qty', path: 'quantity', width: 80, align: 'center' },
              { header: 'Total', path: 'lineTotal', width: 120, align: 'right', format: 'currency' }
            ],
            footerRow: [
              { text: 'Subtotal', colSpan: 2, align: 'right' },
              { skip: true },
              { path: 'grandTotal', format: 'currency', align: 'right' }
            ]
          }
        }
      ]
    };

    const { root } = resolveComponentTree(definition, {
      grandTotal: 500,
      lines: []
    }, { lenient: true });
    const layoutTree = buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    });
    const html = renderLayoutTreeToHtml(layoutTree);

    assert.match(html, /table-layout:fixed/);
    assert.match(html, /text-align:center/);
    assert.match(html, /text-align:right/);
    assert.match(html, /<colgroup>/);
    assert.match(html, /Subtotal/);
    assert.match(html, /<tbody><\/tbody>/);
  });

  it('renders grid table with repeating data row', () => {
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      children: [
        {
          id: 'table-grid',
          type: CONTENT_COMPONENT_TYPES.TABLE,
          bindings: {
            collection: 'lines',
            repeatRowIndex: 1,
            tableWidthPercent: 100,
            widthUnit: 'percent',
            columnWidthPercents: [50, 50],
            columnWidths: [200, 100],
            grid: [
              [
                { text: 'Item', align: 'left', colSpan: 1, rowSpan: 1, skip: false },
                { text: 'Amount', align: 'right', colSpan: 1, rowSpan: 1, skip: false }
              ],
              [
                { text: '{{description}}', align: 'left', colSpan: 1, rowSpan: 1, skip: false },
                { text: '{{lineTotal}}', align: 'right', colSpan: 1, rowSpan: 1, skip: false }
              ]
            ]
          }
        }
      ]
    };

    const { root } = resolveComponentTree(definition, {
      lines: [
        { description: 'Widget', lineTotal: '10.00' },
        { description: 'Gadget', lineTotal: '20.00' }
      ]
    }, { lenient: true });
    const layoutTree = buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    });
    const html = renderLayoutTreeToHtml(layoutTree);

    assert.match(html, /Item/);
    assert.match(html, /Widget/);
    assert.match(html, /Gadget/);
    assert.match(html, /10\.00/);
    assert.match(html, /20\.00/);
    assert.match(html, /width:\d+px/);
  });

  it('resolves lines.* merge tags inside repeating grid rows', () => {
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      children: [
        {
          id: 'table-grid',
          type: CONTENT_COMPONENT_TYPES.TABLE,
          bindings: {
            collection: 'lines',
            tableWidthPercent: 100,
            widthUnit: 'percent',
            columnWidthPercents: [34, 33, 33],
            columnWidths: [120, 120, 120],
            grid: [
              [
                { text: 'Item Name', align: 'left', colSpan: 1, rowSpan: 1, skip: false },
                { text: 'Quantity', align: 'left', colSpan: 1, rowSpan: 1, skip: false },
                { text: 'Price', align: 'left', colSpan: 1, rowSpan: 1, skip: false }
              ],
              [
                { text: '{{lines.name}}', align: 'left', colSpan: 1, rowSpan: 1, skip: false },
                { text: '{{lines.quantity}}', align: 'left', colSpan: 1, rowSpan: 1, skip: false },
                { text: '{{lines.unitPrice}}', align: 'left', colSpan: 1, rowSpan: 1, skip: false }
              ]
            ]
          }
        }
      ]
    };

    const { root } = resolveComponentTree(definition, {
      lines: [
        { name: 'Widget', quantity: 2, unitPrice: 10 },
        { name: 'Gadget', quantity: 1, unitPrice: 20 }
      ]
    }, { lenient: true });
    const html = renderLayoutTreeToHtml(buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    }));

    assert.match(html, /Widget/);
    assert.match(html, /Gadget/);
    assert.match(html, />\s*2\s*</);
    assert.match(html, />\s*1\s*</);
    assert.doesNotMatch(html, /\{\{lines\.name\}\}/);
  });

  it('renders LineItem block with sections and document totals', () => {
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      children: [
        {
          id: 'line-items',
          type: CONTENT_COMPONENT_TYPES.LINE_ITEM,
          bindings: {
            moduleScope: 'quotes',
            collection: 'lines',
            showSections: true,
            showSectionTotals: true,
            showDocumentTotals: true
          }
        }
      ]
    };

    const scope = {
      Quote: {
        subtotal: 1250,
        taxTotal: 250,
        grandTotal: 1500,
        currency: 'USD'
      },
      sections: [
        {
          _id: 's1',
          sectionTitle: 'Products',
          sectionType: 'standard',
          showSectionTotal: true,
          sectionSubtotal: 1000,
          sectionTotal: 1000
        },
        {
          _id: 's2',
          sectionTitle: 'Services',
          sectionType: 'standard',
          showSectionTotal: true,
          sectionSubtotal: 250,
          sectionTotal: 250
        }
      ],
      lines: [
        {
          quoteSectionId: 's1',
          skuSnapshot: 'SKU-1',
          name: 'Widget',
          quantity: 2,
          unitPrice: 500,
          lineTotal: 1000
        },
        {
          quoteSectionId: 's2',
          skuSnapshot: 'SKU-2',
          name: 'Support',
          quantity: 1,
          unitPrice: 250,
          lineTotal: 250
        }
      ]
    };

    const { root } = resolveComponentTree(definition, scope, { lenient: true });
    const html = renderLayoutTreeToHtml(buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    }));

    assert.match(html, /Products/);
    assert.match(html, /Services/);
    assert.match(html, /Widget/);
    assert.match(html, /Support/);
    assert.match(html, /Section total/);
    assert.match(html, /Grand Total/);
    assert.match(html, /Subtotal/);
  });

  it('maps absolute builder coordinates into page content area', () => {
    const marginLeftPx = Math.round(12 * (96 / 25.4));
    const marginTopPx = Math.round(12 * (96 / 25.4));
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      bindings: { layoutMode: 'absolute' },
      children: [
        {
          id: 'heading-1',
          type: CONTENT_COMPONENT_TYPES.HEADING,
          layout: { x: marginLeftPx, y: marginTopPx, width: 320, height: 48 },
          bindings: { text: 'Heading', level: 2 }
        }
      ]
    };

    const { root } = resolveComponentTree(definition, {}, { lenient: true });
    const layoutTree = buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    });
    const html = renderLayoutTreeToHtml(layoutTree);

    assert.match(html, /left:0px/);
    assert.match(html, /top:0px/);
    assert.doesNotMatch(html, /left:-\d+px/);
    assert.match(html, /Heading/);
  });

  it('clamps heading inside content area when page x is in the margin zone', () => {
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      bindings: { layoutMode: 'absolute' },
      children: [
        {
          id: 'heading-1',
          type: CONTENT_COMPONENT_TYPES.HEADING,
          layout: { x: 0, y: 45, width: 320, height: 48 },
          bindings: { text: 'Heading', level: 2 }
        }
      ]
    };

    const { root } = resolveComponentTree(definition, {}, { lenient: true });
    const html = renderLayoutTreeToHtml(buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    }));

    assert.match(html, /left:0px/);
    assert.doesNotMatch(html, /left:-\d+px/);
  });

  it('clamps heading inside content area when page y is in the margin zone', () => {
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      bindings: { layoutMode: 'absolute' },
      children: [
        {
          id: 'heading-1',
          type: CONTENT_COMPONENT_TYPES.HEADING,
          layout: { x: 45, y: 0, width: 320, height: 48 },
          bindings: { text: 'Heading', level: 2 }
        }
      ]
    };

    const { root } = resolveComponentTree(definition, {}, { lenient: true });
    const html = renderLayoutTreeToHtml(buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    }));

    assert.match(html, /top:0px/);
    assert.doesNotMatch(html, /top:-\d+px/);
  });

  it('clamps block height so it does not exceed bottom margin', () => {
    const marginTopPx = Math.round(12 * (96 / 25.4));
    const marginBottomPx = marginTopPx;
    const pageHeightPx = Math.round(297 * (96 / 25.4));
    const contentHeightPx = pageHeightPx - marginTopPx - marginBottomPx;
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      bindings: { layoutMode: 'absolute' },
      children: [
        {
          id: 'heading-1',
          type: CONTENT_COMPONENT_TYPES.HEADING,
          layout: { x: marginTopPx, y: marginTopPx, width: 320, height: contentHeightPx + 200 },
          bindings: { text: 'Tall block', level: 2 }
        }
      ]
    };

    const { root } = resolveComponentTree(definition, {}, { lenient: true });
    const layoutTree = buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    });
    const html = renderLayoutTreeToHtml(layoutTree);

    assert.match(html, /top:0px/);
    assert.match(html, new RegExp(`ld-abs-block[^>]*min-height:${contentHeightPx}px`));
    assert.match(html, new RegExp(`height:${contentHeightPx}px`));
    assert.doesNotMatch(html, new RegExp(`ld-abs-block[^>]*min-height:${contentHeightPx + 200}px`));
  });

  it('renders absolute tables at full content width', () => {
    const marginLeftPx = Math.round(12 * (96 / 25.4));
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      bindings: { layoutMode: 'absolute' },
      children: [
        {
          id: 'table-1',
          type: CONTENT_COMPONENT_TYPES.TABLE,
          layout: { x: marginLeftPx, y: marginLeftPx, width: 520, height: 200 },
          bindings: {
            grid: [
              [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
              [{ text: '' }, { text: '' }, { text: '' }]
            ],
            columnWidths: [120, 120, 120],
            columnWidthPercents: [33.33, 33.33, 33.34],
            tableWidthPercent: 100,
            widthUnit: 'percent'
          }
        }
      ]
    };

    const { root } = resolveComponentTree(definition, {}, { lenient: true });
    const html = renderLayoutTreeToHtml(buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    }));

    assert.match(html, /width:100%/);
    assert.match(html, /ld-abs-block[^>]*width:100%/);
    assert.match(html, /<col style="width:\d+(?:\.\d+)?%;"/);
  });

  it('expands repeater children', () => {
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      children: [
        {
          id: 'repeater',
          type: CONTENT_COMPONENT_TYPES.REPEATER,
          bindings: { collection: 'lines', itemAlias: 'line' },
          children: [
            {
              id: 'line-text',
              type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
              bindings: { text: '{{line.description}}' }
            }
          ]
        }
      ]
    };

    const { root } = resolveComponentTree(definition, {
      lines: [{ description: 'Alpha' }, { description: 'Beta' }]
    });
    const layoutTree = buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    });
    const html = renderLayoutTreeToHtml(layoutTree);
    assert.match(html, /Alpha/);
    assert.match(html, /Beta/);
  });

  it('renders bootstrap-style row and column grid in HTML', () => {
    const definition = {
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      children: [
        {
          id: 'row-1',
          type: CONTENT_COMPONENT_TYPES.ROW,
          bindings: { gap: 12 },
          children: [
            {
              id: 'col-left',
              type: CONTENT_COMPONENT_TYPES.COLUMN,
              bindings: { span: 4 },
              children: [
                {
                  id: 'left-text',
                  type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
                  bindings: { text: 'Left column' }
                }
              ]
            },
            {
              id: 'col-right',
              type: CONTENT_COMPONENT_TYPES.COLUMN,
              bindings: { span: 8 },
              children: [
                {
                  id: 'right-text',
                  type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
                  bindings: { text: 'Right column' }
                }
              ]
            }
          ]
        }
      ]
    };

    const { root } = resolveComponentTree(definition, {});
    const layoutTree = buildLayoutTree({
      template: { paperSize: 'A4', orientation: 'portrait' },
      resolvedRoot: root
    });
    const html = renderLayoutTreeToHtml(layoutTree);

    assert.match(html, /class="ld-row"/);
    assert.match(html, /class="ld-col"/);
    assert.match(html, /grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
    assert.match(html, /grid-column:span 4/);
    assert.match(html, /grid-column:span 8/);
    assert.match(html, /Left column/);
    assert.match(html, /Right column/);
  });
});

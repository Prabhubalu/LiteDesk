'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { assembleRuntimeContext } = require('../engines/dataProviderEngine');
const { resolveComponentTree } = require('../engines/componentResolver');
const { buildLayoutTree } = require('../engines/layoutTreeBuilder');
const { renderLayoutTreeToHtml } = require('../renderers/htmlRenderer');
const {
  buildQuoteTemplateDefinition,
  buildInvoiceTemplateDefinition
} = require('../../../constants/contentTemplateSeeds');

async function renderDefinitionWithRecord(definition, runtimeContext, moduleScope, theme = {}) {
  const scope = await assembleRuntimeContext({
    organizationId: 'org-test',
    userId: null,
    moduleScope,
    runtimeContext
  });

  const { root, issues } = resolveComponentTree(definition, scope);
  assert.equal(issues.filter((issue) => issue.severity === 'error').length, 0);

  const layoutTree = buildLayoutTree({
    template: { paperSize: 'A4', orientation: 'portrait' },
    resolvedRoot: root,
    theme
  });

  return renderLayoutTreeToHtml(layoutTree);
}

describe('content render live record shapes', () => {
  it('renders quote template from live-shaped quote record data', async () => {
    const html = await renderDefinitionWithRecord(
      buildQuoteTemplateDefinition(),
      {
        recordModuleKey: 'quotes',
        record: {
          quoteNumber: 'QT-2048',
          grandTotal: 2450.75,
          currency: 'USD',
          customerName: 'Northwind Traders'
        },
        lines: [
          { description: 'Implementation', quantity: 1, unitPrice: 2000, lineTotal: 2000 },
          { description: 'Support', quantity: 3, unitPrice: 150, lineTotal: 450.75 }
        ],
        organization: { name: 'Northwind Traders' }
      },
      'quotes'
    );

    assert.match(html, /Quote QT-2048/);
    assert.match(html, /Northwind Traders/);
    assert.match(html, /Implementation/);
    assert.match(html, /Support/);
    assert.match(html, /2,450.75/);
  });

  it('renders invoice template from live-shaped invoice record data', async () => {
    const html = await renderDefinitionWithRecord(
      buildInvoiceTemplateDefinition(),
      {
        recordModuleKey: 'invoices',
        record: {
          invoiceNumber: 'INV-991',
          amountDue: 1200,
          dueDate: '2026-08-15T00:00:00.000Z',
          customerName: 'Contoso Ltd'
        },
        lines: [
          { description: 'Annual license', quantity: 1, unitPrice: 1200, lineTotal: 1200 }
        ],
        organization: { name: 'Contoso Ltd' }
      },
      'invoices'
    );

    assert.match(html, /Invoice INV-991/);
    assert.match(html, /Contoso Ltd/);
    assert.match(html, /Annual license/);
    assert.match(html, /1,200.00/);
  });

  it('applies theme tokens without editing the template definition', async () => {
    const html = await renderDefinitionWithRecord(
      buildQuoteTemplateDefinition(),
      {
        recordModuleKey: 'quotes',
        record: { quoteNumber: 'QT-THEME', grandTotal: 100 },
        organization: { name: 'Themed Org' }
      },
      'quotes',
      {
        colors: { primary: '#dc2626', text: '#1e293b' },
        typography: { bodyFont: 'Georgia, serif' },
        watermark: { text: 'CONFIDENTIAL' }
      }
    );

    assert.match(html, /color: #1e293b/);
    assert.match(html, /font-family: Georgia, serif/);
    assert.match(html, /CONFIDENTIAL/);
  });
});

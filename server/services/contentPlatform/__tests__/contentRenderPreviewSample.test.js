'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { assembleRuntimeContext } = require('../engines/dataProviderEngine');
const { resolveComponentTree } = require('../engines/componentResolver');
const { buildQuoteTemplateDefinition } = require('../../../constants/contentTemplateSeeds');

describe('preview render sample context', () => {
  it('injects sample quote data when preview sample is enabled', async () => {
    const scope = await assembleRuntimeContext({
      organizationId: 'org-test',
      moduleScope: 'quotes',
      runtimeContext: {
        recordModuleKey: 'quotes',
        usePreviewSample: true,
        organization: { name: 'Acme Corp', industry: 'Software' }
      }
    });

    assert.equal(scope.Quote.quoteNumber, 'QT-PREVIEW-001');
    assert.equal(scope.Organization.name, 'Acme Corp');
    assert.equal(scope.lines.length, 2);
    assert.equal(scope.People.first_name, 'Sample');
  });

  it('allows lenient preview render with unresolved merge tags as placeholders', () => {
    const definition = buildQuoteTemplateDefinition();
    const scope = {
      Quote: { quoteNumber: 'QT-100', grandTotal: 500, currency: 'USD', customerName: 'Acme' },
      Organization: { name: 'Acme' },
      System: { Today: '2026-06-25' },
      lines: [{ description: 'Item A', quantity: 1, lineTotal: 500 }]
    };

    const { issues } = resolveComponentTree(definition, scope, { lenient: true });
    assert.equal(issues.filter((issue) => issue.severity === 'error').length, 0);
  });
});

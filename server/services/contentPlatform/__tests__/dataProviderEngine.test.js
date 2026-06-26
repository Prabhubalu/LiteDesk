'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  assembleRuntimeContext,
  RECORD_LOADERS
} = require('../engines/dataProviderEngine');

describe('dataProviderEngine live record loading', () => {
  /** @type {typeof RECORD_LOADERS.quotes | null} */
  let originalQuoteLoader = null;
  /** @type {typeof RECORD_LOADERS.invoices | null} */
  let originalInvoiceLoader = null;

  beforeEach(() => {
    originalQuoteLoader = RECORD_LOADERS.quotes;
    originalInvoiceLoader = RECORD_LOADERS.invoices;
  });

  afterEach(() => {
    RECORD_LOADERS.quotes = originalQuoteLoader;
    RECORD_LOADERS.invoices = originalInvoiceLoader;
  });

  it('loads quote context by recordId and exposes Quote alias', async () => {
    RECORD_LOADERS.quotes = async () => ({
      record: {
        _id: 'quote-1',
        quoteNumber: 'QT-9001',
        grandTotal: 1500,
        currency: 'USD'
      },
      lines: [
        { description: 'Consulting', quantity: 10, unitPrice: 150, lineTotal: 1500 }
      ],
      moduleKey: 'quotes'
    });

    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      userId: null,
      moduleScope: 'quotes',
      runtimeContext: {
        recordId: 'quote-1',
        recordModuleKey: 'quotes',
        organization: { name: 'Acme Corp' }
      }
    });

    assert.equal(scope.Quote.quoteNumber, 'QT-9001');
    assert.equal(scope.Quote.grandTotal, 1500);
    assert.equal(scope.lines.length, 1);
    assert.equal(scope.lines[0].description, 'Consulting');
    assert.equal(scope.lines[0].unitPrice, 150);
  });

  it('loads related contact into People scope for quote records', async () => {
    RECORD_LOADERS.quotes = async () => ({
      record: {
        _id: 'quote-2',
        quoteNumber: 'QT-9002',
        contactId: {
          _id: 'person-1',
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com'
        }
      },
      lines: [],
      moduleKey: 'quotes'
    });

    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      moduleScope: 'quotes',
      runtimeContext: {
        recordId: 'quote-2',
        recordModuleKey: 'quotes',
        organization: { name: 'Acme Corp' }
      }
    });

    assert.equal(scope.People.first_name, 'Jane');
    assert.equal(scope.People.last_name, 'Doe');
  });

  it('loads people context by recordId and exposes People alias', async () => {
    RECORD_LOADERS.people = async () => ({
      record: {
        _id: 'person-1',
        first_name: 'Jane',
        last_name: 'Roe',
        email: 'jane@example.com'
      },
      lines: [],
      moduleKey: 'people'
    });

    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      moduleScope: 'people',
      runtimeContext: {
        recordId: 'person-1',
        recordModuleKey: 'people',
        organization: { name: 'Acme Corp' }
      }
    });

    assert.equal(scope.People.first_name, 'Jane');
    assert.equal(scope.People.last_name, 'Roe');
  });

  it('uses preview sample for people module when no record is selected', async () => {
    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      moduleScope: 'people',
      preview: true,
      runtimeContext: {
        recordModuleKey: 'people',
        usePreviewSample: true,
        organization: { name: 'Acme Corp' }
      }
    });

    assert.equal(scope.People.first_name, 'Sample');
  });

  it('loads invoice context by recordId and exposes Invoice alias', async () => {
    RECORD_LOADERS.invoices = async () => ({
      record: {
        _id: 'inv-1',
        invoiceNumber: 'INV-0042',
        amountDue: 880,
        dueDate: '2026-07-01'
      },
      lines: [
        { description: 'Subscription', quantity: 1, unitPrice: 880, lineTotal: 880 }
      ],
      moduleKey: 'invoices'
    });

    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      userId: null,
      moduleScope: 'invoices',
      runtimeContext: {
        recordId: 'inv-1',
        recordModuleKey: 'invoices',
        organization: { name: 'Contoso Ltd' }
      }
    });

    assert.equal(scope.Invoice.invoiceNumber, 'INV-0042');
    assert.equal(scope.Invoice.amountDue, 880);
    assert.equal(scope.lines[0].lineTotal, 880);
  });

  it('prefers inline runtimeContext record over recordId loader', async () => {
    RECORD_LOADERS.quotes = async () => ({
      record: { quoteNumber: 'SHOULD-NOT-LOAD' },
      lines: [],
      moduleKey: 'quotes'
    });

    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      moduleScope: 'quotes',
      runtimeContext: {
        recordId: 'quote-1',
        recordModuleKey: 'quotes',
        record: { quoteNumber: 'QT-INLINE', grandTotal: 99 },
        organization: { name: 'Inline Org' }
      }
    });

    assert.equal(scope.Quote.quoteNumber, 'QT-INLINE');
    assert.equal(scope.Organization.name, 'Inline Org');
  });
});

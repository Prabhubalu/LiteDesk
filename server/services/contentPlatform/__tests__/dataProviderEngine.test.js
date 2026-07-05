'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Item = require('../../../models/Item');
const ItemVariant = require('../../../models/ItemVariant');
const Organization = require('../../../models/Organization');
const {
  assembleRuntimeContext,
  enrichLinesWithLiveItemCatalog,
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

  it('resolves Organization merge tags from a contact related CRM organization', async () => {
    RECORD_LOADERS.people = async () => ({
      record: {
        _id: 'person-1',
        first_name: 'Jane',
        last_name: 'Roe',
        organization: {
          _id: 'crm-org-1',
          name: 'Northwind Traders',
          industry: 'Retail',
          website: 'https://northwind.example'
        }
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
        organization: { name: 'Tenant Workspace' }
      }
    });

    assert.equal(scope.Organization.name, 'Northwind Traders');
    assert.equal(scope.Organization.industry, 'Retail');
    assert.equal(scope.Organization.website, 'https://northwind.example');
    assert.equal(scope.CurrentOrganization.name, 'Tenant Workspace');
    assert.notEqual(scope.Organization.name, scope.CurrentOrganization.name);
  });

  it('falls back to contact organization for quote merge tags when organizationRefId is missing', async () => {
    RECORD_LOADERS.quotes = async () => ({
      record: {
        _id: 'quote-3',
        quoteNumber: 'QT-9003',
        contactId: {
          _id: 'person-2',
          first_name: 'Alex',
          organization: {
            _id: 'crm-org-2',
            name: 'Contoso Ltd',
            industry: 'Software'
          }
        }
      },
      lines: [],
      moduleKey: 'quotes'
    });

    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      moduleScope: 'quotes',
      runtimeContext: {
        recordId: 'quote-3',
        recordModuleKey: 'quotes',
        organization: { name: 'Tenant Workspace' }
      }
    });

    assert.equal(scope.Organization.name, 'Contoso Ltd');
    assert.equal(scope.Quote.customerName, 'Contoso Ltd');
    assert.equal(scope.People.first_name, 'Alex');
  });

  it('uses preview sample for people module when no record is selected', async () => {
    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      moduleScope: 'people',
      preview: true,
      runtimeContext: {
        recordModuleKey: 'people',
        usePreviewSample: true,
        organization: { name: 'Acme Corp', industry: 'Technology' }
      }
    });

    assert.equal(scope.People.first_name, 'Sample');
    assert.equal(scope.Organization.name, 'Acme Corp');
    assert.equal(scope.Organization.industry, 'Technology');
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
    assert.equal(scope.CurrentOrganization.name, 'Inline Org');
    assert.equal(scope.Organization.name, undefined);
  });

  it('does not map tenant organization onto Organization for quotes without a customer org', async () => {
    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      moduleScope: 'quotes',
      runtimeContext: {
        recordModuleKey: 'quotes',
        record: { quoteNumber: 'QT-0001', grandTotal: 100 },
        organization: { name: 'Arivu Systems', isTenant: true }
      }
    });

    assert.equal(scope.CurrentOrganization.name, 'Arivu Systems');
    assert.equal(scope.Organization.name, undefined);
  });

  it('loads document-linked CRM org when tenant access query would block', async () => {
    const crmOrgId = new mongoose.Types.ObjectId();
    RECORD_LOADERS.quotes = async () => ({
      record: {
        _id: 'quote-linked-org',
        quoteNumber: 'QT-9004',
        organizationRefId: crmOrgId
      },
      lines: [],
      moduleKey: 'quotes'
    });

    const orgFindOne = mock.method(Organization, 'findOne', (query) => ({
      select() {
        return this;
      },
      lean: async () => {
        if (String(query?._id) === String(crmOrgId)) {
          return {
            _id: crmOrgId,
            name: 'Linked Customer Inc',
            address: '456 Commerce Rd',
            city: 'Boston',
            isTenant: false
          };
        }
        return null;
      }
    }));

    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      moduleScope: 'quotes',
      runtimeContext: {
        recordId: 'quote-linked-org',
        recordModuleKey: 'quotes',
        organization: { name: 'Arivu Systems', isTenant: true }
      }
    });

    orgFindOne.mock.restore();
    assert.equal(scope.Organization.name, 'Linked Customer Inc');
    assert.equal(scope.Organization.address, '456 Commerce Rd');
    assert.equal(scope.Organization.city, 'Boston');
  });

  it('resolves customer org from deal accountId when organizationRefId is missing', async () => {
    RECORD_LOADERS.quotes = async () => ({
      record: {
        _id: 'quote-deal-account',
        quoteNumber: 'QT-9005',
        dealId: {
          _id: 'deal-1',
          accountId: {
            _id: 'crm-org-3',
            name: 'Deal Account Co',
            address: '789 Market St'
          }
        }
      },
      lines: [],
      moduleKey: 'quotes'
    });

    const scope = await assembleRuntimeContext({
      organizationId: 'org-1',
      moduleScope: 'quotes',
      runtimeContext: {
        recordId: 'quote-deal-account',
        recordModuleKey: 'quotes',
        organization: { name: 'Tenant Workspace' }
      }
    });

    assert.equal(scope.Organization.name, 'Deal Account Co');
    assert.equal(scope.Organization.address, '789 Market St');
  });
});

describe('dataProviderEngine live catalog enrichment', () => {
  const organizationId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  const itemId = new mongoose.Types.ObjectId();

  it('enriches quote lines with live catalog item description via variantId', async (t) => {
    const variantFind = mock.method(ItemVariant, 'find', () => ({
      select() {
        return this;
      },
      lean: async () => ([{ _id: variantId, itemId }])
    }));
    const itemFind = mock.method(Item, 'find', () => ({
      select() {
        return this;
      },
      lean: async () => ([{
        _id: itemId,
        description: '<p>Live catalog description</p>'
      }])
    }));
    t.after(() => {
      variantFind.mock.restore();
      itemFind.mock.restore();
    });

    const lines = await enrichLinesWithLiveItemCatalog(organizationId, [{
      variantId,
      descriptionSnapshot: 'Stale snapshot',
      itemNameSnapshot: 'Phone'
    }]);

    assert.equal(lines[0].liveItemDescription, 'Live catalog description');
  });

  it('loads live catalog description when assembling quote render scope', async (t) => {
    const variantFind = mock.method(ItemVariant, 'find', () => ({
      select() {
        return this;
      },
      lean: async () => ([{ _id: variantId, itemId }])
    }));
    const itemFind = mock.method(Item, 'find', () => ({
      select() {
        return this;
      },
      lean: async () => ([{
        _id: itemId,
        description: '<p>Live catalog description</p>'
      }])
    }));
    t.after(() => {
      variantFind.mock.restore();
      itemFind.mock.restore();
    });

    const originalQuoteLoader = RECORD_LOADERS.quotes;
    RECORD_LOADERS.quotes = async () => ({
      record: {
        _id: 'quote-1',
        quoteNumber: 'QT-9001',
        grandTotal: 1500,
        currency: 'USD'
      },
      lines: [{
        variantId,
        descriptionSnapshot: 'Stale snapshot',
        itemNameSnapshot: 'Phone',
        quantity: 1,
        unitPriceSnapshot: 1500,
        lineTotal: 1500
      }],
      moduleKey: 'quotes'
    });

    const scope = await assembleRuntimeContext({
      organizationId,
      userId: null,
      moduleScope: 'quotes',
      runtimeContext: {
        recordId: 'quote-1',
        recordModuleKey: 'quotes',
        organization: { name: 'Acme Corp' }
      }
    });

    RECORD_LOADERS.quotes = originalQuoteLoader;

    assert.equal(scope.lines[0].description, 'Live catalog description');
  });
});

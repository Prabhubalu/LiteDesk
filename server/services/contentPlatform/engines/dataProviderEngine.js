'use strict';

const Organization = require('../../../models/Organization');
const User = require('../../../models/User');
const People = require('../../../models/People');
const Quote = require('../../../models/Quote');
const QuoteLine = require('../../../models/QuoteLine');
const QuoteSection = require('../../../models/QuoteSection');
const Invoice = require('../../../models/Invoice');
const InvoiceLine = require('../../../models/InvoiceLine');
const InvoiceSection = require('../../../models/InvoiceSection');

const RECORD_LOADERS = {
  quotes: loadQuoteContext,
  invoices: loadInvoiceContext,
  people: loadPeopleContext
};

function capitalizeModuleKey(moduleKey) {
  const key = String(moduleKey || '').trim();
  if (!key) return 'Record';
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function pickCustomerOrganization(record) {
  const ref = record?.organizationRefId;
  if (ref && typeof ref === 'object' && ref.name) {
    return ref;
  }
  return null;
}

function normalizeLine(line) {
  const doc = line && typeof line.toObject === 'function' ? line.toObject() : line;
  const unitPrice = doc.unitPrice ?? doc.unitPriceSnapshot ?? doc.listPriceSnapshot ?? 0;

  return {
    ...doc,
    description: doc.descriptionSnapshot || doc.description || doc.itemNameSnapshot || doc.nameSnapshot || doc.name || '',
    name: doc.itemNameSnapshot || doc.nameSnapshot || doc.name || doc.descriptionSnapshot || '',
    skuSnapshot: doc.skuSnapshot || doc.sku || '',
    unitPrice,
    quantity: doc.quantity ?? 0,
    lineTotal: doc.lineTotal ?? doc.lineSubtotal ?? 0,
    lineSubtotal: doc.lineSubtotal ?? doc.lineTotal ?? 0
  };
}

function normalizeQuoteRecord(quote) {
  if (!quote) return null;
  const customerOrganization = pickCustomerOrganization(quote);

  return {
    ...quote,
    quoteNumber: quote.quoteNumber ?? '',
    grandTotal: quote.grandTotal ?? 0,
    subtotal: quote.subtotal ?? 0,
    taxTotal: quote.taxTotal ?? 0,
    currency: quote.currency ?? 'USD',
    customerName: customerOrganization?.name ?? quote.customerName ?? '',
    customerOrganization
  };
}

function normalizeInvoiceRecord(invoice) {
  if (!invoice) return null;
  const customerOrganization = pickCustomerOrganization(invoice);

  return {
    ...invoice,
    invoiceNumber: invoice.invoiceNumber ?? '',
    amountDue: invoice.amountDue ?? invoice.grandTotal ?? 0,
    grandTotal: invoice.grandTotal ?? 0,
    dueDate: invoice.dueDate ?? null,
    currency: invoice.currency ?? 'USD',
    customerName: customerOrganization?.name ?? invoice.customerName ?? '',
    customerOrganization
  };
}

async function loadQuoteContext({ organizationId, recordId }) {
  const quote = await Quote.findOne({ _id: recordId, organizationId })
    .populate({ path: 'organizationRefId', select: 'name industry slug' })
    .populate({ path: 'contactId', select: 'first_name last_name email phone mobile title' })
    .lean();
  if (!quote) return null;

  const lines = await QuoteLine.find({ organizationId, quoteId: recordId })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  const sections = await QuoteSection.find({ organizationId, quoteId: recordId, hiddenSection: { $ne: true } })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();

  return {
    record: normalizeQuoteRecord(quote),
    lines: lines.map(normalizeLine),
    sections,
    moduleKey: 'quotes'
  };
}

async function loadInvoiceContext({ organizationId, recordId }) {
  const invoice = await Invoice.findOne({ _id: recordId, organizationId, deletedAt: null })
    .populate({ path: 'organizationRefId', select: 'name industry slug' })
    .populate({ path: 'contactId', select: 'first_name last_name email phone mobile title' })
    .lean();
  if (!invoice) return null;

  const lines = await InvoiceLine.find({ organizationId, invoiceId: recordId })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  const sections = await InvoiceSection.find({ organizationId, invoiceId: recordId, hiddenSection: { $ne: true } })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();

  return {
    record: normalizeInvoiceRecord(invoice),
    lines: lines.map(normalizeLine),
    sections,
    moduleKey: 'invoices'
  };
}

async function loadPeopleContext({ organizationId, recordId }) {
  const person = await People.findOne({ _id: recordId, organizationId, deletedAt: null })
    .select('first_name last_name email phone mobile title organizationId')
    .lean();
  if (!person) return null;

  return {
    record: person,
    lines: [],
    moduleKey: 'people'
  };
}

const PREVIEW_LINE_COLLECTION_MODULES = new Set(['quotes', 'invoices', 'sales_orders']);

const PREVIEW_SAMPLE_LINES = [
  {
    description: 'Professional services',
    quantity: 10,
    unitPrice: 100,
    lineTotal: 1000,
    lineSubtotal: 1000,
    name: 'Professional services',
    skuSnapshot: 'SKU-001',
    quoteSectionId: 'preview-s1'
  },
  {
    description: 'Support package',
    quantity: 1,
    unitPrice: 250,
    lineTotal: 250,
    lineSubtotal: 250,
    name: 'Support package',
    skuSnapshot: 'SKU-002',
    quoteSectionId: 'preview-s2'
  }
];

const PREVIEW_SAMPLE_SECTIONS = [
  {
    _id: 'preview-s1',
    sectionTitle: 'Products',
    sectionType: 'standard',
    sectionOrder: 0,
    showSectionTotal: true,
    sectionSubtotal: 1000,
    sectionTotal: 1000,
    sectionDiscountTotal: 0
  },
  {
    _id: 'preview-s2',
    sectionTitle: 'Services',
    sectionType: 'standard',
    sectionOrder: 1,
    showSectionTotal: true,
    sectionSubtotal: 250,
    sectionTotal: 250,
    sectionDiscountTotal: 0
  }
];

function buildPreviewSampleRecord(moduleKey, tenantOrganization) {
  const key = String(moduleKey || '').trim().toLowerCase();
  const orgName = tenantOrganization?.name || 'Sample Organization';

  const byModule = {
    quotes: {
      quoteNumber: 'QT-PREVIEW-001',
      grandTotal: 1250,
      subtotal: 1000,
      taxTotal: 250,
      currency: 'USD',
      customerName: orgName,
      status: 'Draft'
    },
    invoices: {
      invoiceNumber: 'INV-PREVIEW-001',
      amountDue: 1250,
      grandTotal: 1250,
      subtotal: 1000,
      taxTotal: 250,
      currency: 'USD',
      customerName: orgName,
      dueDate: new Date().toISOString(),
      status: 'Sent'
    },
    sales_orders: {
      orderNumber: 'SO-PREVIEW-001',
      grandTotal: 850,
      subtotal: 750,
      taxTotal: 100,
      currency: 'USD',
      customerName: orgName,
      status: 'Draft'
    },
    deals: {
      name: 'Sample Deal',
      amount: 50000,
      stage: 'Proposal',
      status: 'Open'
    },
    people: {
      first_name: 'Sample',
      last_name: 'Contact',
      email: 'contact@example.com',
      full_name: 'Sample Contact'
    },
    organizations: {
      name: orgName,
      industry: tenantOrganization?.industry || 'Technology',
      email: 'billing@example.com'
    },
    cases: {
      subject: 'Sample case',
      status: 'Open',
      case_number: 'CASE-PREVIEW-001'
    },
    tasks: {
      title: 'Sample task',
      status: 'Open',
      priority: 'Normal'
    }
  };

  return byModule[key] || {
    name: 'Sample Record',
    title: 'Sample Record',
    status: 'Draft'
  };
}

/**
 * Resolve related contact (People) from a commercial document record.
 * @param {object} params
 * @param {string} params.organizationId
 * @param {object | null} params.record
 */
async function resolveRelatedPeople({ organizationId, record }) {
  if (!record) return null;

  const contactRef = record.contactId;
  if (contactRef && typeof contactRef === 'object' && contactRef._id) {
    return contactRef;
  }

  const contactId = contactRef || record.contact?._id;
  if (!contactId) return null;

  return People.findOne({ _id: contactId, organizationId, deletedAt: null })
    .select('first_name last_name email phone mobile title')
    .lean();
}

/**
 * @param {object} params
 */
async function assembleRuntimeContext(params) {
  const {
    organizationId,
    userId = null,
    moduleScope = '',
    preview = false,
    runtimeContext = {}
  } = params;

  const parameters = runtimeContext.parameters && typeof runtimeContext.parameters === 'object'
    ? { ...runtimeContext.parameters }
    : {};

  let record = runtimeContext.record || null;
  let lines = Array.isArray(runtimeContext.lines) ? runtimeContext.lines : [];
  let sections = Array.isArray(runtimeContext.sections) ? runtimeContext.sections : [];
  let recordLoadAttempted = false;
  const recordModuleKey = String(
    runtimeContext.recordModuleKey || moduleScope || ''
  ).toLowerCase();

  if (!record && runtimeContext.recordId && RECORD_LOADERS[recordModuleKey]) {
    recordLoadAttempted = true;
    const loaded = await RECORD_LOADERS[recordModuleKey]({
      organizationId,
      recordId: runtimeContext.recordId
    });
    if (loaded) {
      record = loaded.record;
      lines = loaded.lines;
      sections = loaded.sections || [];
    }
  }

  if (Array.isArray(lines) && lines.length) {
    lines = lines.map(normalizeLine);
  }

  if (
    preview
    && !sections.length
    && PREVIEW_LINE_COLLECTION_MODULES.has(recordModuleKey)
    && (runtimeContext.usePreviewSample === true || !runtimeContext.recordId)
  ) {
    sections = PREVIEW_SAMPLE_SECTIONS.map((section) => ({ ...section }));
  }

  const [tenantOrganization, currentUser] = await Promise.all([
    runtimeContext.organization
      ? Promise.resolve(runtimeContext.organization)
      : Organization.findById(organizationId).select('name industry slug email').lean(),
    userId && !runtimeContext.currentUser
      ? User.findById(userId).select('firstName lastName email username').lean()
      : Promise.resolve(runtimeContext.currentUser || null)
  ]);

  if (
    !record
    && recordModuleKey
    && (runtimeContext.usePreviewSample === true || (preview && !runtimeContext.recordId))
  ) {
    record = buildPreviewSampleRecord(recordModuleKey, tenantOrganization);
    if (!lines.length && PREVIEW_LINE_COLLECTION_MODULES.has(recordModuleKey)) {
      lines = PREVIEW_SAMPLE_LINES.map(normalizeLine);
    }
    if (!sections.length && PREVIEW_LINE_COLLECTION_MODULES.has(recordModuleKey)) {
      sections = PREVIEW_SAMPLE_SECTIONS.map((section) => ({ ...section }));
    }
  }

  if (
    preview
    && recordModuleKey
    && PREVIEW_LINE_COLLECTION_MODULES.has(recordModuleKey)
    && !lines.length
  ) {
    lines = PREVIEW_SAMPLE_LINES.map(normalizeLine);
  }

  if (
    preview
    && recordModuleKey
    && PREVIEW_LINE_COLLECTION_MODULES.has(recordModuleKey)
    && !sections.length
  ) {
    sections = PREVIEW_SAMPLE_SECTIONS.map((section) => ({ ...section }));
  }

  if (
    preview
    && runtimeContext.recordId
    && !record
    && recordModuleKey
    && !RECORD_LOADERS[recordModuleKey]
  ) {
    record = buildPreviewSampleRecord(recordModuleKey, tenantOrganization);
  }

  if (recordModuleKey === 'quotes' && record) {
    record = normalizeQuoteRecord(record);
  } else if (recordModuleKey === 'invoices' && record) {
    record = normalizeInvoiceRecord(record);
  }

  const customerOrganization = record?.customerOrganization || null;
  const documentOrganization = customerOrganization || tenantOrganization || {};

  if (record?.currency && !parameters.currency) {
    parameters.currency = record.currency;
  }

  const moduleAlias = capitalizeModuleKey(recordModuleKey || moduleScope);
  const now = new Date();

  const scope = {
    Record: record || {},
    Organization: documentOrganization,
    CustomerOrganization: customerOrganization || {},
    CurrentUser: currentUser || {},
    CurrentOrganization: tenantOrganization || {},
    CurrentTenant: tenantOrganization || {},
    System: {
      Today: now.toISOString().slice(0, 10),
      Now: now.toISOString(),
      PageCount: 1
    },
    lines,
    sections,
    parameters,
    record: record || {},
    organization: documentOrganization,
    currentUser: currentUser || {},
    recordLoadAttempted,
    recordLoadSucceeded: Boolean(record && record._id)
  };

  if (moduleAlias && record) {
    scope[moduleAlias] = record;
  }

  if (recordModuleKey === 'quotes' && record) scope.Quote = record;
  if (recordModuleKey === 'invoices' && record) scope.Invoice = record;
  if (recordModuleKey === 'people' && record) scope.People = record;

  const relatedPeople = await resolveRelatedPeople({ organizationId, record });
  if (relatedPeople) {
    scope.People = relatedPeople;
  } else if (runtimeContext.usePreviewSample === true && recordModuleKey && recordModuleKey !== 'people') {
    scope.People = buildPreviewSampleRecord('people', tenantOrganization);
  }

  return scope;
}

module.exports = {
  assembleRuntimeContext,
  capitalizeModuleKey,
  normalizeLine,
  normalizeQuoteRecord,
  normalizeInvoiceRecord,
  buildPreviewSampleRecord,
  RECORD_LOADERS
};

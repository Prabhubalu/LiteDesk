const Deal = require('../../models/Deal');
const People = require('../../models/People');
const Task = require('../../models/Task');
const Quote = require('../../models/Quote');
const Case = require('../../models/Case');
const Event = require('../../models/Event');
const Organization = require('../../models/Organization');
const Item = require('../../models/Item');
const FormResponse = require('../../models/FormResponse');
const SalesOrder = require('../../models/SalesOrder');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const Document = require('../../models/Document');

const DEFAULT_OWNERSHIP_FIELD = 'assignedTo';

function moduleConfigEntry({
  model,
  moduleKey,
  label,
  appKey,
  collection,
  defaultFields,
  ownershipField = DEFAULT_OWNERSHIP_FIELD,
  excludeTrash = false,
  tenantScopeMatch = null,
}) {
  return {
    model,
    moduleKey,
    label,
    appKey,
    collection: collection || model.collection.name,
    defaultFields,
    ownershipField,
    excludeTrash,
    tenantScopeMatch,
  };
}

/**
 * Maps analytics primaryModule keys to Mongoose models and ownership fields.
 */
const ANALYTICS_MODULE_REGISTRY = Object.freeze({
  deals: moduleConfigEntry({
    model: Deal,
    moduleKey: 'deals',
    label: 'Deals',
    appKey: 'SALES',
    excludeTrash: true,
    defaultFields: ['name', 'stage', 'status', 'amount', 'assignedTo', 'expectedCloseDate'],
  }),
  people: moduleConfigEntry({
    model: People,
    moduleKey: 'people',
    label: 'People',
    appKey: 'SALES',
    defaultFields: ['first_name', 'last_name', 'email', 'assignedTo'],
  }),
  tasks: moduleConfigEntry({
    model: Task,
    moduleKey: 'tasks',
    label: 'Tasks',
    appKey: 'PLATFORM',
    excludeTrash: true,
    defaultFields: ['title', 'status', 'priority', 'assignedTo', 'dueDate'],
  }),
  quotes: moduleConfigEntry({
    model: Quote,
    moduleKey: 'quotes',
    label: 'Quotes',
    appKey: 'PLATFORM',
    defaultFields: ['quoteNumber', 'status', 'assignedTo', 'validUntil'],
  }),
  cases: moduleConfigEntry({
    model: Case,
    moduleKey: 'cases',
    label: 'Cases',
    appKey: 'HELPDESK',
    defaultFields: ['caseId', 'title', 'status', 'priority', 'assignedTo'],
  }),
  events: moduleConfigEntry({
    model: Event,
    moduleKey: 'events',
    label: 'Events',
    appKey: 'PLATFORM',
    excludeTrash: true,
    defaultFields: ['eventName', 'eventType', 'status', 'assignedTo', 'startDateTime'],
  }),
  organizations: moduleConfigEntry({
    model: Organization,
    moduleKey: 'organizations',
    label: 'Organizations',
    appKey: 'SALES',
    excludeTrash: true,
    tenantScopeMatch: { isTenant: { $ne: true } },
    defaultFields: ['name', 'industry', 'assignedTo', 'status'],
  }),
  items: moduleConfigEntry({
    model: Item,
    moduleKey: 'items',
    label: 'Items',
    appKey: 'PLATFORM',
    ownershipField: 'createdBy',
    excludeTrash: true,
    defaultFields: ['item_name', 'item_code', 'item_type', 'status', 'createdBy'],
  }),
  forms: moduleConfigEntry({
    model: FormResponse,
    moduleKey: 'forms',
    label: 'Form Responses',
    appKey: 'PLATFORM',
    ownershipField: 'submittedBy',
    defaultFields: ['responseId', 'formId', 'executionStatus', 'reviewStatus', 'submittedAt'],
  }),
  sales_orders: moduleConfigEntry({
    model: SalesOrder,
    moduleKey: 'sales_orders',
    label: 'Sales Orders',
    appKey: 'PLATFORM',
    excludeTrash: true,
    defaultFields: ['salesOrderNumber', 'status', 'assignedTo', 'orderDate'],
  }),
  invoices: moduleConfigEntry({
    model: Invoice,
    moduleKey: 'invoices',
    label: 'Invoices',
    appKey: 'PLATFORM',
    excludeTrash: true,
    defaultFields: ['invoiceNumber', 'status', 'assignedTo', 'dueDate'],
  }),
  payments: moduleConfigEntry({
    model: Payment,
    moduleKey: 'payments',
    label: 'Payments',
    appKey: 'PLATFORM',
    ownershipField: 'createdBy',
    excludeTrash: true,
    defaultFields: ['paymentNumber', 'status', 'amount', 'paymentDate'],
  }),
  documents: moduleConfigEntry({
    model: Document,
    moduleKey: 'documents',
    label: 'Documents',
    appKey: 'PLATFORM',
    excludeTrash: true,
    defaultFields: ['name', 'status', 'assignedTo', 'createdBy'],
  }),
});

function getAnalyticsModuleConfig(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  return ANALYTICS_MODULE_REGISTRY[key] || null;
}

function isReportableAnalyticsModule(moduleKey) {
  return Boolean(getAnalyticsModuleConfig(moduleKey));
}

function listAnalyticsModules() {
  return Object.entries(ANALYTICS_MODULE_REGISTRY).map(([moduleKey, cfg]) => ({
    moduleKey,
    appKey: cfg.appKey,
    label: cfg.label,
    collection: cfg.collection,
    defaultFields: cfg.defaultFields || [],
    reportable: true,
  }));
}

module.exports = {
  ANALYTICS_MODULE_REGISTRY,
  getAnalyticsModuleConfig,
  isReportableAnalyticsModule,
  listAnalyticsModules,
};

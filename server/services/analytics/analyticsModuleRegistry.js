const Deal = require('../../models/Deal');
const People = require('../../models/People');
const Task = require('../../models/Task');
const Quote = require('../../models/Quote');
const Case = require('../../models/Case');
const Event = require('../../models/Event');
const Organization = require('../../models/Organization');
const Item = require('../../models/Item');
const FormResponse = require('../../models/FormResponse');

/**
 * Maps analytics primaryModule keys to Mongoose models and ownership fields.
 */
const ANALYTICS_MODULE_REGISTRY = Object.freeze({
  deals: {
    model: Deal,
    ownershipField: 'assignedTo',
    appKey: 'SALES',
    label: 'Deals',
    collection: 'deals',
    excludeTrash: true,
    defaultFields: ['name', 'stage', 'amount', 'assignedTo', 'expectedCloseDate'],
  },
  people: {
    model: People,
    ownershipField: 'assignedTo',
    appKey: 'SALES',
    label: 'People',
    collection: 'people',
    defaultFields: ['first_name', 'last_name', 'email', 'assignedTo'],
  },
  tasks: {
    model: Task,
    ownershipField: 'assignedTo',
    appKey: 'SALES',
    label: 'Tasks',
    collection: 'tasks',
    excludeTrash: true,
    defaultFields: ['title', 'status', 'priority', 'assignedTo', 'dueDate'],
  },
  quotes: {
    model: Quote,
    ownershipField: 'assignedTo',
    appKey: 'SALES',
    label: 'Quotes',
    collection: 'quotes',
    defaultFields: ['quoteNumber', 'status', 'assignedTo', 'validUntil'],
  },
  cases: {
    model: Case,
    ownershipField: 'assignedTo',
    appKey: 'HELPDESK',
    label: 'Cases',
    collection: 'cases',
    defaultFields: ['caseId', 'title', 'status', 'priority', 'assignedTo'],
  },
  events: {
    model: Event,
    ownershipField: 'assignedTo',
    appKey: 'PLATFORM',
    label: 'Events',
    collection: 'events',
    excludeTrash: true,
    defaultFields: ['eventName', 'eventType', 'status', 'assignedTo', 'startDateTime'],
  },
  organizations: {
    model: Organization,
    ownershipField: 'assignedTo',
    appKey: 'SALES',
    label: 'Organizations',
    collection: 'organizations',
    excludeTrash: true,
    tenantScopeMatch: { isTenant: { $ne: true } },
    defaultFields: ['name', 'industry', 'assignedTo', 'status'],
  },
  items: {
    model: Item,
    ownershipField: 'createdBy',
    appKey: 'PLATFORM',
    label: 'Items',
    collection: 'items',
    excludeTrash: true,
    defaultFields: ['item_name', 'item_code', 'item_type', 'status', 'createdBy'],
  },
  forms: {
    model: FormResponse,
    ownershipField: 'submittedBy',
    appKey: 'PLATFORM',
    label: 'Form Responses',
    collection: 'formresponses',
    defaultFields: ['responseId', 'formId', 'executionStatus', 'reviewStatus', 'submittedAt'],
  },
});

function getAnalyticsModuleConfig(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  return ANALYTICS_MODULE_REGISTRY[key] || null;
}

function listAnalyticsModules() {
  return Object.entries(ANALYTICS_MODULE_REGISTRY).map(([moduleKey, cfg]) => ({
    moduleKey,
    appKey: cfg.appKey,
    label: cfg.label,
    collection: cfg.collection,
    defaultFields: cfg.defaultFields || [],
  }));
}

module.exports = {
  ANALYTICS_MODULE_REGISTRY,
  getAnalyticsModuleConfig,
  listAnalyticsModules,
};

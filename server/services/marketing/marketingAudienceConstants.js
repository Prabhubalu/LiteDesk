'use strict';

const MAX_RELATIONSHIP_DEPTH = Math.max(
  1,
  parseInt(String(process.env.MARKETING_AUDIENCE_MAX_RELATIONSHIP_DEPTH || '3'), 10) || 3
);

const RECIPIENT_RESOLVE_MAX = Math.max(
  100,
  parseInt(String(process.env.MARKETING_AUDIENCE_RECIPIENT_MAX || '5000'), 10) || 5000
);

const PREVIEW_SAMPLE_MAX = Math.max(
  5,
  parseInt(String(process.env.MARKETING_AUDIENCE_PREVIEW_SAMPLE_MAX || '50'), 10) || 50
);

const ID_BATCH_SIZE = 1000;

/**
 * Preview/UI queries use RECIPIENT_RESOLVE_MAX; campaign send resolution is uncapped.
 * @param {{ purpose?: string }} [context]
 * @returns {number|null}
 */
function getRecipientResolveLimit(context = {}) {
  if (String(context.purpose || '').toLowerCase() === 'send') {
    return null;
  }
  return RECIPIENT_RESOLVE_MAX;
}

/** Primary IDs processed per batch when evaluating numeric aggregate rules. */
const AGGREGATE_PRIMARY_BATCH_SIZE = 200;

const AGGREGATE_FUNCTIONS = new Set(['exists', 'not_exists', 'count', 'sum', 'avg', 'min', 'max']);

const AGGREGATE_COMPARE_OPERATORS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between']);

/** Modules eligible as marketing audience primary entities (send resolves to people). */
const AUDIENCE_PRIMARY_MODULE_KEYS = new Set([
  'people',
  'organizations',
  'deals',
  'cases',
  'quotes',
  'invoices',
  'sales_orders',
  'items'
]);

const DATA_TYPE_TO_FILTER_TYPE = {
  text: 'text',
  textarea: 'text',
  email: 'text',
  phone: 'text',
  url: 'text',
  number: 'number',
  currency: 'number',
  percent: 'number',
  date: 'date',
  datetime: 'date',
  picklist: 'select',
  'multi-picklist': 'multi-select',
  multiselect: 'multi-select',
  boolean: 'boolean',
  user: 'user',
  'lookup-user': 'user',
  lookup: 'entity',
  reference: 'entity',
  integer: 'number',
  checkbox: 'boolean'
};

/** Field keys excluded from marketing audience / segment filter pickers. */
const MARKETING_EXCLUDED_FIELD_KEYS = new Set([
  '_id',
  'activitylogs',
  'customfields',
  'deletedat',
  'deletedby',
  'deletionreason',
  'descriptionversions',
  'participations',
  'importhistoryid',
  'stagehistory'
]);

const OPERATORS_BY_FILTER_TYPE = {
  text: ['contains', 'not_contains', 'is', 'is_not', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  number: ['is', 'is_not', 'gt', 'lt', 'between', 'is_empty', 'is_not_empty'],
  select: ['is', 'is_not', 'is_any_of', 'is_empty', 'is_not_empty'],
  'multi-select': ['is_any_of', 'is_empty', 'is_not_empty'],
  boolean: ['is', 'is_not'],
  user: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  entity: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  date: [
    'is',
    'is_not',
    'today',
    'yesterday',
    'from_now',
    'before_now',
    'this_week',
    'this_quarter',
    'this_year',
    'last_7_days',
    'last_30_days',
    'last_n_days',
    'this_month',
    'previous_month',
    'between_dates',
    'is_empty',
    'is_not_empty'
  ]
};

module.exports = {
  MAX_RELATIONSHIP_DEPTH,
  RECIPIENT_RESOLVE_MAX,
  PREVIEW_SAMPLE_MAX,
  getRecipientResolveLimit,
  ID_BATCH_SIZE,
  AGGREGATE_PRIMARY_BATCH_SIZE,
  AGGREGATE_FUNCTIONS,
  AGGREGATE_COMPARE_OPERATORS,
  AUDIENCE_PRIMARY_MODULE_KEYS,
  DATA_TYPE_TO_FILTER_TYPE,
  MARKETING_EXCLUDED_FIELD_KEYS,
  OPERATORS_BY_FILTER_TYPE
};

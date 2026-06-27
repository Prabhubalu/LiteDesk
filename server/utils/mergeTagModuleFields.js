'use strict';

const MODEL_BY_KEY = {
  people: () => require('../models/People'),
  organizations: () => require('../models/Organization'),
  deals: () => require('../models/Deal'),
  quotes: () => require('../models/Quote'),
  sales_orders: () => require('../models/SalesOrder'),
  invoices: () => require('../models/Invoice'),
  payments: () => require('../models/Payment'),
  tasks: () => require('../models/Task'),
  cases: () => require('../models/Case'),
  events: () => require('../models/Event'),
  items: () => require('../models/Item'),
  forms: () => require('../models/Form')
};

/** Fields that must never appear as template merge tags. */
const MERGE_TAG_EXCLUDED_KEYS = new Set([
  '_id',
  '__v',
  'customfields',
  'organizationid',
  'participations',
  'activitylogs',
  'descriptionversions',
  'derivedstatus',
  'legacycontactid',
  'publicsharetoken',
  'deletedat',
  'deletedby',
  'deletionreason',
  'audithistory',
  'sections',
  'kpimetrics',
  'activities',
  'slacycles',
  'currentslacycle',
  'assignmentcontrol'
]);

function humanizeFieldKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * @param {string} moduleKey
 * @returns {Array<{ key: string, label: string }>}
 */
function getSchemaMergeTagFields(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  const modelFactory = MODEL_BY_KEY[key];
  if (!modelFactory) return [];

  const model = modelFactory();
  const paths = model?.schema?.paths || {};

  return Object.keys(paths)
    .filter((fieldKey) => {
      const normalized = fieldKey.toLowerCase();
      if (MERGE_TAG_EXCLUDED_KEYS.has(normalized)) return false;
      if (fieldKey.includes('.')) return false;
      return true;
    })
    .map((fieldKey) => ({
      key: fieldKey,
      label: humanizeFieldKey(fieldKey)
    }));
}

/**
 * Merge configured module fields with full schema fields for template merge tags.
 * @param {Array<object>} configuredFields
 * @param {string} moduleKey
 * @returns {Array<object>}
 */
function mergeFieldsForMergeTags(configuredFields, moduleKey) {
  const configured = Array.isArray(configuredFields) ? configuredFields : [];
  const byKey = new Map();

  for (const field of configured) {
    const fieldKey = String(field?.key || '').trim();
    if (!fieldKey) continue;
    byKey.set(fieldKey.toLowerCase(), field);
  }

  for (const schemaField of getSchemaMergeTagFields(moduleKey)) {
    const normalized = schemaField.key.toLowerCase();
    const existing = byKey.get(normalized);
    if (!existing) {
      byKey.set(normalized, schemaField);
      continue;
    }
    if (!existing.label) {
      byKey.set(normalized, {
        ...existing,
        label: schemaField.label
      });
    }
  }

  return [...byKey.values()].sort((a, b) =>
    String(a.label || a.key).localeCompare(String(b.label || b.key))
  );
}

module.exports = {
  MERGE_TAG_EXCLUDED_KEYS,
  humanizeFieldKey,
  getSchemaMergeTagFields,
  mergeFieldsForMergeTags
};

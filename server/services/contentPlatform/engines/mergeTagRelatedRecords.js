'use strict';

const relationshipResolver = require('../../relationshipResolver');
const { normalizeRecordForMergeTags } = require('../../../utils/mergeTagRecordNormalizer');
const { resolveMergeTagModuleAlias } = require('../../../utils/mergeTagModuleAliases');
const { loadMergeTagModuleRecord } = require('../../../utils/mergeTagRecordLoader');

const LOOKUP_FIELDS_BY_MODULE = {
  quotes: {
    deals: ['dealId'],
    cases: ['caseId']
  },
  invoices: {
    deals: ['dealId'],
    cases: ['caseId']
  },
  sales_orders: {
    deals: ['dealId'],
    cases: ['caseId']
  }
};

const MODULE_APP_KEY = {
  quotes: 'platform',
  invoices: 'platform',
  sales_orders: 'platform',
  people: 'sales',
  organizations: 'sales',
  deals: 'sales',
  cases: 'helpdesk'
};

/** Loaded separately in dataProviderEngine — avoid overwriting primary scope aliases. */
const SKIP_RELATIONSHIP_MODULE_KEYS = new Set(['people', 'organizations', 'organization']);

function normalizeObjectId(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function readLookupRef(record, fieldName) {
  if (!record || !fieldName) return null;
  const value = record[fieldName];
  if (!value) return null;
  if (typeof value === 'object' && value._id) return value;
  return value;
}

/**
 * Load related module records for merge-tag scope (lookups + relationship instances).
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.moduleKey
 * @param {object | null} params.record
 * @param {boolean} [params.preview]
 */
async function loadMergeTagRelatedRecords(params) {
  const {
    organizationId,
    moduleKey,
    record,
    preview = false
  } = params;

  const scope = {};
  if (!record || !record._id) return scope;

  const normalizedModuleKey = String(moduleKey || '').trim().toLowerCase();
  const lookupMap = LOOKUP_FIELDS_BY_MODULE[normalizedModuleKey] || {};

  for (const [relatedModuleKey, fieldNames] of Object.entries(lookupMap)) {
    const alias = resolveMergeTagModuleAlias(relatedModuleKey);
    if (scope[alias]) continue;

    for (const fieldName of fieldNames) {
      const ref = readLookupRef(record, fieldName);
      if (!ref) continue;
      // eslint-disable-next-line no-await-in-loop
      const loaded = await loadMergeTagModuleRecord(organizationId, relatedModuleKey, ref);
      if (loaded) {
        scope[alias] = normalizeRecordForMergeTags(loaded);
        break;
      }
    }
  }

  const appKey = MODULE_APP_KEY[normalizedModuleKey] || 'platform';
  let relationshipGroups = [];
  try {
    relationshipGroups = await relationshipResolver.getRelatedRecords(
      organizationId,
      appKey,
      normalizedModuleKey,
      record._id
    );
  } catch {
    relationshipGroups = [];
  }

  for (const group of relationshipGroups) {
    const targetModuleKey = String(
      group?.definition?.target?.moduleKey
      || group?.records?.[0]?.moduleKey
      || ''
    ).trim().toLowerCase();

    if (!targetModuleKey || SKIP_RELATIONSHIP_MODULE_KEYS.has(targetModuleKey)) continue;

    const firstRecord = group?.records?.[0];
    if (!firstRecord?.recordId) continue;

    const alias = resolveMergeTagModuleAlias(targetModuleKey);
    if (scope[alias]) continue;

    // eslint-disable-next-line no-await-in-loop
    const loaded = await loadMergeTagModuleRecord(
      organizationId,
      targetModuleKey,
      firstRecord.recordId
    );
    if (loaded) {
      scope[alias] = normalizeRecordForMergeTags(loaded);
    }
  }

  return scope;
}

module.exports = {
  LOOKUP_FIELDS_BY_MODULE,
  loadMergeTagRelatedRecords
};

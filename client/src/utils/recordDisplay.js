/**
 * ============================================================================
 * Phase 0G: Record Display Utilities (Enhanced with Caching)
 * ============================================================================
 * 
 * Utilities for displaying record information in relationship UI:
 * - Get record labels (primaryField)
 * - Format record display names
 * - Fetch record details for display
 * - Cache record data for performance
 * 
 * ============================================================================
 */

import apiClient from '@/utils/apiClient';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import { fetchModulesListCached } from '@/utils/tenantSchemaApiCache';
import { getKeyFields, getFieldValue, getFieldDisplayLabel } from '@/utils/fieldDisplay';

// Cache for record data (key: appKey.moduleKey.recordId)
const recordCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Module definitions used to resolve configured key fields for related record cards. */
let relatedModuleDefinitionsByKey = null;
let relatedModuleDefinitionsPromise = null;

/**
 * Load and cache module definitions for related-record key field resolution.
 * Must complete before deciding a related record is "enriched" (avoids refresh race).
 */
export async function ensureRelatedModuleDefinitions() {
  if (relatedModuleDefinitionsByKey) return relatedModuleDefinitionsByKey;
  if (!relatedModuleDefinitionsPromise) {
    relatedModuleDefinitionsPromise = fetchModulesListCached({})
      .then((response) => {
        const modules = Array.isArray(response) ? response : response?.data ?? response?.modules ?? [];
        const next = {};
        for (const mod of modules) {
          const key = normalizeRelatedModuleKey(mod?.key);
          if (key) next[key] = mod;
        }
        relatedModuleDefinitionsByKey = next;
        return next;
      })
      .catch((error) => {
        relatedModuleDefinitionsPromise = null;
        console.warn('[recordDisplay] Failed to load module definitions:', error);
        return {};
      });
  }
  return relatedModuleDefinitionsPromise;
}

export function getRelatedModuleDefinition(moduleKey) {
  const mk = normalizeRelatedModuleKey(moduleKey);
  return relatedModuleDefinitionsByKey?.[mk] || null;
}

export function clearRelatedModuleDefinitionsCache() {
  relatedModuleDefinitionsByKey = null;
  relatedModuleDefinitionsPromise = null;
}

export function relatedDisplayOptionsForModule(moduleKey) {
  return { moduleDefinition: getRelatedModuleDefinition(moduleKey) };
}
/** Must stay aligned with server BATCH_MODULES (moduleRecordController.js). */
const BATCH_FETCH_MODULES = new Set([
  'people',
  'deals',
  'tasks',
  'events',
  'forms',
  'items',
  'cases',
  'quotes',
  'sales_orders',
  'invoices',
  'documents',
  'organizations'
]);
/** CRM orgs use createdBy tenant scoping — batch route handles this correctly. */
const DIRECT_FETCH_MODULES = new Set([]);
const unsupportedBatchModules = new Set();

const MODULE_KEY_ALIASES = Object.freeze({
  organization: 'organizations',
  contact: 'people',
  contacts: 'people',
  person: 'people',
  deal: 'deals',
  event: 'events',
  task: 'tasks',
  form: 'forms',
  document: 'documents',
  item: 'items',
  case: 'cases',
  quote: 'quotes',
  invoice: 'invoices',
  'sales-order': 'sales_orders',
  salesorders: 'sales_orders',
  project: 'projects',
  payment: 'payments'
});

export function normalizeRelatedModuleKey(moduleKey) {
  const normalized = String(moduleKey || '').toLowerCase().trim();
  return MODULE_KEY_ALIASES[normalized] || normalized;
}

/**
 * Get endpoint for a record type.
 * Server routes are module-based (/api/tasks, /api/deals, etc.), not /api/{appKey}/{moduleKey}.
 */
function getRecordEndpoint(appKey, moduleKey) {
  const normalizedModule = normalizeRelatedModuleKey(moduleKey);
  const helpdeskCases = getModuleRecordCrudPathBase(normalizedModule, { appKey, routePath: '' });
  if (helpdeskCases === '/helpdesk/cases') return helpdeskCases;
  // Map moduleKey to actual server path (no appKey in path)
  const moduleToPath = {
    tasks: '/tasks',
    task: '/tasks',
    events: '/events',
    event: '/events',
    forms: '/forms',
    form: '/forms',
    deals: '/deals',
    deal: '/deals',
    people: '/people',
    organizations: '/v2/organization',
    organization: '/v2/organization',
    items: '/items',
    item: '/items',
    quotes: '/quotes',
    quote: '/quotes',
    documents: '/documents',
    document: '/documents',
    sales_orders: '/sales-orders',
    salesorders: '/sales-orders',
    invoices: '/invoices',
    invoice: '/invoices'
  };
  const path = moduleToPath[normalizedModule];
  if (path) return path;
  if (normalizedModule === 'organizations' || normalizedModule === 'organization') return '/v2/organization';
  // Fallback: try moduleKey as path (e.g. /people, /groups)
  return `/${normalizedModule || 'unknown'}`;
}

/**
 * Generate cache key for a record
 */
function getCacheKey(appKey, moduleKey, recordId) {
  return `${appKey?.toLowerCase() || 'crm'}.${moduleKey?.toLowerCase() || 'unknown'}.${recordId}`;
}

/**
 * Fetch a single record by ID (with caching)
 */
export async function fetchRecord(appKey, moduleKey, recordId, forceRefresh = false) {
  const cacheKey = getCacheKey(appKey, moduleKey, recordId);
  
  // Check cache first (unless force refresh)
  if (!forceRefresh && recordCache.has(cacheKey)) {
    const cached = recordCache.get(cacheKey);
    // Check if cache is still valid
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    // Cache expired, remove it
    recordCache.delete(cacheKey);
  }
  
  try {
    const endpoint = getRecordEndpoint(appKey, moduleKey);
    // Related links can legitimately point to deleted/forbidden records.
    // Treat 404/403 as missing (null) instead of throwing noisy console errors.
    const response = await apiClient.getOptional(`${endpoint}/${recordId}`);
    if (!response) return null;
    
    if (response.success && response.data) {
      const normalized = normalizeRecordForDisplay(response.data);
      // Cache the record
      recordCache.set(cacheKey, {
        data: normalized,
        timestamp: Date.now()
      });
      return normalized;
    }
    
    return null;
  } catch (error) {
    console.error(`[recordDisplay] Error fetching record ${appKey}.${moduleKey}:${recordId}:`, error);
    return null;
  }
}

/**
 * Get display label for a record
 * Tries multiple fields in order: name, title, first/last name, email, id
 */
export function getRecordLabel(record) {
  if (!record) return 'Unnamed Record';
  
  // Preserve explicit labels from upstream formatters.
  if (record.label) return record.label;
  if (record.displayName) return record.displayName;
  if (record.fullName) return record.fullName;
  if (record.full_name) return record.full_name;

  // Try common fields
  if (record.name) return record.name;
  if (record.item_name) return record.item_name;
  if (record.item_code) return record.item_code;
  if (record.quoteTitle) return record.quoteTitle;
  if (record.quoteNumber) return record.quoteNumber;
  if (record.invoiceNumber) return record.invoiceNumber;
  if (record.title) return record.title;
  if (record.documentNumber) return record.documentNumber;
  if (record.eventName) return record.eventName;
  if (record.primaryField) return record.primaryField;
  const firstName = record.firstName || record.first_name || '';
  const lastName = record.lastName || record.last_name || '';
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim() || 'Unnamed Record';
  }
  if (record.email) return record.email;
  if (record._id) return record._id.toString().substring(0, 8);
  if (record.id) return record.id.toString().substring(0, 8);
  
  return 'Unnamed Record';
}

/**
 * True when record context / server hydration already has enough to render a related card.
 */
export function isRecordEnrichedForDisplay(record, moduleKey, options = {}) {
  if (!record) return false;
  if (record._isBroken) return true;

  const id = record.recordId ?? record.id ?? record._id;
  const label = getRecordLabel(record);
  if (!label || label === 'Unnamed Record') return false;

  const idSuffix = id ? String(id).slice(-8) : '';
  if (idSuffix && label === idSuffix) return false;

  return hasPopulatedRelatedKeyField(record, moduleKey, 2, options);
}

/**
 * Get secondary text for a record (status, email, etc.)
 */
export function getRecordSecondaryText(record) {
  if (!record) return '';
  
  if (record.status) return record.status;
  if (record.email && !record.name && !record.title) return '';
  if (record.email) return record.email;
  if (record.stage) return record.stage;
  
  return '';
}

const RELATED_RECORD_KEY_FIELDS = Object.freeze({
  organizations: [
    { key: 'industry', label: 'Industry' },
    { key: 'types', label: 'Type' },
    { key: 'phone', label: 'Phone', altKeys: ['website', 'customerStatus'] }
  ],
  deals: [
    { key: 'stage', label: 'Stage', altKeys: ['stageName'] },
    { key: 'amount', label: 'Amount', format: 'currency' },
    { key: 'probability', label: 'Probability' }
  ],
  quotes: [
    { key: 'quoteNumber', label: 'Quote #' },
    { key: 'status', label: 'Status' }
  ],
  sales_orders: [
    { key: 'salesOrderNumber', label: 'Order #' },
    { key: 'status', label: 'Status' }
  ],
  invoices: [
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'status', label: 'Status' }
  ],
  payments: [
    { key: 'paymentNumber', label: 'Payment #' },
    { key: 'status', label: 'Status' }
  ],
  people: [
    { key: 'email', label: 'Email' },
    { key: 'mobile', label: 'Mobile', altKeys: ['phone'] }
  ],
  documents: [
    { key: 'documentNumber', label: 'Doc #' },
    { key: 'status', label: 'Status' }
  ],
  cases: [
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' }
  ],
  tasks: [
    { key: 'status', label: 'Status' },
    { key: 'dueDate', label: 'Due', format: 'date' }
  ],
  events: [
    { key: 'eventType', label: 'Type' },
    { key: 'status', label: 'Status', altKeys: ['startDateTime'] }
  ],
  forms: [
    { key: 'formType', label: 'Type' },
    { key: 'status', label: 'Status' }
  ],
  items: [
    { key: 'item_code', label: 'Code', altKeys: ['itemCode'] },
    { key: 'status', label: 'Status' }
  ],
  projects: [
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' }
  ]
});

const RELATED_RECORD_EMPTY_VALUE = '-';

function resolveRecordRawFieldValue(record, fieldKey) {
  let value = record?.[fieldKey];
  if (value == null || value === '') {
    value = record?.customFields?.[fieldKey];
  }
  return value;
}

function resolveRelatedFieldRawValue(record, field) {
  let value = resolveRecordRawFieldValue(record, field.key);
  if ((value == null || value === '') && Array.isArray(field.altKeys)) {
    for (const altKey of field.altKeys) {
      const altValue = resolveRecordRawFieldValue(record, altKey);
      if (altValue != null && altValue !== '') {
        value = altValue;
        break;
      }
    }
  }
  return value;
}

function isDisplayableRelatedRawValue(value) {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.some((entry) => isDisplayableRelatedRawValue(entry));
  if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) return false;
  if (typeof value === 'object') {
    const display = value.name || value.title || value.firstName || value.first_name
      || value.label || value.email || value.username;
    if (display) return true;
    if (value._id && !display) return false;
  }
  return true;
}

function resolveRelatedKeyFieldConfig(moduleKey, moduleDefinition, maxFields = 2) {
  const normalizedModuleKey = normalizeRelatedModuleKey(moduleKey);
  const configured = getKeyFields(moduleDefinition || {});
  if (configured.length > 0) {
    return configured.slice(0, maxFields).map((fieldDef) => ({
      key: fieldDef.key,
      label: getFieldDisplayLabel(fieldDef) || fieldDef.key,
      fieldDef
    }));
  }
  const fallback = RELATED_RECORD_KEY_FIELDS[normalizedModuleKey] || [
    { key: 'status', label: 'Status' },
    { key: 'email', label: 'Email', altKeys: ['phone', 'mobile'] }
  ];
  return fallback.slice(0, maxFields);
}

function hasPopulatedRelatedKeyField(record, moduleKey, maxFields = 2, options = {}) {
  if (!record) return false;
  const config = resolveRelatedKeyFieldConfig(moduleKey, options.moduleDefinition, maxFields);
  return config.some((field) => {
    const value = field.fieldDef
      ? resolveRecordRawFieldValue(record, field.key)
      : resolveRelatedFieldRawValue(record, field);
    return isDisplayableRelatedRawValue(value);
  });
}
function formatRelatedFieldValue(record, field, rawValue) {
  if (rawValue == null || rawValue === '') return '';
  if (Array.isArray(rawValue)) {
    const parts = rawValue.filter((value) => value != null && value !== '');
    if (!parts.length) return '';
    return parts.map((value) => String(value)).join(', ');
  }
  if (field.format === 'currency' && typeof rawValue === 'number') {
    const currency = record?.currency || record?.currencyCode || 'USD';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(rawValue);
    } catch {
      return String(rawValue);
    }
  }
  if (field.format === 'date') {
    const d = new Date(rawValue);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return String(rawValue);
}

/**
 * First N key field label/value pairs for related record cards.
 * Always returns up to maxFields entries; empty values use emptyValue (default "-").
 */
export function getRelatedRecordDetailLines(record, moduleKey, maxFields = 2, options = {}) {
  const { emptyValue = RELATED_RECORD_EMPTY_VALUE, moduleDefinition = null } = options;
  const config = resolveRelatedKeyFieldConfig(moduleKey, moduleDefinition, maxFields);
  return config.map((field) => {
    if (field.fieldDef) {
      const formatted = getFieldValue(field.fieldDef, record || {});
      return {
        label: field.label,
        value: formatted || emptyValue,
        isEmpty: !formatted
      };
    }
    const rawValue = resolveRelatedFieldRawValue(record || {}, field);
    const formatted = formatRelatedFieldValue(record || {}, field, rawValue);
    return {
      label: field.label,
      value: formatted || emptyValue,
      isEmpty: !formatted
    };
  });
}

function normalizeRecordForDisplay(record) {
  if (!record || typeof record !== 'object') return record;
  if (!record.customFields || typeof record.customFields !== 'object') return record;
  const { customFields, ...rest } = record;
  return { ...customFields, ...rest };
}

/**
 * Batch fetch records for display (with caching)
 */
export async function fetchRecordsForDisplay(records, forceRefresh = false) {
  if (!records || records.length === 0) return [];

  const fetchedRecords = new Array(records.length).fill(null);
  const batchGroups = new Map(); // moduleKey -> [{ index, recordId, appKey, moduleKey }]

  // First pass: resolve from cache and group batch-capable misses.
  records.forEach((record, index) => {
    const recordId = record.recordId ?? record.id ?? record._id;
    const moduleKey = normalizeRelatedModuleKey(record.moduleKey);
    const appKey = String(record.appKey || '').toUpperCase();
    if (!recordId || !moduleKey) {
      fetchedRecords[index] = null;
      return;
    }

    const cacheKey = getCacheKey(appKey, moduleKey, recordId);
    if (!forceRefresh && recordCache.has(cacheKey)) {
      const cached = recordCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        fetchedRecords[index] = cached.data;
        return;
      }
      recordCache.delete(cacheKey);
    }

    if (DIRECT_FETCH_MODULES.has(moduleKey)) {
      fetchedRecords[index] = fetchRecord(appKey, moduleKey, recordId, forceRefresh);
      return;
    }

    if (BATCH_FETCH_MODULES.has(moduleKey) && !unsupportedBatchModules.has(moduleKey)) {
      if (!batchGroups.has(moduleKey)) batchGroups.set(moduleKey, []);
      batchGroups.get(moduleKey).push({ index, recordId, appKey, moduleKey });
      return;
    }

    // Fallback for non-batch modules.
    fetchedRecords[index] = fetchRecord(appKey, moduleKey, recordId, forceRefresh);
  });

  // Resolve any fallback fetch promises.
  const fallbackPromises = fetchedRecords.map(async (item, index) => {
    if (item && typeof item.then === 'function') {
      fetchedRecords[index] = await item;
    }
  });
  await Promise.all(fallbackPromises);

  // Batch fetch by module to avoid per-record 404 spam for stale links.
  const batchPromises = Array.from(batchGroups.entries()).map(async ([moduleKey, entries]) => {
    const ids = [...new Set(entries.map((e) => String(e.recordId)))];
    if (ids.length === 0) return;

    try {
      const response = await apiClient.postOptional(`/modules/${moduleKey}/records/batch`, { ids });
      if (!response) {
        unsupportedBatchModules.add(moduleKey);
        await Promise.all(entries.map(async ({ index, recordId, appKey }) => {
          fetchedRecords[index] = await fetchRecord(appKey, moduleKey, recordId, forceRefresh);
        }));
        return;
      }
      const rows = Array.isArray(response?.data) ? response.data : [];
      const rowById = new Map(rows.map((row) => [String(row?._id ?? row?.id ?? ''), row]));

      entries.forEach(({ index, recordId, appKey }) => {
        const row = rowById.get(String(recordId)) || null;
        const normalized = row ? normalizeRecordForDisplay(row) : null;
        fetchedRecords[index] = normalized;
        if (normalized) {
          const cacheKey = getCacheKey(appKey, moduleKey, recordId);
          recordCache.set(cacheKey, {
            data: normalized,
            timestamp: Date.now()
          });
        }
      });
    } catch (error) {
      const msg = String(error?.message || '').toLowerCase();
      if (error?.status === 400 && msg.includes('batch not supported')) {
        unsupportedBatchModules.add(moduleKey);
      }
      // If batch endpoint fails for any reason, fall back to per-record optional fetch.
      await Promise.all(entries.map(async ({ index, recordId, appKey }) => {
        fetchedRecords[index] = await fetchRecord(appKey, moduleKey, recordId, forceRefresh);
      }));
      console.warn(`[recordDisplay] Batch fetch fallback for module ${moduleKey}:`, error?.message || error);
    }
  });
  await Promise.all(batchPromises);

  return fetchedRecords.map((fetched, index) => {
    if (!fetched) return null;
    const original = records[index];
    const normalized = normalizeRecordForDisplay(fetched);
    return {
      ...original,
      ...normalized,
      label: getRecordLabel(normalized || original),
      secondaryText: getRecordSecondaryText(normalized || original)
    };
  });
}

/**
 * Clear record cache (useful on logout or when data changes)
 */
export function clearRecordCache() {
  recordCache.clear();
}

/**
 * Clear cache for a specific record
 */
export function clearRecordCacheFor(appKey, moduleKey, recordId) {
  const cacheKey = getCacheKey(appKey, moduleKey, recordId);
  recordCache.delete(cacheKey);
}


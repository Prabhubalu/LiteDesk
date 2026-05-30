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

// Cache for record data (key: appKey.moduleKey.recordId)
const recordCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BATCH_FETCH_MODULES = new Set(['deals', 'events', 'forms', 'people', 'cases', 'quotes']);
const unsupportedBatchModules = new Set();

/**
 * Get endpoint for a record type.
 * Server routes are module-based (/api/tasks, /api/deals, etc.), not /api/{appKey}/{moduleKey}.
 */
function getRecordEndpoint(appKey, moduleKey) {
  const normalizedModule = (moduleKey ?? '').toString().toLowerCase().trim();
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
    quote: '/quotes'
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
      // Cache the record
      recordCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
      return response.data;
    }
    
    return null;
  } catch (error) {
    console.error(`[recordDisplay] Error fetching record ${appKey}.${moduleKey}:${recordId}:`, error);
    return null;
  }
}

/**
 * Get display label for a record
 * Tries multiple fields in order: name, title, eventName, primaryField, email, id
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
  if (record.quoteTitle) return record.quoteTitle;
  if (record.quoteNumber) return record.quoteNumber;
  if (record.title) return record.title;
  if (record.eventName) return record.eventName;
  if (record.primaryField) return record.primaryField;
  if (record.email) return record.email;
  const firstName = record.firstName || record.first_name || '';
  const lastName = record.lastName || record.last_name || '';
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim() || 'Unnamed Record';
  }
  if (record._id) return record._id.toString().substring(0, 8);
  if (record.id) return record.id.toString().substring(0, 8);
  
  return 'Unnamed Record';
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
    const moduleKey = String(record.moduleKey || '').toLowerCase();
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
      const response = await apiClient.post(`/modules/${moduleKey}/records/batch`, { ids });
      const rows = Array.isArray(response?.data) ? response.data : [];
      const rowById = new Map(rows.map((row) => [String(row?._id ?? row?.id ?? ''), row]));

      entries.forEach(({ index, recordId, appKey }) => {
        const row = rowById.get(String(recordId)) || null;
        fetchedRecords[index] = row;
        if (row) {
          const cacheKey = getCacheKey(appKey, moduleKey, recordId);
          recordCache.set(cacheKey, {
            data: row,
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
    return {
      ...original,
      ...fetched,
      label: getRecordLabel(fetched || original),
      secondaryText: getRecordSecondaryText(fetched || original)
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


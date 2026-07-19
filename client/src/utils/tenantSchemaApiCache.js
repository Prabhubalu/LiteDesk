/**
 * In-memory caches for tenant schema endpoints that are safe to share across the app.
 * Invalidated on core-module / module definition changes and logout.
 */
import { getActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';

function sessionKey() {
  try {
    const pinia = getActivePinia();
    if (!pinia) return '';
    const auth = useAuthStore(pinia);
    const orgId =
      auth.user?.organizationId ||
      auth.organization?._id ||
      auth.user?.organization?._id ||
      '';
    return `${auth.user?._id || ''}:${orgId}`;
  } catch {
    return '';
  }
}

/** GET /settings/core-modules (full response, client still filters by permissions) */
let coreModulesResponse = null;
let coreModulesSessionKey = '';
let coreModulesInflight = null;

export async function fetchCoreModulesSettingsCached() {
  const sk = sessionKey();
  if (!sk) {
    return apiClient('/settings/core-modules', { method: 'GET' });
  }
  if (coreModulesResponse && coreModulesSessionKey === sk) {
    return coreModulesResponse;
  }
  if (coreModulesInflight) {
    return coreModulesInflight;
  }
  coreModulesInflight = apiClient('/settings/core-modules', { method: 'GET' })
    .then((res) => {
      coreModulesResponse = res;
      coreModulesSessionKey = sk;
      return res;
    })
    .finally(() => {
      coreModulesInflight = null;
    });
  return coreModulesInflight;
}

/** GET /modules — key by sorted query params */
const modulesCache = new Map();
const modulesInflight = new Map();

function modulesCacheKey(params) {
  if (!params || typeof params !== 'object' || !Object.keys(params).length) {
    return 'context=all';
  }
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join('&');
}

function normalizeModulesListParams(params = {}) {
  const normalized = { ...(params || {}) };
  if (!Object.keys(normalized).length) {
    return { context: 'all' };
  }
  if (normalized.key && normalized.context == null) {
    normalized.context = 'all';
  }
  return normalized;
}

export function parseModulesListResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.modules)) return response.modules;
  if (Array.isArray(response?.data?.modules)) return response.data.modules;
  return [];
}

/**
 * Resolve a single module definition; prefers full-list cache over keyed fetches.
 */
export async function fetchModuleDefinitionCached(moduleKey, options = {}) {
  const key = String(moduleKey || '').toLowerCase().trim();
  if (!key) return null;

  const context = options.context ?? 'all';
  const sk = sessionKey();
  const fullParams = { context };
  const fullCacheKey = `${sk}|${modulesCacheKey(fullParams)}`;

  if (modulesCache.has(fullCacheKey)) {
    const found = parseModulesListResponse(modulesCache.get(fullCacheKey)).find(
      (module) => String(module?.key || '').toLowerCase() === key
    );
    if (found) return found;
  }

  const keyedRes = await fetchModulesListCached({ key: moduleKey, context });
  const keyedList = parseModulesListResponse(keyedRes);
  return (
    keyedList.find((module) => String(module?.key || '').toLowerCase() === key) ||
    keyedList[0] ||
    null
  );
}

/**
 * Cached GET /modules. Pass same shape as apiClient.get second arg `params`.
 * For calls that use a raw query string, normalize to params first.
 * Pass `{ cache: 'no-store' }` to bypass/refresh the in-memory entry.
 */
export async function fetchModulesListCached(params = {}, options = {}) {
  const normalizedParams = normalizeModulesListParams(params);
  const sk = sessionKey();
  const pk = modulesCacheKey(normalizedParams);
  const cacheKey = `${sk}|${pk}`;

  if (options.cache === 'no-store') {
    modulesCache.delete(cacheKey);
  } else if (modulesCache.has(cacheKey)) {
    return modulesCache.get(cacheKey);
  }
  if (modulesInflight.has(cacheKey)) {
    return modulesInflight.get(cacheKey);
  }

  const p = apiClient
    .get('/modules', { params: normalizedParams, ...(options.cache === 'no-store' ? { cache: 'no-store' } : {}) })
    .then((res) => {
      modulesCache.set(cacheKey, res);
      return res;
    })
    .finally(() => {
      modulesInflight.delete(cacheKey);
    });

  modulesInflight.set(cacheKey, p);
  return p;
}

export function invalidateTenantSchemaCaches() {
  coreModulesResponse = null;
  coreModulesSessionKey = '';
  coreModulesInflight = null;
  modulesCache.clear();
  modulesInflight.clear();
  import('@/utils/recordLookupCache')
    .then(({ invalidateRecordLookupCaches }) => invalidateRecordLookupCaches())
    .catch(() => {});
  import('@/utils/recordDisplay')
    .then(({ clearRelatedModuleDefinitionsCache }) => clearRelatedModuleDefinitionsCache())
    .catch(() => {});
  apiClient.clearMetadataResponseCache?.();
  import('@/composables/usePeopleModuleFields')
    .then(({ invalidatePeopleModuleFieldsCache }) => invalidatePeopleModuleFieldsCache())
    .catch(() => {});
}

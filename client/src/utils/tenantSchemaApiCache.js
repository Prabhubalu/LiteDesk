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
    return '';
  }
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join('&');
}

/**
 * Cached GET /modules. Pass same shape as apiClient.get second arg `params`.
 * For calls that use a raw query string, normalize to params first.
 */
export async function fetchModulesListCached(params = {}) {
  const sk = sessionKey();
  const pk = modulesCacheKey(params);
  const cacheKey = `${sk}|${pk}`;

  if (modulesCache.has(cacheKey)) {
    return modulesCache.get(cacheKey);
  }
  if (modulesInflight.has(cacheKey)) {
    return modulesInflight.get(cacheKey);
  }

  const p = apiClient
    .get('/modules', { params: Object.keys(params).length ? params : undefined })
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
  import('@/utils/recordDisplay')
    .then(({ clearRelatedModuleDefinitionsCache }) => clearRelatedModuleDefinitionsCache())
    .catch(() => {});
  apiClient.clearMetadataResponseCache?.();
  import('@/composables/usePeopleModuleFields')
    .then(({ invalidatePeopleModuleFieldsCache }) => invalidatePeopleModuleFieldsCache())
    .catch(() => {});
}

import apiClient from '@/utils/apiClient';
import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';

const LIST_META_SUFFIX = '/meta';

/** Modules with server-side list meta endpoints (filter-aware fingerprints). */
const SERVER_LIST_META_MODULES = new Set([
  'tasks',
  'deals',
  'people',
  'organizations',
  'events',
  'cases',
  'items',
  'forms',
  'imports',
  'documents',
  'trash',
]);

/** Modules not in moduleListRegistry but with list meta endpoints. */
const LIST_META_ENDPOINT_OVERRIDES = {
  forms: '/forms/meta',
  imports: '/imports/meta',
  documents: '/documents/meta',
  trash: '/trash/meta',
};

export function supportsServerListMeta(moduleKey) {
  return SERVER_LIST_META_MODULES.has(String(moduleKey || '').toLowerCase());
}

function resolveListMetaEndpoint(moduleKey) {
  const mod = String(moduleKey || '').toLowerCase();
  if (LIST_META_ENDPOINT_OVERRIDES[mod]) {
    return LIST_META_ENDPOINT_OVERRIDES[mod];
  }

  const config = getModuleListConfig(moduleKey);
  const base = config?.apiEndpoint;
  if (!base) return null;
  const normalized = base.startsWith('/') ? base : `/${base}`;
  return `${normalized}${LIST_META_SUFFIX}`;
}

/**
 * Fetch filter-aware list fingerprint from server meta endpoint.
 * @returns {Promise<{ totalRecords: number, maxUpdatedAt: number|null }|null>}
 */
export async function fetchModuleListMeta(moduleKey, params = {}) {
  if (!supportsServerListMeta(moduleKey)) return null;

  const endpoint = resolveListMetaEndpoint(moduleKey);
  if (!endpoint) return null;

  try {
    const response = await apiClient.get(endpoint, {
      params,
      cache: 'no-store',
    });
    if (!response?.success || !response.data) return null;

    const totalRecords = Number(response.data.totalRecords);
    const maxUpdatedAt = response.data.maxUpdatedAt
      ? new Date(response.data.maxUpdatedAt).getTime()
      : null;

    return {
      totalRecords: Number.isFinite(totalRecords) ? totalRecords : 0,
      maxUpdatedAt: Number.isFinite(maxUpdatedAt) ? maxUpdatedAt : null,
    };
  } catch (error) {
    console.warn('[moduleListMetaApi] fetch failed:', error);
    return null;
  }
}

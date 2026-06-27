import apiClient from '@/utils/apiClient';

const MODULE_SPECIFIC_META = {
  tasks: (recordId) => `/tasks/${recordId}/meta`,
  deals: (recordId) => `/deals/${recordId}/meta`,
  cases: (recordId) => `/helpdesk/cases/${recordId}/meta`,
};

function resolveRecordMetaEndpoint(moduleKey, recordId) {
  const mod = String(moduleKey || '').toLowerCase();
  const id = String(recordId || '').trim();
  if (!mod || !id) return null;

  const specific = MODULE_SPECIFIC_META[mod];
  if (specific) return specific(id);

  return `/modules/${mod}/records/${id}/meta`;
}

export function supportsServerRecordMeta(moduleKey) {
  return Boolean(String(moduleKey || '').trim());
}

/**
 * @returns {Promise<number|null>} updatedAt in ms, or null if unavailable
 */
export async function fetchRecordUpdatedAtMs(moduleKey, recordId) {
  const endpoint = resolveRecordMetaEndpoint(moduleKey, recordId);
  if (!endpoint) return null;

  try {
    const response = await apiClient.get(endpoint, { cache: 'no-store' });
    if (!response?.success || !response.data?.updatedAt) return null;
    const ms = new Date(response.data.updatedAt).getTime();
    return Number.isFinite(ms) ? ms : null;
  } catch (error) {
    console.warn('[recordDetailMetaApi] fetch failed:', error);
    return null;
  }
}

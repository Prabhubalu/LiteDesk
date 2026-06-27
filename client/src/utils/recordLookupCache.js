/**
 * Session-scoped lookup list caches with in-flight coalescing.
 * Shared across record pages, case composables, and DynamicFormField.
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

function paramsKey(params = {}) {
  const entries = Object.entries(params || {}).filter(([, value]) => value !== undefined);
  if (!entries.length) return '';
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
}

const lookupCache = new Map();
const lookupInflight = new Map();

async function cachedLookupGet(endpoint, params = {}) {
  const sk = sessionKey();
  const pk = paramsKey(params);
  const cacheKey = `${sk}|${endpoint}|${pk}`;

  if (lookupCache.has(cacheKey)) {
    return lookupCache.get(cacheKey);
  }
  if (lookupInflight.has(cacheKey)) {
    return lookupInflight.get(cacheKey);
  }

  const request = apiClient
    .get(endpoint, Object.keys(params).length ? { params } : undefined)
    .then((response) => {
      lookupCache.set(cacheKey, response);
      return response;
    })
    .finally(() => {
      lookupInflight.delete(cacheKey);
    });

  lookupInflight.set(cacheKey, request);
  return request;
}

export function invalidateRecordLookupCaches() {
  lookupCache.clear();
  lookupInflight.clear();
}

export function fetchUsersListCached(params = { limit: 500 }) {
  return cachedLookupGet('/users/list', params);
}

export function fetchOrganizationsListCached(params = { limit: 500 }) {
  return cachedLookupGet('/v2/organization', params);
}

export function fetchPeopleListCached(params = { limit: 500, sortBy: 'firstName', sortOrder: 'asc' }) {
  return cachedLookupGet('/people', params);
}

/** Canonical params for deal relationship pickers (inline edit + CreateRecordDrawer). */
export const DEAL_RELATIONSHIP_PEOPLE_PARAMS = {
  limit: 500,
  sortBy: 'firstName',
  sortOrder: 'asc',
};

export const DEAL_RELATIONSHIP_ORG_PARAMS = { limit: 500 };

export const DEAL_RELATIONSHIP_USERS_PARAMS = { limit: 500 };

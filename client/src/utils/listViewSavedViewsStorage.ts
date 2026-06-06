import apiClient from '@/utils/apiClient';

const STORAGE_PREFIX = 'arivu-listview';

export type StoredCustomView = {
  id: string;
  label: string;
  description?: string;
  filters?: Record<string, unknown>;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeUserId(userId?: string | null): string {
  if (userId == null || userId === '') return '';
  return String(userId);
}

function legacySavedViewsKey(moduleKey: string): string {
  return `${STORAGE_PREFIX}-${moduleKey}-saved-views`;
}

export function getSavedViewsStorageKey(moduleKey: string, userId?: string | null): string {
  const uid = normalizeUserId(userId);
  if (!uid) return legacySavedViewsKey(moduleKey);
  return `${STORAGE_PREFIX}-${moduleKey}-${uid}-saved-views`;
}

function readLocalCustomViews(moduleKey: string, userId?: string | null): StoredCustomView[] {
  const keys = normalizeUserId(userId)
    ? [getSavedViewsStorageKey(moduleKey, userId), legacySavedViewsKey(moduleKey)]
    : [legacySavedViewsKey(moduleKey)];

  for (const key of keys) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) continue;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) continue;
      return parsed;
    } catch (error) {
      console.warn('[listViewSavedViewsStorage] Failed to read local custom views:', error);
    }
  }

  return [];
}

export function saveCustomSavedViewsLocal(
  moduleKey: string,
  userId: string | null | undefined,
  views: StoredCustomView[]
): void {
  try {
    const payload = JSON.stringify(views);
    localStorage.setItem(getSavedViewsStorageKey(moduleKey, userId), payload);
    localStorage.setItem(legacySavedViewsKey(moduleKey), payload);
  } catch (error) {
    console.warn('[listViewSavedViewsStorage] Failed to save local custom views:', error);
  }
}

export async function fetchCustomSavedViews(
  moduleKey: string,
  userId?: string | null
): Promise<StoredCustomView[]> {
  const localViews = readLocalCustomViews(moduleKey, userId);

  try {
    const response = await apiClient.get('/user-preferences/list-saved-views', {
      params: { moduleKey },
    });
    if (response?.success && Array.isArray(response.data)) {
      if (response.data.length > 0) {
        saveCustomSavedViewsLocal(moduleKey, userId, response.data);
        return response.data;
      }
      if (localViews.length > 0) {
        await persistCustomSavedViews(moduleKey, userId, localViews);
        return localViews;
      }
      return [];
    }
  } catch (error) {
    console.warn('[listViewSavedViewsStorage] Failed to fetch custom views from server:', error);
  }

  return localViews;
}

export async function persistCustomSavedViews(
  moduleKey: string,
  userId: string | null | undefined,
  views: StoredCustomView[]
): Promise<void> {
  saveCustomSavedViewsLocal(moduleKey, userId, views);

  try {
    await apiClient.post('/user-preferences/list-saved-views', {
      moduleKey,
      views,
    });
  } catch (error) {
    console.warn('[listViewSavedViewsStorage] Failed to persist custom views to server:', error);
  }
}

/** @deprecated Use fetchCustomSavedViews */
export function loadCustomSavedViews(
  moduleKey: string,
  userId?: string | null
): StoredCustomView[] {
  return readLocalCustomViews(moduleKey, userId);
}

/** @deprecated Use persistCustomSavedViews */
export function saveCustomSavedViews(
  moduleKey: string,
  userId: string | null | undefined,
  views: StoredCustomView[]
): void {
  saveCustomSavedViewsLocal(moduleKey, userId, views);
}

export function getActiveSavedViewStorageKey(moduleKey: string, userId?: string | null): string {
  const uid = normalizeUserId(userId);
  if (!uid) return `${STORAGE_PREFIX}-${moduleKey}-active-view`;
  return `${STORAGE_PREFIX}-${moduleKey}-${uid}-active-view`;
}

export function loadActiveSavedViewId(moduleKey: string, userId?: string | null): string | null {
  const keys = normalizeUserId(userId)
    ? [getActiveSavedViewStorageKey(moduleKey, userId), `${STORAGE_PREFIX}-${moduleKey}-active-view`]
    : [`${STORAGE_PREFIX}-${moduleKey}-active-view`];

  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }

  return null;
}

export function saveActiveSavedViewId(
  moduleKey: string,
  userId: string | null | undefined,
  viewId: string | null
): void {
  const key = getActiveSavedViewStorageKey(moduleKey, userId);
  if (viewId) {
    localStorage.setItem(key, viewId);
    localStorage.setItem(`${STORAGE_PREFIX}-${moduleKey}-active-view`, viewId);
  } else {
    localStorage.removeItem(key);
    localStorage.removeItem(`${STORAGE_PREFIX}-${moduleKey}-active-view`);
  }
}

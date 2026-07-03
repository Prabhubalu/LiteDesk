import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import type {
  AnalyticsAssetType,
  AnalyticsHomePayload,
  AnalyticsHomeRecentItem,
  AnalyticsSearchResult,
} from '@/types/analytics.types';

export interface AnalyticsFolderRecord {
  _id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsTrashItem {
  assetType: AnalyticsAssetType;
  _id: string;
  name: string;
  apiName: string;
  archivedAt: string;
}

export interface AnalyticsOrgSettings {
  cacheTtlSeconds: number;
  exportRowLimit: number;
  fiscalYearStartMonth: number;
  defaultDatePreset: string;
}

export function useAnalyticsHome() {
  const home = ref<AnalyticsHomePayload | null>(null);
  const searchResults = ref<AnalyticsSearchResult[]>([]);
  const folders = ref<AnalyticsFolderRecord[]>([]);
  const trashItems = ref<AnalyticsTrashItem[]>([]);
  const settings = ref<AnalyticsOrgSettings | null>(null);
  const favoriteIds = ref<Set<string>>(new Set());
  const loading = ref(false);
  const searching = ref(false);
  const saving = ref(false);

  function favoriteKey(assetType: string, assetId: string) {
    return `${assetType}:${assetId}`;
  }

  function syncFavoriteIds(items: AnalyticsHomeRecentItem[]) {
    favoriteIds.value = new Set(items.map((item) => favoriteKey(item.assetType, item._id)));
  }

  async function fetchHome() {
    loading.value = true;
    try {
      const response = await apiClient.get('/analytics/home', { cache: 'no-store' });
      if (response?.success) {
        home.value = response.data;
        syncFavoriteIds(response.data?.favorites || []);
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function searchAssets(query: string) {
    const q = query.trim();
    if (!q) {
      searchResults.value = [];
      return { success: true, data: [] };
    }

    searching.value = true;
    try {
      const response = await apiClient.get('/analytics/search', {
        params: { q, limit: 20 },
        cache: 'no-store',
      });
      if (response?.success) {
        searchResults.value = response.data ?? [];
      }
      return response;
    } finally {
      searching.value = false;
    }
  }

  function clearSearch() {
    searchResults.value = [];
  }

  function isFavorite(assetType: string, assetId: string) {
    return favoriteIds.value.has(favoriteKey(assetType, assetId));
  }

  async function toggleFavorite(assetType: AnalyticsAssetType, assetId: string) {
    const key = favoriteKey(assetType, assetId);
    if (favoriteIds.value.has(key)) {
      await apiClient.delete(`/analytics/favorites/${assetType}/${assetId}`);
      favoriteIds.value.delete(key);
      if (home.value) {
        home.value.favorites = home.value.favorites.filter(
          (item) => !(item.assetType === assetType && item._id === assetId),
        );
      }
      return { favorited: false };
    }

    await apiClient.post('/analytics/favorites', { assetType, assetId });
    favoriteIds.value.add(key);
    await fetchHome();
    return { favorited: true };
  }

  async function fetchFolders() {
    const response = await apiClient.get('/analytics/folders', { cache: 'no-store' });
    if (response?.success) {
      folders.value = response.data ?? [];
    }
    return response;
  }

  async function createFolder(name: string, description?: string | null) {
    saving.value = true;
    try {
      return await apiClient.post('/analytics/folders', { name, description });
    } finally {
      saving.value = false;
    }
  }

  async function deleteFolder(id: string) {
    return apiClient.delete(`/analytics/folders/${id}`);
  }

  async function fetchTrash() {
    loading.value = true;
    try {
      const response = await apiClient.get('/analytics/trash', { cache: 'no-store' });
      if (response?.success) {
        trashItems.value = response.data ?? [];
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function restoreTrashItem(assetType: AnalyticsAssetType, id: string) {
    return apiClient.post(`/analytics/trash/${assetType}/${id}/restore`, {});
  }

  async function fetchSettings() {
    const response = await apiClient.get('/analytics/settings', { cache: 'no-store' });
    if (response?.success) {
      settings.value = response.data;
    }
    return response;
  }

  async function updateSettings(payload: Partial<AnalyticsOrgSettings>) {
    saving.value = true;
    try {
      const response = await apiClient.put('/analytics/settings', payload);
      if (response?.success) {
        settings.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  return {
    home,
    searchResults,
    folders,
    trashItems,
    settings,
    favoriteIds,
    loading,
    searching,
    saving,
    fetchHome,
    searchAssets,
    clearSearch,
    isFavorite,
    toggleFavorite,
    fetchFolders,
    createFolder,
    deleteFolder,
    fetchTrash,
    restoreTrashItem,
    fetchSettings,
    updateSettings,
  };
}

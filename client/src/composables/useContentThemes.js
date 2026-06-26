import { ref, reactive } from 'vue';
import apiClient from '@/utils/apiClient';

export function useContentThemes() {
  const themes = ref([]);
  const loading = ref(false);
  const pagination = reactive({
    currentPage: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });

  async function fetchThemes(options = {}) {
    loading.value = true;
    try {
      const page = options.page ?? pagination.currentPage;
      const limit = options.limit ?? pagination.limit;
      const response = await apiClient.get('/content/themes', {
        params: {
          page,
          limit,
          status: options.status || undefined,
          search: options.search || undefined
        },
        cache: 'no-store'
      });

      if (response?.success) {
        themes.value = Array.isArray(response.data) ? response.data : [];
        const pag = response.pagination || {};
        pagination.currentPage = pag.page ?? page;
        pagination.limit = pag.limit ?? limit;
        pagination.total = pag.total ?? themes.value.length;
        pagination.totalPages = pag.totalPages ?? 1;
      } else {
        themes.value = [];
      }

      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTheme(id) {
    const response = await apiClient.get(`/content/themes/${id}`, { cache: 'no-store' });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to load theme');
    }
    return response.data;
  }

  async function createTheme(payload) {
    const response = await apiClient.post('/content/themes', payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to create theme');
    }
    return response.data;
  }

  async function updateTheme(id, payload) {
    const response = await apiClient.put(`/content/themes/${id}`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to update theme');
    }
    return response.data;
  }

  async function publishTheme(id) {
    const response = await apiClient.post(`/content/themes/${id}/publish`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to publish theme');
    }
    return response.data;
  }

  async function archiveTheme(id) {
    const response = await apiClient.post(`/content/themes/${id}/archive`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to archive theme');
    }
    return response.data;
  }

  async function deleteTheme(id) {
    const response = await apiClient.delete(`/content/themes/${id}`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to delete theme');
    }
    return response.data;
  }

  return {
    themes,
    loading,
    pagination,
    fetchThemes,
    fetchTheme,
    createTheme,
    updateTheme,
    publishTheme,
    archiveTheme,
    deleteTheme
  };
}

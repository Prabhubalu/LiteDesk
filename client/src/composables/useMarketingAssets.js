import { ref, reactive } from 'vue';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

function authHeaders() {
  const authStore = useAuthStore();
  const headers = {};
  if (authStore.user?.token) {
    headers.Authorization = `Bearer ${authStore.user.token}`;
  }
  return headers;
}

async function uploadFormData(path, formData) {
  const response = await fetch(getApiUrlForFetch(path), {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    throw new Error(text.slice(0, 120) || `Upload failed (${response.status})`);
  }

  if (!response.ok || !data?.success) {
    const error = new Error(data?.message || 'Upload failed');
    error.response = { data };
    throw error;
  }

  return data.data;
}

export function useMarketingAssets() {
  const assets = ref([]);
  const loading = ref(false);
  const pagination = reactive({
    currentPage: 1,
    limit: 24,
    total: 0,
    totalPages: 1
  });

  async function fetchAssets(options = {}) {
    loading.value = true;
    try {
      const page = options.page ?? pagination.currentPage;
      const limit = options.limit ?? pagination.limit;
      const response = await apiClient.get('/marketing/assets', {
        params: {
          page,
          limit,
          type: options.type || undefined,
          search: options.search || undefined,
          tag: options.tag || undefined
        },
        cache: 'no-store'
      });

      if (response?.success) {
        assets.value = Array.isArray(response.data) ? response.data : [];
        const pag = response.pagination || {};
        pagination.currentPage = pag.page ?? page;
        pagination.limit = pag.limit ?? limit;
        pagination.total = pag.total ?? assets.value.length;
        pagination.totalPages = pag.totalPages ?? 1;
      } else {
        assets.value = [];
      }

      return response;
    } finally {
      loading.value = false;
    }
  }

  async function uploadAsset(file, metadata = {}) {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.type) formData.append('type', metadata.type);
    if (metadata.accessibilityAltText) formData.append('accessibilityAltText', metadata.accessibilityAltText);
    if (Array.isArray(metadata.tags) && metadata.tags.length) {
      formData.append('tags', metadata.tags.join(','));
    }
    return uploadFormData('/marketing/assets', formData);
  }

  async function deleteAsset(id) {
    const response = await apiClient.delete(`/marketing/assets/${id}`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to delete asset');
    }
    return response.data;
  }

  return {
    assets,
    loading,
    pagination,
    fetchAssets,
    uploadAsset,
    deleteAsset
  };
}

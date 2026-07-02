import { ref, reactive } from 'vue';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

export function useMarketingAudiences() {
  const audiences = ref([]);
  const loading = ref(false);
  const audience = ref(null);
  const members = ref([]);
  const membersLoading = ref(false);
  const pagination = reactive({
    currentPage: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const membersPagination = reactive({
    currentPage: 1,
    limit: 50,
    total: 0,
    totalPages: 1
  });

  async function fetchAudiences(options = {}) {
    loading.value = true;
    try {
      const page = options.page ?? pagination.currentPage;
      const limit = options.limit ?? pagination.limit;
      const response = await apiClient.get('/marketing/audiences', {
        params: {
          page,
          limit,
          search: options.search || undefined,
          type: options.type || undefined
        },
        cache: 'no-store'
      });

      if (response?.success) {
        audiences.value = Array.isArray(response.data) ? response.data : [];
        const pag = response.pagination || {};
        pagination.currentPage = pag.page ?? page;
        pagination.limit = pag.limit ?? limit;
        pagination.total = pag.total ?? audiences.value.length;
        pagination.totalPages = pag.totalPages ?? 1;
      } else {
        audiences.value = [];
      }

      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAudience(id) {
    const response = await apiClient.get(`/marketing/audiences/${id}`, { cache: 'no-store' });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to load audience');
    }
    audience.value = response.data;
    return response.data;
  }

  async function createAudience(payload) {
    const response = await apiClient.post('/marketing/audiences', payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to create audience');
    }
    return response.data;
  }

  async function updateAudience(id, payload) {
    const response = await apiClient.put(`/marketing/audiences/${id}`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to update audience');
    }
    audience.value = response.data;
    return response.data;
  }

  async function deleteAudience(id) {
    const response = await apiClient.delete(`/marketing/audiences/${id}`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to delete audience');
    }
    return response;
  }

  async function fetchAudienceMembers(id, options = {}) {
    membersLoading.value = true;
    try {
      const page = options.page ?? membersPagination.currentPage;
      const limit = options.limit ?? membersPagination.limit;
      const response = await apiClient.get(`/marketing/audiences/${id}/members`, {
        params: {
          page,
          limit,
          search: options.search || undefined
        },
        cache: 'no-store'
      });

      if (response?.success) {
        members.value = Array.isArray(response.data) ? response.data : [];
        const pag = response.pagination || {};
        membersPagination.currentPage = pag.page ?? page;
        membersPagination.limit = pag.limit ?? limit;
        membersPagination.total = pag.total ?? members.value.length;
        membersPagination.totalPages = pag.totalPages ?? 1;
      } else {
        members.value = [];
      }

      return response;
    } finally {
      membersLoading.value = false;
    }
  }

  async function addAudienceMembers(id, membersPayload) {
    const response = await apiClient.post(`/marketing/audiences/${id}/members`, {
      members: membersPayload
    });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to add members');
    }
    audience.value = response.data;
    return response;
  }

  async function removeAudienceMember(id, memberId) {
    const response = await apiClient.delete(`/marketing/audiences/${id}/members/${memberId}`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to remove member');
    }
    audience.value = response.data;
    return response;
  }

  async function importAudienceCsv(id, file) {
    const authStore = useAuthStore();
    const token = authStore.user?.token;
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(getApiUrlForFetch(`/marketing/audiences/${id}/import`), {
      method: 'POST',
      headers,
      body: formData
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'Failed to import audience members');
    }

    audience.value = payload.data;
    return payload;
  }

  async function exportAudienceCsv(id) {
    const authStore = useAuthStore();
    const token = authStore.user?.token;
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(getApiUrlForFetch(`/marketing/audiences/${id}/export`), {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'Failed to export audience');
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const fileName = match?.[1] || 'audience.csv';

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function previewAudience(id, options = {}) {
    const response = await apiClient.post(`/marketing/audiences/${id}/preview`, options);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to preview audience');
    }
    return response.data;
  }

  return {
    audiences,
    loading,
    audience,
    members,
    membersLoading,
    pagination,
    membersPagination,
    fetchAudiences,
    fetchAudience,
    createAudience,
    updateAudience,
    deleteAudience,
    fetchAudienceMembers,
    addAudienceMembers,
    removeAudienceMember,
    importAudienceCsv,
    exportAudienceCsv,
    previewAudience
  };
}

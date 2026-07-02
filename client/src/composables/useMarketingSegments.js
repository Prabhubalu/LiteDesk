import { ref, reactive } from 'vue';
import apiClient from '@/utils/apiClient';

export function useMarketingSegments() {
  const segments = ref([]);
  const loading = ref(false);
  const segment = ref(null);
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

  async function fetchSegments(options = {}) {
    loading.value = true;
    try {
      const page = options.page ?? pagination.currentPage;
      const limit = options.limit ?? pagination.limit;
      const response = await apiClient.get('/marketing/segments', {
        params: {
          page,
          limit,
          search: options.search || undefined
        },
        cache: 'no-store'
      });

      if (response?.success) {
        segments.value = Array.isArray(response.data) ? response.data : [];
        const pag = response.pagination || {};
        pagination.currentPage = pag.page ?? page;
        pagination.limit = pag.limit ?? limit;
        pagination.total = pag.total ?? segments.value.length;
        pagination.totalPages = pag.totalPages ?? 1;
      } else {
        segments.value = [];
      }

      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSegment(id) {
    const response = await apiClient.get(`/marketing/segments/${id}`, { cache: 'no-store' });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to load segment');
    }
    segment.value = response.data;
    return response.data;
  }

  async function createSegment(payload) {
    const response = await apiClient.post('/marketing/segments', payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to create segment');
    }
    return response.data;
  }

  async function updateSegment(id, payload) {
    const response = await apiClient.put(`/marketing/segments/${id}`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to update segment');
    }
    segment.value = response.data;
    return response.data;
  }

  async function deleteSegment(id) {
    const response = await apiClient.delete(`/marketing/segments/${id}`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to delete segment');
    }
    return response;
  }

  async function previewSegmentFilter(filterQuery, options = {}) {
    const response = await apiClient.post('/marketing/segments/preview', {
      filterQuery,
      primaryEntity: options.primaryEntity,
      limit: options.limit
    });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to preview segment');
    }
    return response.data;
  }

  async function explainSegmentFilter(filterQuery) {
    const response = await apiClient.post('/marketing/segments/explain', { filterQuery });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to explain segment');
    }
    return response.data;
  }

  async function previewSegment(id, options = {}) {
    const response = await apiClient.post(`/marketing/segments/${id}/preview`, options);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to preview segment');
    }
    return response.data;
  }

  async function fetchSegmentMembers(id, options = {}) {
    membersLoading.value = true;
    try {
      const page = options.page ?? membersPagination.currentPage;
      const limit = options.limit ?? membersPagination.limit;
      const response = await apiClient.get(`/marketing/segments/${id}/members`, {
        params: { page, limit },
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

  async function refreshSegment(id) {
    const response = await apiClient.post(`/marketing/segments/${id}/refresh`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to refresh segment');
    }
    segment.value = response.data;
    return response.data;
  }

  return {
    segments,
    loading,
    segment,
    members,
    membersLoading,
    pagination,
    membersPagination,
    fetchSegments,
    fetchSegment,
    createSegment,
    updateSegment,
    deleteSegment,
    previewSegmentFilter,
    explainSegmentFilter,
    previewSegment,
    fetchSegmentMembers,
    refreshSegment
  };
}

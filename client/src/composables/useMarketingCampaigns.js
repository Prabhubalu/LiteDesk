import { ref, reactive } from 'vue';
import apiClient from '@/utils/apiClient';

export function useMarketingCampaigns() {
  const campaigns = ref([]);
  const loading = ref(false);
  const campaign = ref(null);
  const recipients = ref([]);
  const recipientsLoading = ref(false);
  const pagination = reactive({
    currentPage: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const recipientsPagination = reactive({
    currentPage: 1,
    limit: 100,
    total: 0,
    totalPages: 1
  });

  async function fetchCampaigns(options = {}) {
    loading.value = true;
    try {
      const page = options.page ?? pagination.currentPage;
      const limit = options.limit ?? pagination.limit;
      const response = await apiClient.get('/marketing/campaigns', {
        params: {
          page,
          limit,
          status: options.status || undefined,
          search: options.search || undefined
        },
        cache: 'no-store'
      });

      if (response?.success) {
        campaigns.value = Array.isArray(response.data) ? response.data : [];
        const pag = response.pagination || {};
        pagination.currentPage = pag.page ?? page;
        pagination.limit = pag.limit ?? limit;
        pagination.total = pag.total ?? campaigns.value.length;
        pagination.totalPages = pag.totalPages ?? 1;
      } else {
        campaigns.value = [];
      }

      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCampaign(id) {
    const response = await apiClient.get(`/marketing/campaigns/${id}`, { cache: 'no-store' });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to load campaign');
    }
    campaign.value = response.data;
    return response.data;
  }

  async function createCampaign(payload) {
    const response = await apiClient.post('/marketing/campaigns', payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to create campaign');
    }
    return response.data;
  }

  async function updateCampaign(id, payload) {
    const response = await apiClient.put(`/marketing/campaigns/${id}`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to update campaign');
    }
    campaign.value = response.data;
    return response.data;
  }

  async function deleteCampaign(id) {
    const response = await apiClient.delete(`/marketing/campaigns/${id}`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to delete campaign');
    }
    return response;
  }

  async function duplicateCampaign(id, name) {
    const response = await apiClient.post(`/marketing/campaigns/${id}/duplicate`, { name });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to duplicate campaign');
    }
    return response.data;
  }

  async function sendCampaign(id, payload) {
    const response = await apiClient.post(`/marketing/campaigns/${id}/send`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to send campaign');
    }
    return response.data;
  }

  async function fetchCampaignSendProgress(id) {
    const response = await apiClient.get(`/marketing/campaigns/${id}/send-progress`, {
      cache: 'no-store'
    });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to load send progress');
    }
    return response.data;
  }

  /**
   * Poll send progress until the send is no longer active or the timeout elapses.
   * @param {string} id
   * @param {{ intervalMs?: number, timeoutMs?: number, onUpdate?: (data: Record<string, unknown>) => void }} [options]
   */
  async function pollCampaignSendProgress(id, options = {}) {
    const intervalMs = options.intervalMs ?? 3000;
    const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const data = await fetchCampaignSendProgress(id);
      options.onUpdate?.(data);
      if (!data?.isActive) {
        return data;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return fetchCampaignSendProgress(id);
  }

  async function scheduleCampaign(id, payload) {
    const response = await apiClient.post(`/marketing/campaigns/${id}/schedule`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to schedule campaign');
    }
    return response.data;
  }

  async function testSendCampaign(id, payload) {
    const response = await apiClient.post(`/marketing/campaigns/${id}/test`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to send test email');
    }
    return response.data;
  }

  async function fetchCampaignPrecheck(id, options = {}) {
    const params = {};
    if (options.recipientCount != null) {
      params.recipientCount = options.recipientCount;
    }
    const response = await apiClient.get(`/marketing/campaigns/${id}/precheck`, {
      params,
      cache: 'no-store'
    });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to load pre-send checklist');
    }
    return response.data;
  }

  async function fetchCampaignAnalytics(id, query = {}) {
    const response = await apiClient.get(`/marketing/campaigns/${id}/analytics`, {
      params: query,
      cache: 'no-store'
    });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to load analytics');
    }
    return response.data;
  }

  async function fetchCampaignRecipients(id, options = {}) {
    recipientsLoading.value = true;
    try {
      const page = options.page ?? recipientsPagination.currentPage;
      const limit = options.limit ?? recipientsPagination.limit;
      const response = await apiClient.get(`/marketing/campaigns/${id}/recipients`, {
        params: { page, limit },
        cache: 'no-store'
      });

      if (response?.success) {
        recipients.value = Array.isArray(response.data) ? response.data : [];
        const pag = response.pagination || {};
        recipientsPagination.currentPage = pag.page ?? page;
        recipientsPagination.limit = pag.limit ?? limit;
        recipientsPagination.total = pag.total ?? recipients.value.length;
        recipientsPagination.totalPages = pag.totalPages ?? 1;
      } else {
        recipients.value = [];
      }

      return response;
    } finally {
      recipientsLoading.value = false;
    }
  }

  async function archiveCampaign(id) {
    const response = await apiClient.post(`/marketing/campaigns/${id}/archive`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to archive campaign');
    }
    campaign.value = response.data;
    return response.data;
  }

  async function cancelCampaign(id) {
    const response = await apiClient.post(`/marketing/campaigns/${id}/cancel`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to cancel campaign');
    }
    campaign.value = response.data;
    return response.data;
  }

  async function fetchPendingApprovals(options = {}) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    return apiClient.get('/marketing/campaigns/approvals/pending', {
      params: { page, limit },
      cache: 'no-store'
    });
  }

  async function submitCampaignForReview(id, payload = {}) {
    const response = await apiClient.post(`/marketing/campaigns/${id}/submit-for-review`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to submit campaign for review');
    }
    campaign.value = response.data;
    return response.data;
  }

  async function approveCampaign(id, payload = {}) {
    const response = await apiClient.post(`/marketing/campaigns/${id}/approve`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to approve campaign');
    }
    campaign.value = response.data;
    return response.data;
  }

  async function rejectCampaign(id, payload = {}) {
    const response = await apiClient.post(`/marketing/campaigns/${id}/reject`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to reject campaign');
    }
    campaign.value = response.data;
    return response.data;
  }

  async function fetchCampaignAbResults(id) {
    const response = await apiClient.get(`/marketing/campaigns/${id}/ab-results`, { cache: 'no-store' });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to load A/B results');
    }
    return response.data;
  }

  async function selectCampaignAbWinner(id, payload = {}) {
    const response = await apiClient.post(`/marketing/campaigns/${id}/select-ab-winner`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to select A/B winner');
    }
    return response.data;
  }

  return {
    campaigns,
    loading,
    campaign,
    recipients,
    recipientsLoading,
    pagination,
    recipientsPagination,
    fetchCampaigns,
    fetchCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    duplicateCampaign,
    sendCampaign,
    fetchCampaignSendProgress,
    pollCampaignSendProgress,
    scheduleCampaign,
    testSendCampaign,
    fetchCampaignPrecheck,
    fetchCampaignAnalytics,
    fetchCampaignRecipients,
    archiveCampaign,
    cancelCampaign,
    fetchPendingApprovals,
    submitCampaignForReview,
    approveCampaign,
    rejectCampaign,
    fetchCampaignAbResults,
    selectCampaignAbWinner
  };
}

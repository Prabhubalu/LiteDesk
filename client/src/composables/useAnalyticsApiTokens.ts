import { ref } from 'vue';
import apiClient from '@/utils/apiClient';

export interface AnalyticsApiTokenRecord {
  _id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  allowedReportIds: string[];
  actorUserId: string;
  status: 'active' | 'revoked';
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useAnalyticsApiTokens() {
  const tokens = ref<AnalyticsApiTokenRecord[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const createdToken = ref<string | null>(null);

  async function fetchTokens() {
    loading.value = true;
    try {
      const response = await apiClient.get('/analytics/api-tokens', { cache: 'no-store' });
      if (response?.success) {
        tokens.value = response.data ?? [];
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createToken(payload: {
    name: string;
    scopes?: string[];
    allowedReportIds?: string[];
  }) {
    saving.value = true;
    createdToken.value = null;
    try {
      const response = await apiClient.post('/analytics/api-tokens', payload);
      if (response?.success) {
        createdToken.value = response.token ?? null;
        await fetchTokens();
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function revokeToken(id: string) {
    saving.value = true;
    try {
      const response = await apiClient.post(`/analytics/api-tokens/${id}/revoke`, {});
      if (response?.success) {
        await fetchTokens();
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  function clearCreatedToken() {
    createdToken.value = null;
  }

  return {
    tokens,
    loading,
    saving,
    createdToken,
    fetchTokens,
    createToken,
    revokeToken,
    clearCreatedToken,
  };
}

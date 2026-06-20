import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

export function useRecordDocuments() {
  async function fetchRecordDocuments(moduleKey, recordId, appKey = '') {
    const params = new URLSearchParams();
    if (appKey) params.set('appKey', appKey);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get(`/modules/${moduleKey}/records/${recordId}/documents${qs}`);
    if (response.success) {
      return response.data || [];
    }
    throw new Error(response.message || 'Failed to load documents');
  }

  async function uploadAndAttach(file, { moduleKey, recordId, appKey, title } = {}) {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (moduleKey) formData.append('linkModuleKey', moduleKey);
    if (recordId) formData.append('linkRecordId', recordId);
    if (appKey) formData.append('linkAppKey', appKey);

    const token = useAuthStore().user?.token;
    const response = await fetch(getApiUrlForFetch('/api/documents/upload'), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    return response.json();
  }

  async function linkDocument(documentId, { moduleKey, recordId, appKey } = {}) {
    return apiClient.post(`/documents/${documentId}/link`, {
      moduleKey,
      recordId,
      appKey: appKey || undefined
    });
  }

  async function unlinkDocument(documentId, relationshipId) {
    return apiClient.delete(`/documents/${documentId}/link/${relationshipId}`);
  }

  return {
    fetchRecordDocuments,
    uploadAndAttach,
    linkDocument,
    unlinkDocument
  };
}

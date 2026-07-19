import portalApiClient from '@/utils/portalApiClient';

export function usePortalDocuments() {
  async function listDocuments({ page = 1, limit = 25, search = '' } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search) params.set('search', search);
    return portalApiClient(`/documents?${params.toString()}`);
  }

  async function getDocument(id) {
    return portalApiClient(`/documents/${id}`);
  }

  async function downloadDocument(id) {
    return portalApiClient(`/documents/${id}/download`);
  }

  return {
    listDocuments,
    getDocument,
    downloadDocument
  };
}

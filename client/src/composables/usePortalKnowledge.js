import portalApiClient from '@/utils/portalApiClient';

export function usePortalKnowledge() {
  async function listArticles({ page = 1, limit = 25, search = '' } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search) params.set('search', search);
    return portalApiClient(`/knowledge-base?${params.toString()}`);
  }

  async function getArticle(id) {
    return portalApiClient(`/knowledge-base/${id}`);
  }

  return {
    listArticles,
    getArticle
  };
}

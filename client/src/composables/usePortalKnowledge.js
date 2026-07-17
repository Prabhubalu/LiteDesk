import portalApiClient from '@/utils/portalApiClient';

export function usePortalKnowledge() {
  async function listArticles({ page = 1, limit = 25, search = '', collectionId = null } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search) params.set('search', search);
    if (collectionId) params.set('collectionId', String(collectionId));
    return portalApiClient(`/knowledge-base?${params.toString()}`);
  }

  async function listCollections() {
    return portalApiClient('/knowledge-base/collections');
  }

  async function getArticle(id) {
    return portalApiClient(`/knowledge-base/${id}`);
  }

  async function ask(question) {
    return portalApiClient.post('/knowledge-base/ask', {
      question: String(question || '').trim(),
    });
  }

  return {
    listArticles,
    listCollections,
    getArticle,
    ask,
  };
}

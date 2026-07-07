import apiClient from '@/utils/apiClient';
import type { ContentStudioMode, ContentStudioDocumentRecord, ProseMirrorJson, ContentStudioPresentation } from '../types/contentStudio';

function apiBaseForMode(mode: ContentStudioMode): string {
  return mode === 'articles' ? '/helpdesk/articles' : '/marketing/blog';
}

export interface ContentStudioListResponse {
  success: boolean;
  items: ContentStudioDocumentRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function listContentDocuments(
  mode: ContentStudioMode,
  params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    collectionId?: string;
    visibility?: string;
  } = {},
): Promise<ContentStudioListResponse> {
  const response = await apiClient.get(apiBaseForMode(mode), {
    params,
    cache: 'no-store',
  });
  return {
    success: Boolean(response?.success),
    items: Array.isArray(response?.items) ? response.items : [],
    pagination: response?.pagination || { page: 1, limit: 25, total: 0, pages: 1 },
  };
}

export async function getContentDocument(mode: ContentStudioMode, id: string) {
  const response = await apiClient.get(`${apiBaseForMode(mode)}/${id}`, { cache: 'no-store' });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to load content');
  }
  return response.data as ContentStudioDocumentRecord;
}

export async function createContentDocument(
  mode: ContentStudioMode,
  payload: {
    title: string;
    slug?: string;
    summary?: string;
    visibility?: string;
    featured?: boolean;
    blocks?: ProseMirrorJson;
    collectionId?: string | null;
  },
) {
  const response = await apiClient.post(apiBaseForMode(mode), payload);
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to create content');
  }
  return response.data as ContentStudioDocumentRecord;
}

export async function updateContentDocument(
  mode: ContentStudioMode,
  id: string,
  payload: {
    title?: string;
    subtitle?: string;
    summary?: string;
    slug?: string;
    visibility?: string;
    featured?: boolean;
    blocks?: ProseMirrorJson;
    seo?: Record<string, string>;
    collectionId?: string | null;
    coverAssetId?: string | null;
    presentation?: ContentStudioPresentation;
  },
) {
  const response = await apiClient.patch(`${apiBaseForMode(mode)}/${id}`, payload);
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to save content');
  }
  return response.data as ContentStudioDocumentRecord;
}

export async function publishContentDocument(mode: ContentStudioMode, id: string) {
  const response = await apiClient.post(`${apiBaseForMode(mode)}/${id}/publish`);
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to publish content');
  }
  return response.data as ContentStudioDocumentRecord;
}

export async function fetchBlockRegistry() {
  const response = await apiClient.get('/content-studio/block-registry', { cache: 'no-store' });
  return Array.isArray(response?.blocks) ? response.blocks : [];
}

export async function renderContentPreview(payload: {
  title?: string;
  subtitle?: string;
  blocks?: ProseMirrorJson;
  bodyOnly?: boolean;
}): Promise<string> {
  const response = await apiClient.post('/content-studio/render-preview', {
    ...payload,
    bodyOnly: payload.bodyOnly ?? true,
  });
  if (!response?.success || typeof response.html !== 'string') {
    throw new Error(response?.message || 'Failed to render preview');
  }
  return response.html;
}

export async function unpublishContentDocument(mode: ContentStudioMode, id: string) {
  const response = await apiClient.post(`${apiBaseForMode(mode)}/${id}/unpublish`);
  if (!response?.success) throw new Error(response?.message || 'Failed to unpublish content');
  return response.data as ContentStudioDocumentRecord;
}

export async function archiveContentDocument(mode: ContentStudioMode, id: string) {
  const response = await apiClient.post(`${apiBaseForMode(mode)}/${id}/archive`);
  if (!response?.success) throw new Error(response?.message || 'Failed to archive content');
  return response.data as ContentStudioDocumentRecord;
}

export async function deleteContentDocument(mode: ContentStudioMode, id: string) {
  const response = await apiClient.delete(`${apiBaseForMode(mode)}/${id}`);
  if (!response?.success) throw new Error(response?.message || 'Failed to delete content');
  return response.data;
}

export async function searchArticlesForAgent(query: string, limit = 8) {
  const response = await apiClient.get('/helpdesk/articles/search', {
    params: { q: query, limit },
    cache: 'no-store',
  });
  return Array.isArray(response?.data) ? response.data : [];
}

export interface ContentCollectionRecord {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  emoji?: string;
  parentId?: string | null;
  sortOrder?: number;
}

export async function listArticleCollections(): Promise<ContentCollectionRecord[]> {
  const response = await apiClient.get('/helpdesk/articles/collections', { cache: 'no-store' });
  return Array.isArray(response?.data) ? response.data : [];
}

export async function createArticleCollection(payload: {
  name: string;
  slug?: string;
  description?: string;
  emoji?: string;
  parentId?: string | null;
}) {
  const response = await apiClient.post('/helpdesk/articles/collections', payload);
  if (!response?.success) throw new Error(response?.message || 'Failed to create collection');
  return response.data as ContentCollectionRecord;
}

export interface ArticleAnalyticsRecord {
  helpfulYes: number;
  helpfulNo: number;
  helpfulTotal: number;
  helpfulRate: number;
  sharesFacebook: number;
  sharesX: number;
  sharesLinkedin: number;
  sharesTotal: number;
  lastFeedbackAt?: string | null;
}

export async function getArticleAnalytics(articleId: string): Promise<ArticleAnalyticsRecord> {
  const response = await apiClient.get(`/helpdesk/articles/${articleId}/analytics`, { cache: 'no-store' });
  if (!response?.success) {
    throw new Error(response?.message || 'Failed to load article analytics');
  }
  return response.data as ArticleAnalyticsRecord;
}

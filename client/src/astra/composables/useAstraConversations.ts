import { ref } from 'vue';
import apiClient from '@/utils/apiClient';

export type AstraConversationSummary = {
  id: string;
  title: string;
  preview?: string;
  messageCount?: number;
  updatedAt?: string | null;
  createdAt?: string | null;
};

export type AstraConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  blocks?: unknown[];
  proposals?: unknown[];
  suggestions?: string[];
  navigate?: { href?: string; label?: string; recordId?: string } | null;
  createdAt?: number | null;
};

export type AstraConversationDetail = AstraConversationSummary & {
  messages: AstraConversationMessage[];
};

const PAGE_SIZE = 40;

export function useAstraConversations() {
  const conversations = ref<AstraConversationSummary[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(false);
  const nextCursor = ref<string | null>(null);
  const error = ref('');

  async function fetchPage(cursor: string | null) {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    if (cursor) params.set('cursor', cursor);
    return (await apiClient.get(`/ai/v2/conversations?${params.toString()}`)) as {
      conversations?: AstraConversationSummary[];
      nextCursor?: string | null;
      hasMore?: boolean;
    };
  }

  /** Replace list with the first page. */
  async function refresh() {
    loading.value = true;
    error.value = '';
    try {
      const data = await fetchPage(null);
      conversations.value = Array.isArray(data?.conversations) ? data.conversations : [];
      nextCursor.value = data?.nextCursor || null;
      hasMore.value = Boolean(data?.hasMore && data?.nextCursor);
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number; code?: string };
      // Entitlement/permission races — treat as empty history, not a hard UI error.
      if (e?.status === 403 || e?.status === 404) {
        error.value = '';
      } else {
        error.value = e?.message || 'Failed to load conversations';
      }
      conversations.value = [];
      nextCursor.value = null;
      hasMore.value = false;
    } finally {
      loading.value = false;
    }
  }

  /** Append the next page (infinite scroll). */
  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value || !nextCursor.value) return;
    loadingMore.value = true;
    error.value = '';
    try {
      const data = await fetchPage(nextCursor.value);
      const batch = Array.isArray(data?.conversations) ? data.conversations : [];
      if (batch.length) {
        const seen = new Set(conversations.value.map((c) => c.id));
        const appended = batch.filter((c) => c?.id && !seen.has(c.id));
        conversations.value = [...conversations.value, ...appended];
      }
      nextCursor.value = data?.nextCursor || null;
      hasMore.value = Boolean(data?.hasMore && data?.nextCursor);
    } catch (err: unknown) {
      const e = err as { message?: string };
      error.value = e?.message || 'Failed to load more conversations';
    } finally {
      loadingMore.value = false;
    }
  }

  async function loadOne(conversationId: string): Promise<AstraConversationDetail | null> {
    if (!conversationId) return null;
    try {
      const data = (await apiClient.get(`/ai/v2/conversations/${conversationId}`)) as {
        conversation?: AstraConversationDetail;
      };
      return data?.conversation || null;
    } catch {
      return null;
    }
  }

  async function remove(conversationId: string): Promise<boolean> {
    if (!conversationId) return false;
    try {
      await apiClient.delete(`/ai/v2/conversations/${conversationId}`);
      conversations.value = conversations.value.filter((c) => c.id !== conversationId);
      return true;
    } catch {
      return false;
    }
  }

  /** @param scope 'all' | 'older' — older = before local start of today */
  async function clearAll(scope: 'all' | 'older' = 'all'): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();

    const targets =
      scope === 'all'
        ? [...conversations.value]
        : conversations.value.filter((c) => {
            const raw = c.updatedAt || c.createdAt;
            if (!raw) return true;
            const ts = new Date(raw).getTime();
            return Number.isNaN(ts) || ts < startMs;
          });

    let deleted = 0;
    for (const item of targets) {
      if (await remove(item.id)) deleted += 1;
    }

    try {
      let url = `/ai/v2/conversations?scope=${encodeURIComponent(scope)}`;
      if (scope === 'older') {
        url += `&before=${encodeURIComponent(start.toISOString())}`;
      }
      await apiClient.delete(url);
    } catch {
      /* per-id deletes already applied */
    }

    await refresh();
    return deleted;
  }

  function upsertLocal(summary: AstraConversationSummary) {
    if (!summary?.id) return;
    const rest = conversations.value.filter((c) => c.id !== summary.id);
    conversations.value = [summary, ...rest];
  }

  return {
    conversations,
    loading,
    loadingMore,
    hasMore,
    nextCursor,
    error,
    refresh,
    loadMore,
    loadOne,
    remove,
    clearAll,
    upsertLocal,
  };
}

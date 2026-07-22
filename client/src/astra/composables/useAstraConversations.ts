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

export function useAstraConversations() {
  const conversations = ref<AstraConversationSummary[]>([]);
  const loading = ref(false);
  const error = ref('');

  async function refresh() {
    loading.value = true;
    error.value = '';
    try {
      const data = (await apiClient.get('/ai/v2/conversations')) as {
        conversations?: AstraConversationSummary[];
      };
      conversations.value = Array.isArray(data?.conversations) ? data.conversations : [];
    } catch (err: unknown) {
      const e = err as { message?: string };
      error.value = e?.message || 'Failed to load conversations';
      conversations.value = [];
    } finally {
      loading.value = false;
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

    // Best-effort bulk path (server must expose DELETE /conversations)
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
    error,
    refresh,
    loadOne,
    remove,
    clearAll,
    upsertLocal,
  };
}

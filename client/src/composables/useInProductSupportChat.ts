import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';

export type InAppSupportBootstrap = {
  enabled: boolean;
  publicKey?: string;
  welcomeMessage?: string;
  consentRequired?: boolean;
  consentMessage?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
};

export type InAppChatMessage = {
  _id: string;
  body?: string;
  direction: 'inbound' | 'outbound' | string;
  authorName?: string;
  createdAt?: string;
};

type SessionCache = {
  sessionId: string;
  sessionSecret: string;
};

export type InAppRecentConversation = {
  sessionId: string;
  title: string;
  updatedAt: number;
};

export type InAppSupportSection = 'home' | 'chat' | 'ai' | 'ai-history';

const PANEL_UI_STORAGE_KEY = 'litedesk_arivu_support_panel_ui_v1';

type PanelUiState = {
  open: boolean;
  section: InAppSupportSection;
};

function isSupportSection(value: unknown): value is InAppSupportSection {
  return value === 'home' || value === 'chat' || value === 'ai' || value === 'ai-history';
}

function loadPanelUiState(): PanelUiState | null {
  try {
    const raw = localStorage.getItem(PANEL_UI_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelUiState>;
    if (typeof parsed?.open !== 'boolean') return null;
    return {
      open: parsed.open,
      section: isSupportSection(parsed.section) ? parsed.section : 'home',
    };
  } catch {
    return null;
  }
}

function savePanelUiState(state: PanelUiState) {
  try {
    localStorage.setItem(PANEL_UI_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function buildVisitorFromAuth(authStore: ReturnType<typeof useAuthStore>) {
  const user = authStore.user;
  const org = authStore.organization;
  const firstName = String(user?.firstName || '').trim();
  const lastName = String(user?.lastName || '').trim();
  const username = String(user?.username || '').trim();
  const email = String(user?.email || '').trim();
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ') || username || email || 'User';
  const tenantName = String(org?.name || '').trim();
  const name = tenantName ? `${displayName} (${tenantName})` : displayName;

  return {
    name,
    email,
    externalId: user?._id ? String(user._id) : '',
  };
}

function sessionStorageKey(instanceKey: string, userId: string) {
  return `litedesk_inapp_chat_session:${instanceKey}:${userId}`;
}

function loadSessionCache(instanceKey: string, userId: string): SessionCache | null {
  try {
    const raw = localStorage.getItem(sessionStorageKey(instanceKey, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCache;
    if (parsed?.sessionId && parsed?.sessionSecret) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function saveSessionCache(instanceKey: string, userId: string, cache: SessionCache) {
  try {
    localStorage.setItem(sessionStorageKey(instanceKey, userId), JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function clearSessionCache(instanceKey: string, userId: string) {
  try {
    localStorage.removeItem(sessionStorageKey(instanceKey, userId));
  } catch {
    /* ignore */
  }
}

function recentsStorageKey(userId: string) {
  return `litedesk_inapp_chat_recents:${userId}`;
}

function loadRecents(userId: string): InAppRecentConversation[] {
  try {
    const raw = localStorage.getItem(recentsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InAppRecentConversation[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r?.sessionId && r?.title)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      .slice(0, 8);
  } catch {
    return [];
  }
}

function upsertRecent(userId: string, entry: InAppRecentConversation) {
  const next = [
    entry,
    ...loadRecents(userId).filter((r) => r.sessionId !== entry.sessionId),
  ].slice(0, 8);
  try {
    localStorage.setItem(recentsStorageKey(userId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, message: text?.slice(0, 200) || `HTTP ${res.status}` };
  }
}

/**
 * In-product visitor chat against the tenant Live Chat widget APIs.
 * Identity comes from the authenticated user (no pre-chat form).
 */
export function useInProductSupportChat() {
  const { t } = useI18n();
  const authStore = useAuthStore();

  const bootstrap = ref<InAppSupportBootstrap | null>(null);
  const bootstrapLoading = ref(false);
  const bootstrapError = ref('');

  const storedPanelUi = loadPanelUiState();
  const panelOpen = ref(Boolean(storedPanelUi?.open));
  const activeSection = ref<InAppSupportSection>(
    storedPanelUi?.open && isSupportSection(storedPanelUi.section)
      ? storedPanelUi.section
      : 'home',
  );
  const expanded = ref(false);
  const recentConversations = ref<InAppRecentConversation[]>([]);

  watch(
    [panelOpen, activeSection],
    ([open, section]) => {
      savePanelUiState({
        open: Boolean(open),
        section: isSupportSection(section) ? section : 'home',
      });
    },
  );

  const messages = ref<InAppChatMessage[]>([]);
  const draft = ref('');
  const starting = ref(false);
  const sending = ref(false);
  const sessionClosed = ref(false);
  const chatError = ref('');
  const welcomeMessage = ref('');

  const sessionId = ref('');
  const sessionSecret = ref('');
  const instanceKey = ref('');

  const eventSource = shallowRef<EventSource | null>(null);
  const agentTyping = ref(false);

  const visitor = computed(() => buildVisitorFromAuth(authStore));
  const isAvailable = computed(() => Boolean(bootstrap.value?.enabled && bootstrap.value?.publicKey));
  const greetName = computed(() => {
    const user = authStore.user;
    return (
      String(user?.firstName || '').trim()
      || String(user?.username || '').trim()
      || String(user?.email || '').split('@')[0]
      || ''
    );
  });

  function refreshRecents() {
    const userId = authStore.user?._id ? String(authStore.user._id) : '';
    recentConversations.value = userId ? loadRecents(userId) : [];
  }

  function rememberConversation(titleHint?: string) {
    const userId = authStore.user?._id ? String(authStore.user._id) : '';
    if (!userId || !sessionId.value) return;
    const inbound = messages.value.find((m) => m.direction === 'inbound' && m.body);
    const title = String(titleHint || inbound?.body || t('liveChat.inAppSectionChat')).trim().slice(0, 80);
    recentConversations.value = upsertRecent(userId, {
      sessionId: sessionId.value,
      title: title || t('liveChat.inAppSectionChat'),
      updatedAt: Date.now(),
    });
  }

  async function loadBootstrap() {
    if (!authStore.isAuthenticated || authStore.user?.entitledAddons?.live_chat !== true) {
      bootstrap.value = { enabled: false };
      return;
    }
    bootstrapLoading.value = true;
    bootstrapError.value = '';
    try {
      const res = await apiClient.get('/live-chat/in-app-support');
      bootstrap.value = (res?.data || { enabled: false }) as InAppSupportBootstrap;
      welcomeMessage.value = String(bootstrap.value?.welcomeMessage || '').trim();
      if (bootstrap.value?.publicKey) {
        instanceKey.value = bootstrap.value.publicKey;
      }
    } catch (err: unknown) {
      const status = (err as { status?: number; response?: { status?: number } })?.status
        || (err as { response?: { status?: number } })?.response?.status;
      // Addon not entitled / 403 — hide quietly
      if (status === 403 || status === 404) {
        bootstrap.value = { enabled: false };
      } else {
        bootstrapError.value = t('liveChat.inAppLoadFailed');
        bootstrap.value = { enabled: false };
      }
    } finally {
      bootstrapLoading.value = false;
    }
  }

  function embedUrl(path: string) {
    const key = encodeURIComponent(instanceKey.value);
    const sep = path.includes('?') ? '&' : '?';
    return getApiUrlForFetch(`/embed/chat${path}${sep}instanceKey=${key}`);
  }

  function stopStream() {
    if (eventSource.value) {
      eventSource.value.close();
      eventSource.value = null;
    }
  }

  function startStream() {
    stopStream();
    if (!sessionId.value || !sessionSecret.value || !instanceKey.value) return;

    const after = Date.now();
    // embedUrl already resolves absolute API origin — do not wrap again (doubles host).
    const url = embedUrl(
      `/sessions/${encodeURIComponent(sessionId.value)}/stream?after=${after}&sessionSecret=${encodeURIComponent(sessionSecret.value)}`,
    );

    const es = new EventSource(url);
    eventSource.value = es;

    es.addEventListener('messages', (ev) => {
      try {
        const rows = JSON.parse((ev as MessageEvent).data) as InAppChatMessage[];
        if (!Array.isArray(rows) || !rows.length) return;
        const existing = new Set(messages.value.map((m) => String(m._id)));
        for (const row of rows) {
          if (!existing.has(String(row._id))) {
            messages.value.push(row);
          }
        }
      } catch {
        /* ignore */
      }
    });

    es.addEventListener('session', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { status?: string };
        if (data?.status === 'closed') {
          sessionClosed.value = true;
          stopStream();
        }
      } catch {
        /* ignore */
      }
    });

    es.addEventListener('typing', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          authorType?: string;
          isTyping?: boolean;
        };
        if (data?.authorType === 'agent' || data?.authorType === 'bot') {
          agentTyping.value = Boolean(data.isTyping);
        }
      } catch {
        /* ignore */
      }
    });

    es.onerror = () => {
      // EventSource reconnects automatically; leave open unless closed
    };
  }

  async function ensureSession() {
    const userId = authStore.user?._id ? String(authStore.user._id) : '';
    if (!instanceKey.value || !userId) {
      throw new Error(t('liveChat.inAppIdentityMissing'));
    }

    if (sessionId.value && sessionSecret.value) {
      return;
    }

    const cached = loadSessionCache(instanceKey.value, userId);
    if (cached) {
      sessionId.value = cached.sessionId;
      sessionSecret.value = cached.sessionSecret;
      const check = await fetch(
        embedUrl(`/sessions/${encodeURIComponent(cached.sessionId)}`),
        { headers: { 'X-Chat-Session-Secret': cached.sessionSecret } },
      );
      const checkJson = await readJsonSafe(check);
      const closed = check.ok && checkJson.success
        && String(checkJson.data?.status || '') === 'closed';
      if (check.ok && checkJson.success && !closed) {
        sessionClosed.value = false;
        return;
      }
      clearSessionCache(instanceKey.value, userId);
      sessionId.value = '';
      sessionSecret.value = '';
    }

    const identity = visitor.value;
    const res = await fetch(embedUrl('/sessions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceKey: instanceKey.value,
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        referrerUrl: typeof document !== 'undefined' ? document.referrer : '',
        language: typeof navigator !== 'undefined' ? navigator.language : '',
        visitor: identity,
        consentGiven: true,
      }),
    });
    const json = await readJsonSafe(res);
    if (!json.success || !json.data?.sessionId || !json.data?.sessionSecret) {
      throw new Error(json.message || t('liveChat.inAppStartFailed'));
    }
    sessionId.value = String(json.data.sessionId);
    sessionSecret.value = String(json.data.sessionSecret);
    sessionClosed.value = false;
    saveSessionCache(instanceKey.value, userId, {
      sessionId: sessionId.value,
      sessionSecret: sessionSecret.value,
    });
  }

  async function loadHistory() {
    if (!sessionId.value || !sessionSecret.value) return;
    const res = await fetch(
      embedUrl(`/sessions/${encodeURIComponent(sessionId.value)}/messages`),
      { headers: { 'X-Chat-Session-Secret': sessionSecret.value } },
    );
    const json = await readJsonSafe(res);
    if (json.success && Array.isArray(json.data)) {
      messages.value = json.data as InAppChatMessage[];
    }
  }

  async function openPanel() {
    panelOpen.value = true;
    activeSection.value = 'home';
    chatError.value = '';
    refreshRecents();
  }

  async function openChat(options?: { draft?: string; ensure?: boolean }) {
    activeSection.value = 'chat';
    chatError.value = '';
    if (options?.draft) {
      draft.value = options.draft;
    }
    if (!isAvailable.value) return;
    if (options?.ensure === false && sessionId.value) {
      if (!sessionClosed.value) startStream();
      return;
    }
    starting.value = true;
    try {
      await ensureSession();
      await loadHistory();
      if (!sessionClosed.value) startStream();
      if (messages.value.length) rememberConversation();
    } catch (err: unknown) {
      chatError.value = err instanceof Error ? err.message : t('liveChat.inAppStartFailed');
    } finally {
      starting.value = false;
    }
  }

  function goHome() {
    stopStream();
    activeSection.value = 'home';
    refreshRecents();
  }

  function openAiAsk(options?: { draft?: string }) {
    stopStream();
    panelOpen.value = true;
    activeSection.value = 'ai';
    if (options?.draft) {
      draft.value = options.draft;
    }
  }

  function openAiThread(options?: { draft?: string }) {
    stopStream();
    panelOpen.value = true;
    activeSection.value = 'ai';
    if (options?.draft) {
      draft.value = options.draft;
    }
  }

  function openAiHistory() {
    stopStream();
    panelOpen.value = true;
    activeSection.value = 'ai-history';
  }

  function closePanel() {
    panelOpen.value = false;
    stopStream();
    activeSection.value = 'home';
  }

  function toggleExpanded() {
    expanded.value = !expanded.value;
  }

  async function sendMessage() {
    const body = draft.value.trim();
    if (!body || sending.value || sessionClosed.value) return;
    sending.value = true;
    chatError.value = '';
    try {
      await ensureSession();
      const res = await fetch(
        embedUrl(`/sessions/${encodeURIComponent(sessionId.value)}/messages`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Chat-Session-Secret': sessionSecret.value,
          },
          body: JSON.stringify({
            body,
            authorName: visitor.value.name,
          }),
        },
      );
      const json = await readJsonSafe(res);
      if (!json.success) {
        throw new Error(json.message || t('liveChat.sendFailed'));
      }
      draft.value = '';
      const row = json.data as InAppChatMessage | undefined;
      if (row?._id && !messages.value.some((m) => String(m._id) === String(row._id))) {
        messages.value.push(row);
      }
      rememberConversation(body);
      if (!eventSource.value) startStream();
    } catch (err: unknown) {
      chatError.value = err instanceof Error ? err.message : t('liveChat.sendFailed');
    } finally {
      sending.value = false;
    }
  }

  async function endSession() {
    if (!sessionId.value || !sessionSecret.value) return;
    try {
      await fetch(
        embedUrl(`/sessions/${encodeURIComponent(sessionId.value)}/close`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Chat-Session-Secret': sessionSecret.value,
          },
          body: JSON.stringify({}),
        },
      );
    } catch {
      /* ignore */
    }
    const userId = authStore.user?._id ? String(authStore.user._id) : '';
    if (userId && instanceKey.value) {
      clearSessionCache(instanceKey.value, userId);
    }
    sessionClosed.value = true;
    stopStream();
    sessionId.value = '';
    sessionSecret.value = '';
  }

  onBeforeUnmount(() => {
    stopStream();
  });

  return {
    bootstrap,
    bootstrapLoading,
    bootstrapError,
    isAvailable,
    panelOpen,
    activeSection,
    expanded,
    recentConversations,
    messages,
    draft,
    starting,
    sending,
    sessionClosed,
    chatError,
    welcomeMessage,
    visitor,
    greetName,
    agentTyping,
    loadBootstrap,
    openPanel,
    openChat,
    openAiAsk,
    openAiThread,
    openAiHistory,
    goHome,
    closePanel,
    toggleExpanded,
    sendMessage,
    endSession,
  };
}

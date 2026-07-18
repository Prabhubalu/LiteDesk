import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { resolvePageAiContext, type PageAiContext } from '@/utils/resolvePageAiContext';
import { submitAiFeedback, trackAiAbilityUsed } from '@/utils/aiFeedback';
import { captureAiProviderError } from '@/config/posthogAi';
import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';

export type InAppAiCitation = {
  index?: number;
  sourceType?: string;
  sourceId?: string;
  excerpt?: string;
  score?: number;
  chunkId?: string;
};

export type InAppAiAction = {
  label: string;
  kind: 'send_email' | 'complete_task' | 'follow_up' | 'review_record' | 'update_status' | 'talk_to_agent' | 'manual' | 'open_record' | 'none' | 'create_record' | 'update_record';
  moduleKey?: string;
  recordId?: string;
  targetLabel?: string;
  rationale?: string;
  priority?: 'high' | 'medium' | 'low';
  fields?: Record<string, string | number | boolean>;
  applied?: boolean;
  executeNow?: boolean;
  email?: {
    to?: string;
    subject?: string;
    body?: string;
  };
};

export type InAppAiVisual = {
  id?: string;
  component: 'chart' | 'kpi_strip' | 'data_table' | 'callout' | 'progress_list';
  chartType?: 'pie' | 'bar' | 'line';
  title?: string;
  metricLabel?: string;
  points?: Array<{ label: string; value: number }>;
  items?: Array<{ label: string; value: string | number; hint?: string; max?: number }>;
  columns?: string[];
  rows?: Array<Array<string | number>>;
  tone?: 'insight' | 'success' | 'warning' | 'danger';
  body?: string;
};

export type InAppAiStructured = {
  headline?: string;
  bullets?: string[];
  clarifyingQuestions?: string[];
  detail?: string;
  actions?: InAppAiAction[];
  visuals?: InAppAiVisual[];
  talkToAgent?: boolean;
};

export type InAppAiMessage = {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  structured?: InAppAiStructured | null;
  citations?: InAppAiCitation[];
  source?: 'graph' | 'knowledge' | 'page' | 'agent' | '';
  meta?: {
    provider?: string;
    model?: string;
    keyMode?: string;
    found?: boolean;
    abilityKey?: string;
    agentId?: string;
    agentName?: string;
    agentAutoCreated?: boolean;
  };
  createdAt?: number;
};

export type InAppAiConversation = {
  id: string;
  title: string;
  messages: InAppAiMessage[];
  createdAt: number;
  updatedAt: number;
  contextLabel?: string;
  moduleKey?: string;
  recordId?: string;
  messageCount?: number;
};

const MAX_AI_CONVERSATIONS = 30;
const MAX_AI_MESSAGES = 120;

function aiConversationsStorageKey(orgId: string, userId: string) {
  return `litedesk_inapp_ai_conversations_v1:${orgId}:${userId}`;
}

function aiActiveConversationKey(orgId: string, userId: string) {
  return `litedesk_inapp_ai_active_v1:${orgId}:${userId}`;
}

function titleFromMessages(messages: InAppAiMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user' && String(m.body || '').trim());
  const text = String(firstUser?.body || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'New conversation';
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function isMongoId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(String(id || '').trim());
}

function readActiveId(orgId: string, userId: string): string | null {
  try {
    const v = localStorage.getItem(aiActiveConversationKey(orgId, userId));
    return v && isMongoId(v) ? v : null;
  } catch {
    return null;
  }
}

function writeActiveId(orgId: string, userId: string, id: string | null) {
  try {
    const key = aiActiveConversationKey(orgId, userId);
    if (id && isMongoId(id)) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function loadLegacyLocalConversations(orgId: string, userId: string): InAppAiConversation[] {
  try {
    const raw = localStorage.getItem(aiConversationsStorageKey(orgId, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { conversations?: InAppAiConversation[] };
    return Array.isArray(parsed?.conversations)
      ? parsed.conversations
        .filter((c) => c?.id && Array.isArray(c.messages) && (c.messages || []).some((m) => m.role === 'user'))
        .slice(0, MAX_AI_CONVERSATIONS)
      : [];
  } catch {
    return [];
  }
}

function clearLegacyLocalConversations(orgId: string, userId: string) {
  try {
    localStorage.removeItem(aiConversationsStorageKey(orgId, userId));
  } catch {
    /* ignore */
  }
}

function mapApiConversation(raw: Record<string, unknown>): InAppAiConversation {
  const messages = Array.isArray(raw.messages)
    ? (raw.messages as InAppAiMessage[]).slice(-MAX_AI_MESSAGES)
    : [];
  const messageCount = Number(raw.messageCount);
  return {
    id: String(raw.id || ''),
    title: String(raw.title || 'Conversation'),
    messages,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    contextLabel: raw.contextLabel ? String(raw.contextLabel) : undefined,
    moduleKey: raw.moduleKey ? String(raw.moduleKey) : undefined,
    recordId: raw.recordId ? String(raw.recordId) : undefined,
    messageCount: Number.isFinite(messageCount)
      ? messageCount
      : messages.length,
  };
}

function conversationHasUserContent(c: InAppAiConversation): boolean {
  if ((c.messages || []).some((m) => m.role === 'user')) return true;
  return Number(c.messageCount || 0) > 0;
}

type ListPageFacts = {
  moduleKey: string;
  totalRecords: number;
  statistics: Record<string, number>;
  endpoint: string;
};

function looksInsufficient(answer: string): boolean {
  const text = String(answer || '').toLowerCase();
  return (
    text.includes('insufficient')
    || text.includes('could not find')
    || text.includes("couldn't find")
    || text.includes('no answer was found')
    || text.includes('not enough context')
    || text.includes('insufficient_page_context')
  );
}

function isThinAgentResponse(
  answer: string,
  structured: {
    headline?: string;
    bullets?: string[];
    detail?: string;
    actions?: unknown[];
    visuals?: unknown[];
  } | null,
  agentName: string,
): boolean {
  if ((structured?.bullets || []).length > 0 || (structured?.actions || []).length > 0) {
    return false;
  }
  if ((structured?.visuals || []).length > 0) return false;
  if (String(structured?.detail || '').trim().length >= 80) return false;
  const headline = String(structured?.headline || '').trim().toLowerCase();
  const name = String(agentName || '').trim().toLowerCase();
  const normalizedAnswer = String(answer || '').trim().toLowerCase();
  // Echoing the agent name / title-only is not a real answer.
  if (headline && name && headline === name) return true;
  if (!normalizedAnswer) return true;
  if (normalizedAnswer === name) return true;
  // Unparsed / truncated JSON dumped into body — treat as thin so we don't show raw JSON.
  if (/^\s*[\{\[]/.test(normalizedAnswer) && !(structured?.bullets || []).length) return true;
  if (headline && normalizedAnswer === headline && normalizedAnswer.length < 48) return true;
  return normalizedAnswer.length < 24;
}

type TenantAgentTryResult = {
  /** Server routed/ran a specialist (LLM may have already been billed). */
  matched: boolean;
  message: InAppAiMessage | null;
};

function looksLikeCountQuestion(question: string): boolean {
  const q = String(question || '').toLowerCase();
  return (
    /\bhow many\b/.test(q)
    || /\bcount\b/.test(q)
    || /\btotal\b/.test(q)
    || /\bnumber of\b/.test(q)
    || /\bin this page\b/.test(q)
    || /\bon this page\b/.test(q)
    || /\bhow much\b/.test(q)
  );
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function reportAiProviderError(err: unknown, abilityKey: string) {
  const data = (err as { response?: { data?: { code?: string } } })?.response?.data;
  const code = String(
    (err as { code?: string })?.code
    || data?.code
    || '',
  ).trim() || null;
  captureAiProviderError({ abilityKey, code });
}

function moduleLabel(moduleKey: string): string {
  const labels: Record<string, string> = {
    people: 'people (contacts)',
    organizations: 'organizations',
    deals: 'deals',
    tasks: 'tasks',
    events: 'events',
    cases: 'cases',
    items: 'items',
    quotes: 'quotes',
  };
  return labels[moduleKey] || moduleKey;
}

async function fetchListPageFacts(page: PageAiContext): Promise<ListPageFacts | null> {
  const cfg = getModuleListConfig(page.moduleKey);
  const endpoint = String(cfg?.apiEndpoint || `/${page.moduleKey}`).trim();
  if (!endpoint) return null;

  const response = await apiClient.get(endpoint, {
    params: {
      page: 1,
      limit: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },
    cache: 'no-store',
  });

  const totalRecords = Number(
    response?.pagination?.totalRecords
    ?? response?.meta?.totalRecords
    ?? response?.meta?.total
    ?? 0,
  );

  const statistics: Record<string, number> = {};
  const listStats = response?.listStatistics && typeof response.listStatistics === 'object'
    ? response.listStatistics
    : null;
  const stats = response?.statistics && typeof response.statistics === 'object'
    ? response.statistics
    : null;
  const source = listStats || stats || {};
  for (const [key, value] of Object.entries(source)) {
    const n = Number(value);
    if (Number.isFinite(n)) statistics[key] = n;
  }

  return {
    moduleKey: page.moduleKey,
    totalRecords: Number.isFinite(totalRecords) ? totalRecords : 0,
    statistics,
    endpoint,
  };
}

function answerFromListFacts(question: string, facts: ListPageFacts, t: (key: string, vals?: Record<string, unknown>) => string): string {
  const label = moduleLabel(facts.moduleKey);
  if (looksLikeCountQuestion(question)) {
    return t('liveChat.inAppAiPageCountAnswer', {
      count: facts.totalRecords,
      module: label,
    });
  }
  const statLines = Object.entries(facts.statistics)
    .slice(0, 8)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  return t('liveChat.inAppAiPageStatsAnswer', {
    count: facts.totalRecords,
    module: label,
    stats: statLines || '—',
  });
}

/**
 * Page-aware Ask for Astra (router → specialist Agents):
 * 1) record page → work-graph
 * 2) list page → page stats (counts) / page-context echo
 * 3) knowledge Ask when beyond page context
 */
export function useInProductAiAsk() {
  const { t } = useI18n();
  const route = useRoute();
  const authStore = useAuthStore();

  const aiMessages = ref<InAppAiMessage[]>([]);
  const aiAsking = ref(false);
  const aiError = ref('');
  const lastAbilityKey = ref('');
  const cachedAgents = ref<Array<{
    _id: string;
    name: string;
    enabled?: boolean;
    description?: string;
    triggerPhrases?: string[];
    moduleKeys?: string[];
  }>>([]);
  const agentsLoaded = ref(false);
  const activeConversationId = ref<string | null>(null);
  const aiConversations = ref<InAppAiConversation[]>([]);
  const typingMessageId = ref<string | null>(null);
  const typedHeadlineLen = ref(0);
  const typedBodyLen = ref(0);
  const typedDetailLen = ref(0);
  const typedBulletLens = ref<number[]>([]);
  const revealedBulletCount = ref(0);
  const revealedQuestionCount = ref(0);
  const visualsRevealed = ref(true);
  const actionsRevealed = ref(true);
  const typingProgress = ref(0);
  let hydrated = false;
  let hydratePromise: Promise<void> | null = null;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let persistSeq = 0;
  let typingGen = 0;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelAssistantTyping() {
    typingGen += 1;
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    typingMessageId.value = null;
    typedHeadlineLen.value = 0;
    typedBodyLen.value = 0;
    typedDetailLen.value = 0;
    typedBulletLens.value = [];
    revealedBulletCount.value = 0;
    revealedQuestionCount.value = 0;
    visualsRevealed.value = true;
    actionsRevealed.value = true;
  }

  function waitTyping(ms: number, gen: number): Promise<void> {
    return new Promise((resolve) => {
      typingTimer = setTimeout(() => {
        typingTimer = null;
        if (gen === typingGen) resolve();
        else resolve();
      }, ms);
    });
  }

  async function playAssistantTyping(message: InAppAiMessage) {
    const gen = ++typingGen;
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }

    const headline = String(message.structured?.headline || '');
    const body = String(message.body || '');
    const bullets = Array.isArray(message.structured?.bullets) ? message.structured.bullets : [];
    const detail = String(message.structured?.detail || '').trim();
    const questions = Array.isArray(message.structured?.clarifyingQuestions)
      ? message.structured.clarifyingQuestions
      : [];
    const hasActions = Array.isArray(message.structured?.actions) && message.structured.actions.length > 0;
    const hasVisuals = Array.isArray(message.structured?.visuals) && message.structured.visuals.length > 0;
    const showBody = Boolean(body) && (!headline || body !== headline);

    typingMessageId.value = message.id;
    typedHeadlineLen.value = 0;
    typedBodyLen.value = 0;
    typedDetailLen.value = 0;
    typedBulletLens.value = bullets.map(() => 0);
    revealedBulletCount.value = 0;
    revealedQuestionCount.value = 0;
    visualsRevealed.value = !hasVisuals;
    actionsRevealed.value = !hasActions;

    const typeText = async (full: string, setter: (n: number) => void) => {
      if (!full) {
        setter(0);
        return;
      }
      const durationMs = Math.min(4200, Math.max(700, full.length * 16));
      const stepMs = 20;
      const steps = Math.max(1, Math.ceil(durationMs / stepMs));
      const charsPerStep = Math.max(1, Math.ceil(full.length / steps));
      for (let i = charsPerStep; i < full.length; i += charsPerStep) {
        if (gen !== typingGen) return;
        setter(Math.min(i, full.length));
        typingProgress.value += 1;
        await waitTyping(stepMs, gen);
      }
      if (gen !== typingGen) return;
      setter(full.length);
      typingProgress.value += 1;
    };

    await typeText(headline, (n) => { typedHeadlineLen.value = n; });
    if (gen !== typingGen) return;
    await waitTyping(180, gen);
    if (gen !== typingGen) return;

    if (showBody) {
      await typeText(body, (n) => { typedBodyLen.value = n; });
      if (gen !== typingGen) return;
      await waitTyping(140, gen);
      if (gen !== typingGen) return;
    } else {
      typedBodyLen.value = body.length;
    }

    for (let i = 0; i < bullets.length; i += 1) {
      if (gen !== typingGen) return;
      revealedBulletCount.value = i + 1;
      const bullet = String(bullets[i] || '');
      await typeText(bullet, (n) => {
        const next = typedBulletLens.value.slice();
        next[i] = n;
        typedBulletLens.value = next;
      });
      if (gen !== typingGen) return;
      await waitTyping(120, gen);
      if (gen !== typingGen) return;
    }

    if (detail) {
      await typeText(detail, (n) => { typedDetailLen.value = n; });
      if (gen !== typingGen) return;
      await waitTyping(140, gen);
      if (gen !== typingGen) return;
    }

    for (let i = 0; i < questions.length; i += 1) {
      if (gen !== typingGen) return;
      revealedQuestionCount.value = i + 1;
      typingProgress.value += 1;
      await waitTyping(160, gen);
    }

    if (gen !== typingGen) return;
    visualsRevealed.value = true;
    typingProgress.value += 1;
    await waitTyping(120, gen);
    if (gen !== typingGen) return;
    actionsRevealed.value = true;
    typingMessageId.value = null;
  }

  function isAssistantTyping(messageId: string): boolean {
    return typingMessageId.value === messageId;
  }

  function displayHeadline(msg: InAppAiMessage): string {
    const full = String(msg.structured?.headline || '');
    if (!isAssistantTyping(msg.id)) return full;
    return full.slice(0, typedHeadlineLen.value);
  }

  function displayBody(msg: InAppAiMessage): string {
    const full = String(msg.body || '');
    if (!isAssistantTyping(msg.id)) return full;
    return full.slice(0, typedBodyLen.value);
  }

  function displayBullets(msg: InAppAiMessage): string[] {
    const full = Array.isArray(msg.structured?.bullets) ? msg.structured.bullets : [];
    if (!isAssistantTyping(msg.id)) return full;
    return full.slice(0, revealedBulletCount.value).map((bullet, idx) => {
      const len = typedBulletLens.value[idx];
      if (typeof len !== 'number') return String(bullet || '');
      return String(bullet || '').slice(0, len);
    });
  }

  function displayDetail(msg: InAppAiMessage): string {
    const full = String(msg.structured?.detail || '').trim();
    if (!full) return '';
    if (!isAssistantTyping(msg.id)) return full;
    const bullets = Array.isArray(msg.structured?.bullets) ? msg.structured.bullets : [];
    if (revealedBulletCount.value < bullets.length) return '';
    return full.slice(0, typedDetailLen.value);
  }

  function displayVisuals(msg: InAppAiMessage): InAppAiVisual[] {
    const full = Array.isArray(msg.structured?.visuals) ? msg.structured.visuals : [];
    if (!isAssistantTyping(msg.id)) return full;
    return visualsRevealed.value ? full : [];
  }

  function displayClarifyingQuestions(msg: InAppAiMessage): string[] {
    const full = Array.isArray(msg.structured?.clarifyingQuestions)
      ? msg.structured.clarifyingQuestions
      : [];
    if (!isAssistantTyping(msg.id)) return full;
    const bullets = Array.isArray(msg.structured?.bullets) ? msg.structured.bullets : [];
    if (revealedBulletCount.value < bullets.length) return [];
    const detail = String(msg.structured?.detail || '').trim();
    if (detail && typedDetailLen.value < detail.length) return [];
    return full.slice(0, revealedQuestionCount.value);
  }

  function displayActions(msg: InAppAiMessage): InAppAiAction[] {
    const full = Array.isArray(msg.structured?.actions) ? msg.structured.actions : [];
    if (!isAssistantTyping(msg.id)) return full;
    return actionsRevealed.value ? full : [];
  }

  function showTypingCaret(msg: InAppAiMessage): boolean {
    return isAssistantTyping(msg.id);
  }

  function identity() {
    const userId = authStore.user?._id ? String(authStore.user._id) : '';
    const orgId = authStore.organization?._id
      ? String(authStore.organization._id)
      : (authStore.user?.organizationId ? String(authStore.user.organizationId) : '');
    return { userId, orgId };
  }

  function rememberActiveId(id: string | null) {
    const { userId, orgId } = identity();
    if (!userId || !orgId) return;
    writeActiveId(orgId, userId, id);
  }

  function applyConversationToList(entry: InAppAiConversation) {
    aiConversations.value = [
      entry,
      ...aiConversations.value.filter((c) => c.id !== entry.id),
    ].slice(0, MAX_AI_CONVERSATIONS);
  }

  async function persistConversationNow(entry: InAppAiConversation): Promise<InAppAiConversation | null> {
    const seq = ++persistSeq;
    try {
      if (entry.id && isMongoId(entry.id)) {
        const data = await apiClient.put(`/ai/conversations/${encodeURIComponent(entry.id)}`, {
          title: entry.title,
          messages: entry.messages.slice(-MAX_AI_MESSAGES),
          moduleKey: entry.moduleKey || '',
          recordId: entry.recordId || '',
          contextLabel: entry.contextLabel || '',
        });
        if (seq !== persistSeq) return null;
        const saved = mapApiConversation(data?.conversation || entry);
        applyConversationToList(saved);
        return saved;
      }
      const data = await apiClient.post('/ai/conversations', {
        title: entry.title,
        messages: entry.messages.slice(-MAX_AI_MESSAGES),
        moduleKey: entry.moduleKey || '',
        recordId: entry.recordId || '',
        contextLabel: entry.contextLabel || '',
      });
      if (seq !== persistSeq) return null;
      const saved = mapApiConversation(data?.conversation || {});
      if (activeConversationId.value === entry.id || !activeConversationId.value) {
        activeConversationId.value = saved.id;
        rememberActiveId(saved.id);
      }
      applyConversationToList(saved);
      return saved;
    } catch {
      return null;
    }
  }

  function schedulePersist(entry: InAppAiConversation) {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void persistConversationNow(entry);
    }, 250);
  }

  function upsertActiveConversation(messages: InAppAiMessage[]) {
    const now = Date.now();
    const page = resolvePageAiContext(route);
    const id = activeConversationId.value || '';
    const existing = id ? aiConversations.value.find((c) => c.id === id) : undefined;
    const entry: InAppAiConversation = {
      id: id || `pending_${now}`,
      title: titleFromMessages(messages) || existing?.title || t('liveChat.inAppAiNewConversationTitle'),
      messages: messages.slice(-MAX_AI_MESSAGES),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      contextLabel: existing?.contextLabel,
      moduleKey: page?.moduleKey || existing?.moduleKey,
      recordId: page?.kind === 'record' ? (page.recordId || existing?.recordId) : existing?.recordId,
    };
    if (!activeConversationId.value) {
      activeConversationId.value = entry.id;
    }
    applyConversationToList(entry);
    schedulePersist(entry);
  }

  async function migrateLegacyIfNeeded(orgId: string, userId: string, existingCount: number) {
    if (existingCount > 0) {
      clearLegacyLocalConversations(orgId, userId);
      return;
    }
    const legacy = loadLegacyLocalConversations(orgId, userId);
    if (!legacy.length) return;
    for (const conv of legacy.slice().reverse()) {
      try {
        const data = await apiClient.post('/ai/conversations', {
          title: conv.title,
          messages: (conv.messages || []).slice(-MAX_AI_MESSAGES),
          moduleKey: conv.moduleKey || '',
          recordId: conv.recordId || '',
          contextLabel: conv.contextLabel || '',
        });
        const saved = mapApiConversation(data?.conversation || {});
        applyConversationToList(saved);
      } catch {
        /* keep local; retry next session */
        return;
      }
    }
    clearLegacyLocalConversations(orgId, userId);
  }

  async function hydrateFromApi() {
    const { userId, orgId } = identity();
    if (!userId || !orgId) {
      aiConversations.value = [];
      activeConversationId.value = null;
      aiMessages.value = [];
      hydrated = false;
      return;
    }
    try {
      const data = await apiClient.get('/ai/conversations');
      let list = Array.isArray(data?.conversations)
        ? (data.conversations as Record<string, unknown>[]).map((c) => mapApiConversation(c))
        : [];
      await migrateLegacyIfNeeded(orgId, userId, list.length);
      if (!list.length && aiConversations.value.length) {
        list = [...aiConversations.value];
      } else if (!list.length) {
        const refresh = await apiClient.get('/ai/conversations');
        list = Array.isArray(refresh?.conversations)
          ? (refresh.conversations as Record<string, unknown>[]).map((c) => mapApiConversation(c))
          : [];
      }
      aiConversations.value = list.slice(0, MAX_AI_CONVERSATIONS);

      const preferred = readActiveId(orgId, userId);
      let activeId = preferred && list.some((c) => c.id === preferred)
        ? preferred
        : (list[0]?.id || null);

      if (activeId) {
        const full = await apiClient.get(`/ai/conversations/${encodeURIComponent(activeId)}`);
        const conv = mapApiConversation(full?.conversation || { id: activeId });
        applyConversationToList(conv);
        activeConversationId.value = conv.id;
        aiMessages.value = [...(conv.messages || [])];
        rememberActiveId(conv.id);
      } else {
        activeConversationId.value = null;
        aiMessages.value = [];
        rememberActiveId(null);
      }
      hydrated = true;
    } catch {
      // Offline / AI not entitled — fall back to empty (do not wipe legacy yet)
      const legacy = loadLegacyLocalConversations(orgId, userId);
      if (legacy.length) {
        aiConversations.value = legacy;
        const preferred = readActiveId(orgId, userId);
        const active = legacy.find((c) => c.id === preferred) || legacy[0];
        activeConversationId.value = active?.id || null;
        aiMessages.value = active?.messages ? [...active.messages] : [];
      } else {
        aiConversations.value = [];
        activeConversationId.value = null;
        aiMessages.value = [];
      }
      hydrated = true;
    }
  }

  function hydrateFromStorage() {
    if (hydratePromise) return;
    hydratePromise = hydrateFromApi().finally(() => {
      hydratePromise = null;
    });
  }

  async function ensureHydrated() {
    if (hydrated) return;
    if (hydratePromise) {
      await hydratePromise;
      return;
    }
    hydratePromise = hydrateFromApi().finally(() => {
      hydratePromise = null;
    });
    await hydratePromise;
  }

  async function startNewConversation() {
    cancelAssistantTyping();
    if (aiMessages.value.length && activeConversationId.value) {
      const existing = aiConversations.value.find((c) => c.id === activeConversationId.value);
      if (existing) {
        await persistConversationNow({
          ...existing,
          messages: aiMessages.value.slice(-MAX_AI_MESSAGES),
          updatedAt: Date.now(),
          title: titleFromMessages(aiMessages.value) || existing.title,
        });
      }
    }
    aiError.value = '';
    lastAbilityKey.value = '';
    const page = resolvePageAiContext(route);
    try {
      const data = await apiClient.post('/ai/conversations', {
        title: t('liveChat.inAppAiNewConversationTitle'),
        messages: [],
        moduleKey: page?.moduleKey || '',
        recordId: page?.kind === 'record' ? (page.recordId || '') : '',
      });
      const created = mapApiConversation(data?.conversation || {});
      activeConversationId.value = created.id;
      aiMessages.value = [];
      applyConversationToList(created);
      rememberActiveId(created.id);
    } catch {
      const now = Date.now();
      const localId = `pending_${now}`;
      activeConversationId.value = localId;
      aiMessages.value = [];
      applyConversationToList({
        id: localId,
        title: t('liveChat.inAppAiNewConversationTitle'),
        messages: [],
        createdAt: now,
        updatedAt: now,
        moduleKey: page?.moduleKey,
        recordId: page?.kind === 'record' ? page.recordId : undefined,
      });
    }
  }

  async function openConversation(conversationId: string) {
    const id = String(conversationId || '').trim();
    if (!id) return false;
    cancelAssistantTyping();
    if (aiMessages.value.length && activeConversationId.value && activeConversationId.value !== id) {
      const existing = aiConversations.value.find((c) => c.id === activeConversationId.value);
      if (existing) {
        void persistConversationNow({
          ...existing,
          messages: aiMessages.value.slice(-MAX_AI_MESSAGES),
          updatedAt: Date.now(),
          title: titleFromMessages(aiMessages.value) || existing.title,
        });
      }
    }
    try {
      if (isMongoId(id)) {
        const data = await apiClient.get(`/ai/conversations/${encodeURIComponent(id)}`);
        const conv = mapApiConversation(data?.conversation || {});
        applyConversationToList(conv);
        activeConversationId.value = conv.id;
        aiMessages.value = [...(conv.messages || [])];
        rememberActiveId(conv.id);
        aiError.value = '';
        lastAbilityKey.value = '';
        return true;
      }
    } catch {
      /* fall through to local list */
    }
    const found = aiConversations.value.find((c) => c.id === id);
    if (!found) return false;
    activeConversationId.value = found.id;
    aiMessages.value = [...(found.messages || [])];
    aiError.value = '';
    lastAbilityKey.value = '';
    rememberActiveId(isMongoId(found.id) ? found.id : null);
    return true;
  }

  /** @deprecated use startNewConversation — kept for existing callers */
  function clearAiConversation() {
    void startNewConversation();
  }

  const recentAiConversations = computed(() =>
    aiConversations.value
      .filter(conversationHasUserContent)
      .slice(0, 12),
  );

  const allAiConversations = computed(() =>
    aiConversations.value
      .filter(conversationHasUserContent)
      .slice()
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)),
  );

  watch(
    () => [authStore.user?._id, authStore.organization?._id, authStore.user?.organizationId],
    () => {
      hydrated = false;
      hydrateFromStorage();
    },
    { immediate: true },
  );

  function looksLikeSummarizeQuestion(question: string): boolean {
  const q = String(question || '').toLowerCase();
  return (
    /\bsummar(y|ize|ise)\b/.test(q)
    || /\bbrief\b/.test(q)
    || /\boverview\b/.test(q)
    || /\bwho is (this|the)\b/.test(q)
  );
}

async function tryRecordGraph(question: string, page: PageAiContext): Promise<InAppAiMessage | null> {
    if (page.kind !== 'record' || !page.recordId) return null;
    try {
      if (looksLikeSummarizeQuestion(question) && page.moduleKey === 'people') {
        try {
          const data = await apiClient.post(`/ai/people/${encodeURIComponent(page.recordId)}/summarize`, {});
          const answer = String(data?.summary || data?.answer || data?.text || '').trim();
          trackAiAbilityUsed({
            abilityKey: 'summarize_people',
            provider: data?.provider,
            model: data?.model,
            found: Boolean(answer),
            keyMode: data?.keyMode,
            tokens: data?.usage?.totalTokens,
          });
          if (answer) {
            return {
              id: nextId('a'),
              role: 'assistant',
              body: answer,
              structured: {
                headline: t('liveChat.inAppAiSummaryHeadline'),
                bullets: answer
                  .split(/\n+/)
                  .map((line) => line.replace(/^[-•*]\s*/, '').trim())
                  .filter(Boolean)
                  .slice(0, 4),
                actions: [],
              },
              source: 'graph',
              meta: {
                provider: data?.provider,
                model: data?.model,
                keyMode: data?.keyMode,
                found: true,
                abilityKey: 'summarize_people',
              },
            };
          }
        } catch (err: unknown) {
          reportAiProviderError(err, 'summarize_people');
        }
      }

      const data = await apiClient.post('/ai/ask-graph', {
        question,
        moduleKey: page.moduleKey,
        recordId: page.recordId,
        appKey: page.appKey,
      });
      const answer = String(data?.answer || '').trim();
      const found = Boolean(data?.found);
      trackAiAbilityUsed({
        abilityKey: 'work_graph_ask',
        provider: data?.provider,
        model: data?.model,
        found: data?.found,
        keyMode: data?.keyMode,
        tokens: data?.usage?.totalTokens,
      });
      if (!answer) return null;
      const insufficient = looksInsufficient(answer);
      const structured = data?.structured && typeof data.structured === 'object'
        ? {
          headline: String(data.structured.headline || '').trim(),
          bullets: Array.isArray(data.structured.bullets)
            ? data.structured.bullets.map((b: unknown) => String(b || '').trim()).filter(Boolean)
            : [],
          actions: Array.isArray(data.structured.actions) ? data.structured.actions : [],
          talkToAgent: Boolean(data.structured.talkToAgent),
        }
        : null;
      return {
        id: nextId('a'),
        role: 'assistant',
        body: answer,
        structured,
        citations: Array.isArray(data?.citations) ? data.citations : [],
        source: 'graph',
        meta: {
          provider: data?.provider,
          model: data?.model,
          keyMode: data?.keyMode,
          found: found || (!insufficient && Boolean(answer)),
          abilityKey: 'work_graph_ask',
        },
      };
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
        || (err as { response?: { status?: number } })?.response?.status;
      const is404 = (err as { is404?: boolean })?.is404 === true || status === 404;
      if (!is404) {
        reportAiProviderError(err, 'work_graph_ask');
        setAiRequestError(err);
      }
      return null;
    }
  }

  async function tryListPage(question: string, page: PageAiContext): Promise<InAppAiMessage | null> {
    if (page.kind !== 'list') return null;
    try {
      const facts = await fetchListPageFacts(page);
      if (!facts) return null;

      if (looksLikeCountQuestion(question)) {
        return {
          id: nextId('a'),
          role: 'assistant',
          body: answerFromListFacts(question, facts, t),
          source: 'page',
          meta: { found: true, abilityKey: 'page_context' },
        };
      }

      // Non-count: ask LLM with page facts, then caller may fall back to KB.
      const pageBlock = [
        `Current CRM page: ${moduleLabel(facts.moduleKey)} list`,
        `Total ${moduleLabel(facts.moduleKey)} accessible to this user: ${facts.totalRecords}`,
        Object.keys(facts.statistics).length
          ? `List statistics: ${JSON.stringify(facts.statistics)}`
          : '',
      ].filter(Boolean).join('\n');

      const data = await apiClient.post('/ai/echo', {
        message: [
          'Answer the user using the CRM page context below when it is relevant.',
          'Be brief. If the page context cannot answer the question, reply with exactly: INSUFFICIENT_PAGE_CONTEXT',
          '',
          `Question: ${question}`,
          '',
          'Page context:',
          pageBlock,
        ].join('\n'),
      });
      const answer = String(data?.answer || data?.message || data?.text || '').trim();
      trackAiAbilityUsed({
        abilityKey: 'echo',
        provider: data?.provider,
        model: data?.model,
        found: Boolean(answer) && !looksInsufficient(answer),
        keyMode: data?.keyMode,
        tokens: data?.usage?.totalTokens,
      });
      if (!answer || looksInsufficient(answer)) return null;
      return {
        id: nextId('a'),
        role: 'assistant',
        body: answer,
        source: 'page',
        meta: {
          provider: data?.provider,
          model: data?.model,
          keyMode: data?.keyMode,
          found: true,
          abilityKey: 'echo',
        },
      };
    } catch (err: unknown) {
      reportAiProviderError(err, 'echo');
      return null;
    }
  }

  async function tryKnowledge(question: string): Promise<InAppAiMessage | null> {
    try {
      const data = await apiClient.post('/ai/ask', { question });
      const answer = String(data?.answer || '').trim();
      trackAiAbilityUsed({
        abilityKey: 'ask',
        provider: data?.provider,
        model: data?.model,
        found: data?.found,
        keyMode: data?.keyMode,
        tokens: data?.usage?.totalTokens,
      });
      if (!answer) return null;
      return {
        id: nextId('a'),
        role: 'assistant',
        body: answer,
        citations: Array.isArray(data?.citations) ? data.citations : [],
        source: 'knowledge',
        meta: {
          provider: data?.provider,
          model: data?.model,
          keyMode: data?.keyMode,
          found: Boolean(data?.found),
          abilityKey: 'ask',
        },
      };
    } catch (err: unknown) {
      reportAiProviderError(err, 'ask');
      setAiRequestError(err);
      return null;
    }
  }

  async function tryTenantAgent(
    question: string,
    page: PageAiContext | null,
    agentId = '',
  ): Promise<TenantAgentTryResult> {
    try {
      const data = await apiClient.post('/ai/tenant-agents/ask', {
        question,
        agentId: agentId || undefined,
        moduleKey: page?.moduleKey || '',
        recordId: page?.kind === 'record' ? (page.recordId || '') : '',
        appKey: page?.appKey || 'SALES',
        history: aiMessages.value
          .slice(-12)
          .map((m) => ({ role: m.role, body: String(m.body || '').trim() }))
          .filter((m) => m.body),
      });
      if (!data?.matched) return { matched: false, message: null };
      const answer = String(data?.answer || '').trim();
      const structured = data?.structured && typeof data.structured === 'object'
        ? {
          headline: String(data.structured.headline || '').trim(),
          bullets: Array.isArray(data.structured.bullets)
            ? data.structured.bullets.map((b: unknown) => String(b || '').trim()).filter(Boolean)
            : [],
          clarifyingQuestions: Array.isArray(data.structured.clarifyingQuestions)
            ? data.structured.clarifyingQuestions.map((q: unknown) => String(q || '').trim()).filter(Boolean)
            : [],
          detail: String(data.structured.detail || '').trim(),
          actions: Array.isArray(data.structured.actions) ? data.structured.actions : [],
          visuals: Array.isArray(data.structured.visuals)
            ? data.structured.visuals
              .filter((v: unknown) => v && typeof v === 'object')
              .map((raw: InAppAiVisual) => {
                const component = (
                  ['chart', 'kpi_strip', 'data_table', 'callout', 'progress_list'].includes(String(raw.component))
                    ? raw.component
                    : 'chart'
                ) as InAppAiVisual['component'];
                return {
                  id: String(raw.id || ''),
                  component,
                  chartType: (['pie', 'bar', 'line'].includes(String(raw.chartType))
                    ? raw.chartType
                    : 'pie') as InAppAiVisual['chartType'],
                  title: String(raw.title || '').trim(),
                  metricLabel: String(raw.metricLabel || '').trim(),
                  points: Array.isArray(raw.points)
                    ? raw.points
                      .map((p) => ({
                        label: String(p?.label || '').trim(),
                        value: Number(p?.value) || 0,
                      }))
                      .filter((p) => p.label)
                    : [],
                  items: Array.isArray(raw.items)
                    ? raw.items.map((it) => ({
                      label: String(it?.label || '').trim(),
                      value: it?.value ?? '',
                      hint: String(it?.hint || '').trim() || undefined,
                      max: typeof it?.max === 'number' ? it.max : undefined,
                    })).filter((it) => it.label)
                    : [],
                  columns: Array.isArray(raw.columns)
                    ? raw.columns.map((c) => String(c || '').trim()).filter(Boolean)
                    : [],
                  rows: Array.isArray(raw.rows)
                    ? raw.rows.filter((r) => Array.isArray(r)).map((r) => r.map((c) => (
                      typeof c === 'number' ? c : String(c ?? '')
                    )))
                    : [],
                  tone: (['insight', 'success', 'warning', 'danger'].includes(String(raw.tone))
                    ? raw.tone
                    : 'insight') as InAppAiVisual['tone'],
                  body: String(raw.body || '').trim(),
                };
              })
              .filter((v: InAppAiVisual) => {
                if (v.component === 'chart') return Boolean(v.points?.length);
                if (v.component === 'kpi_strip' || v.component === 'progress_list') {
                  return Boolean(v.items?.length);
                }
                if (v.component === 'data_table') {
                  return Boolean(v.columns?.length && v.rows?.length);
                }
                if (v.component === 'callout') return Boolean(v.body);
                return false;
              })
            : [],
          talkToAgent: Boolean(data.structured.talkToAgent),
        }
        : null;
      const hasStructured = Boolean(
        structured?.bullets?.length
        || structured?.actions?.length
        || structured?.clarifyingQuestions?.length
        || structured?.visuals?.length
        || structured?.detail
        || (structured?.headline
          && structured.headline.toLowerCase() !== String(data?.agent?.name || '').trim().toLowerCase()),
      );
      if (!answer && !hasStructured) {
        return { matched: true, message: null };
      }
      const agentName = data?.agent?.name ? String(data.agent.name) : '';
      if (isThinAgentResponse(answer, structured, agentName)) {
        // Server should already have filled CRM fallback; if still thin, do not cascade.
        return { matched: true, message: null };
      }
      trackAiAbilityUsed({
        abilityKey: 'tenant_agent',
        provider: data?.provider,
        model: data?.model,
        found: data?.found,
        keyMode: data?.keyMode,
        tokens: data?.usage?.totalTokens,
      });
      return {
        matched: true,
        message: {
          id: nextId('a'),
          role: 'assistant',
          body: answer || structured?.headline || t('liveChat.inAppAiRunAgent'),
          structured,
          citations: Array.isArray(data?.citations) ? data.citations : [],
          source: 'agent',
          meta: {
            provider: data?.provider,
            model: data?.model,
            keyMode: data?.keyMode,
            found: true,
            abilityKey: 'tenant_agent',
            agentId: data?.agent?._id ? String(data.agent._id) : '',
            agentName: data?.agent?.name ? String(data.agent.name) : '',
            agentAutoCreated: Boolean(data?.agentAutoCreated || data?.agent?.autoCreated),
          },
        },
      };
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
        || (err as { response?: { status?: number } })?.response?.status;
      const is404 = (err as { is404?: boolean })?.is404 === true || status === 404;
      if (is404) {
        // Older API builds may not expose tenant-agent ask yet; fall through to graph/knowledge.
        return { matched: false, message: null };
      }
      reportAiProviderError(err, 'tenant_agent');
      setAiRequestError(err);
      return { matched: false, message: null };
    }
  }

  function setAiRequestError(err: unknown) {
    const status = (err as { status?: number })?.status
      || (err as { response?: { status?: number } })?.response?.status;
    const data = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
    const code = String(
      (err as { code?: string })?.code
      || data?.code
      || '',
    );
    const message = String(
      data?.message
      || (err as { message?: string })?.message
      || '',
    ).trim();

    if (
      status === 402
      || status === 429
      || code === 'AI_CREDITS_EXHAUSTED'
      || /credits are exhausted/i.test(message)
      || /quota or billing/i.test(message)
    ) {
      aiError.value = t('liveChat.inAppAiCreditsExhausted');
      return;
    }
    if (status === 403 || code === 'AI_SUITE_NOT_ENTITLED' || code === 'AI_PERMISSION_REQUIRED') {
      aiError.value = t('liveChat.inAppAiNotEntitled');
      return;
    }
    if (message && !/^HTTP error!/i.test(message)) {
      aiError.value = message;
      return;
    }
    aiError.value = t('liveChat.inAppAiAskFailed');
  }

  function scoreCachedAgent(
    agent: {
      name?: string;
      description?: string;
      triggerPhrases?: string[];
      moduleKeys?: string[];
    },
    question: string,
    moduleKey = '',
  ): number {
    const pageMod = String(moduleKey || '').toLowerCase();
    const moduleKeys = Array.isArray(agent.moduleKeys)
      ? agent.moduleKeys.map((k) => String(k).toLowerCase())
      : [];
    if (pageMod && moduleKeys.length && !moduleKeys.includes(pageMod)) {
      return -999;
    }

    const nameTokens = String(agent.name || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 2);
    const exclusive: Record<string, string[]> = {
      deals: ['deal', 'deals', 'pipeline', 'opportunity', 'opportunities'],
      organizations: ['organization', 'organisations', 'company', 'account', 'accounts', 'research'],
      people: ['person', 'people', 'contact', 'contacts', 'lead', 'leads'],
      cases: ['case', 'cases', 'ticket', 'tickets'],
    };
    if (pageMod) {
      for (const [mod, tokens] of Object.entries(exclusive)) {
        if (mod === pageMod) continue;
        const exclusiveHits = tokens.filter((t) => nameTokens.includes(t));
        const pageHits = (exclusive[pageMod] || []).filter((t) => nameTokens.includes(t));
        if (exclusiveHits.length && !pageHits.length) return -999;
      }
    }

    const q = String(question || '').toLowerCase().trim();
    const qTokens = new Set(
      q.split(/[^a-z0-9]+/i).filter((w) => w.length >= 2),
    );
    let score = 0;
    const name = String(agent.name || '').trim().toLowerCase();
    if (name) {
      if (q === name) score += 40;
      else if (q.includes(name) || name.includes(q)) score += 24;
      for (const token of nameTokens) {
        if (qTokens.has(token)) score += token.length >= 4 ? 6 : 3;
      }
    }
    if (pageMod && moduleKeys.includes(pageMod)) score += 12;
    for (const phrase of agent.triggerPhrases || []) {
      const p = String(phrase || '').trim().toLowerCase();
      if (!p) continue;
      if (q.includes(p) || p.includes(q)) {
        score += Math.min(22, 8 + Math.min(p.length, 24));
        continue;
      }
      const phraseTokens = p.split(/[^a-z0-9]+/i).filter((w) => w.length >= 2);
      const hit = phraseTokens.filter((token) => qTokens.has(token)).length;
      if (phraseTokens.length && hit === phraseTokens.length) score += 16;
      else if (hit > 0 && hit / phraseTokens.length >= 0.5) score += 10;
      else if (hit > 0) score += Math.min(12, hit * 5);
    }
    for (const token of String(agent.description || '').toLowerCase().split(/[^a-z0-9]+/i)) {
      if (token.length >= 4 && qTokens.has(token)) score += 2;
    }
    if ((agent.triggerPhrases || []).length) score += 1;
    return score;
  }

  function resolveAgentIdByQuestion(
    question: string,
    explicitId = '',
    moduleKey = '',
  ): string {
    if (explicitId) return explicitId;
    const q = String(question || '').trim().toLowerCase();
    if (!q || !cachedAgents.value.length) return '';

    let bestId = '';
    let bestScore = -Infinity;
    let eligibleCount = 0;
    for (const agent of cachedAgents.value) {
      const score = scoreCachedAgent(agent, q, moduleKey);
      if (score < 0) continue;
      eligibleCount += 1;
      if (score > bestScore) {
        bestScore = score;
        bestId = agent._id ? String(agent._id) : '';
      }
    }

    const best = cachedAgents.value.find((a) => String(a._id) === bestId);
    const moduleKeys = Array.isArray(best?.moduleKeys) ? best.moduleKeys : [];
    const pageMod = String(moduleKey || '').toLowerCase();
    const moduleMatched = Boolean(
      pageMod && moduleKeys.map((k) => String(k).toLowerCase()).includes(pageMod),
    );
    let threshold = 8;
    if (eligibleCount === 1 && bestScore >= 3) threshold = 3;
    else if (moduleMatched) threshold = 5;
    else if (!moduleKeys.length) threshold = 6;

    return bestScore >= threshold && bestId ? bestId : '';
  }

  function expandAgentQuestion(question: string, agentId: string): string {
    const q = String(question || '').trim();
    if (!agentId) return q;
    const agent = cachedAgents.value.find((a) => String(a._id) === agentId);
    const name = String(agent?.name || '').trim().toLowerCase();
    if (name && q.toLowerCase() === name) {
      return `Run your specialist analysis for the current CRM record. Focus on actionable insights and next best steps.`;
    }
    return q;
  }

  async function ensureAgentsLoaded(force = false): Promise<void> {
    if (agentsLoaded.value && !force) return;
    try {
      const data = await apiClient.get('/ai/tenant-agents?includeDisabled=false');
      cachedAgents.value = Array.isArray(data?.agents) ? data.agents : [];
    } catch {
      cachedAgents.value = [];
    } finally {
      agentsLoaded.value = true;
    }
  }

  async function askAssistant(question: string, options: { agentId?: string } = {}): Promise<void> {
    const q = String(question || '').trim();
    if (!q || aiAsking.value) return;

    await ensureHydrated();
    if (!activeConversationId.value) {
      activeConversationId.value = `pending_${Date.now()}`;
    }
    cancelAssistantTyping();

    aiAsking.value = true;
    aiError.value = '';
    aiMessages.value.push({
      id: nextId('u'),
      role: 'user',
      body: q,
      createdAt: Date.now(),
    });
    upsertActiveConversation(aiMessages.value);

    try {
      await ensureAgentsLoaded(true);
      const page = resolvePageAiContext(route);
      // Sticky specialist: short follow-up answers stay with the last agent in-thread.
      let stickyAgentId = options.agentId || '';
      if (!stickyAgentId) {
        const lastAgentMsg = [...aiMessages.value].reverse().find((m) => (
          m.role === 'assistant' && m.source === 'agent' && m.meta?.agentId
        ));
        const qWords = q.split(/\s+/).filter(Boolean).length;
        if (lastAgentMsg?.meta?.agentId && qWords <= 24) {
          stickyAgentId = String(lastAgentMsg.meta.agentId);
        }
      }
      const agentId = resolveAgentIdByQuestion(q, stickyAgentId, page?.moduleKey || '');
      const askText = expandAgentQuestion(q, agentId);
      const agentResult = await tryTenantAgent(askText, page, agentId);
      const chosen: InAppAiMessage | null = agentResult.message;

      let pushed: InAppAiMessage | null = null;
      if (chosen?.source === 'agent') {
        lastAbilityKey.value = chosen.meta?.abilityKey || '';
        pushed = { ...chosen, createdAt: chosen.createdAt || Date.now() };
        aiMessages.value.push(pushed);
      } else if (!aiError.value) {
        const names = cachedAgents.value
          .map((a) => String(a.name || '').trim())
          .filter(Boolean)
          .slice(0, 6);
        const body = !cachedAgents.value.length
          ? t('liveChat.inAppAiNoAgentsConfigured')
          : agentResult.matched
            ? t('liveChat.inAppAiAgentNoAnswer')
            : names.length
              ? t('liveChat.inAppAiNoMatchingAgent', { agents: names.join(', ') })
              : t('liveChat.inAppAiNoMatchingAgent', { agents: '' });
        pushed = {
          id: nextId('a'),
          role: 'assistant',
          body,
          source: '',
          createdAt: Date.now(),
        };
        aiMessages.value.push(pushed);
      }
      upsertActiveConversation(aiMessages.value);
      aiAsking.value = false;
      if (pushed) {
        await playAssistantTyping(pushed);
      }
    } catch {
      /* aiError already set by helpers when applicable */
    } finally {
      aiAsking.value = false;
      upsertActiveConversation(aiMessages.value);
    }
  }

  async function sendAiFeedback(message: InAppAiMessage, rating: 'up' | 'down') {
    if (!message.meta?.abilityKey) return;
    await submitAiFeedback({
      abilityKey: message.meta.abilityKey,
      rating,
      provider: message.meta.provider,
      model: message.meta.model,
    });
  }

  return {
    aiMessages,
    aiAsking,
    aiError,
    aiConversations,
    recentAiConversations,
    allAiConversations,
    activeConversationId,
    typingMessageId,
    typingProgress,
    askAssistant,
    clearAiConversation,
    startNewConversation,
    openConversation,
    sendAiFeedback,
    displayHeadline,
    displayBody,
    displayBullets,
    displayDetail,
    displayVisuals,
    displayClarifyingQuestions,
    displayActions,
    showTypingCaret,
    pageContext: () => resolvePageAiContext(route),
  };
}

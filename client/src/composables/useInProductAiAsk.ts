import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { resolvePageAiContext, type PageAiContext } from '@/utils/resolvePageAiContext';
import { submitAiFeedback, trackAiAbilityUsed } from '@/utils/aiFeedback';
import { captureAiProviderError } from '@/config/posthogAi';
import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';

export type AstraProgressStep = {
  step: string;
  detail?: string;
  at: number;
};

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
  kind: 'send_email' | 'complete_task' | 'follow_up' | 'review_record' | 'update_status' | 'talk_to_agent' | 'manual' | 'open_record' | 'none' | 'create_record' | 'update_record' | 'open_content_studio' | 'open_canvas' | 'open_report_builder' | 'open_report' | 'publish_report' | 'export_report' | 'pin_report_to_dashboard' | 'open_widget' | 'open_dashboard';
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
  component: 'chart' | 'kpi_strip' | 'data_table' | 'callout' | 'progress_list' | 'research_brief';
  chartType?: 'pie' | 'donut' | 'bar' | 'line';
  title?: string;
  metricLabel?: string;
  summary?: string;
  points?: Array<{ label: string; value: number }>;
  items?: Array<{ label: string; value: string | number; hint?: string; max?: number }>;
  facts?: Array<{ label: string; value: string }>;
  sections?: Array<{ title: string; body?: string; bullets?: string[] }>;
  sources?: string[];
  columns?: string[];
  rows?: Array<Array<string | number>>;
  tone?: 'insight' | 'success' | 'warning' | 'danger';
  body?: string;
  /** Live CRM binding so the visual can be pinned to Analytics dashboards */
  pinSource?: {
    moduleKey: string;
    groupField?: string;
    metric?: 'count' | 'amount';
    reportType?: string;
    question?: string;
    /** Chart individual matching records (not stage/status rollup) */
    recordLevel?: boolean;
  };
};
export type InAppAiStructured = {
  headline?: string;
  bullets?: string[];
  clarifyingQuestions?: string[];
  /** When true, clarifyingQuestions are clickable next-ask chips (not clarify-needed). */
  suggestionMode?: boolean;
  /** When true, actions include grounded Next Best Action items. */
  nbaMode?: boolean;
  /** Astra Learn: answer passed through Summarize coach. */
  coached?: boolean;
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

const MAX_AI_CONVERSATIONS = 100;
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
  const astraProgressSteps = ref<AstraProgressStep[]>([]);
  /** Single behind-the-scenes line under “Astra is working…”. */
  const astraStatusLine = ref('');
  let astraAmbientTimer: ReturnType<typeof setInterval> | null = null;
  let astraAmbientIndex = 0;
  const lastAbilityKey = ref('');

  const ASTRA_STEP_I18N: Record<string, string> = {
    routing: 'liveChat.inAppAiStatusRouting',
    resolving_config: 'liveChat.inAppAiStatusResolvingConfig',
    checking_cache: 'liveChat.inAppAiStatusCheckingCache',
    cache_hit: 'liveChat.inAppAiStatusCacheHit',
    gathering_context: 'liveChat.inAppAiStatusGatheringContext',
    resolving_chunks: 'liveChat.inAppAiStatusExpandingRecords',
    searching_workspace: 'liveChat.inAppAiStatusSearchingWorkspace',
    expanding_records: 'liveChat.inAppAiStatusExpandingRecords',
    loading_module_data: 'liveChat.inAppAiStatusLoadingModuleData',
    loading_attention: 'liveChat.inAppAiStatusLoadingAttention',
    loading_calendar: 'liveChat.inAppAiStatusLoadingCalendar',
    web_research: 'liveChat.inAppAiStatusWebResearch',
    calling_model: 'liveChat.inAppAiStatusThinking',
    thinking: 'liveChat.inAppAiStatusThinking',
    drafting: 'liveChat.inAppAiStatusDrafting',
    shaping: 'liveChat.inAppAiStatusShaping',
    polishing: 'liveChat.inAppAiStatusPolishing',
    structuring: 'liveChat.inAppAiStatusStructuring',
    enriching: 'liveChat.inAppAiStatusEnriching',
    preparing_visuals: 'liveChat.inAppAiStatusPreparingVisuals',
    almost_done: 'liveChat.inAppAiStatusAlmostDone',
  };

  /** Ambient flips while a phase is still running (keeps the line alive). */
  const ASTRA_AMBIENT_BY_STEP: Record<string, string[]> = {
    routing: [
      'liveChat.inAppAiStatusRouting',
      'liveChat.inAppAiStatusResolvingConfig',
    ],
    resolving_config: [
      'liveChat.inAppAiStatusResolvingConfig',
      'liveChat.inAppAiStatusRouting',
    ],
    checking_cache: [
      'liveChat.inAppAiStatusCheckingCache',
      'liveChat.inAppAiStatusGatheringContext',
    ],
    cache_hit: [
      'liveChat.inAppAiStatusCacheHit',
      'liveChat.inAppAiStatusAlmostDone',
    ],
    gathering_context: [
      'liveChat.inAppAiStatusGatheringContext',
      'liveChat.inAppAiStatusSearchingWorkspace',
      'liveChat.inAppAiStatusExpandingRecords',
    ],
    resolving_chunks: [
      'liveChat.inAppAiStatusExpandingRecords',
      'liveChat.inAppAiStatusGatheringContext',
      'liveChat.inAppAiStatusThinking',
    ],
    searching_workspace: [
      'liveChat.inAppAiStatusSearchingWorkspace',
      'liveChat.inAppAiStatusGatheringContext',
      'liveChat.inAppAiStatusExpandingRecords',
    ],
    expanding_records: [
      'liveChat.inAppAiStatusExpandingRecords',
      'liveChat.inAppAiStatusGatheringContext',
    ],
    loading_module_data: [
      'liveChat.inAppAiStatusLoadingModuleData',
      'liveChat.inAppAiStatusGatheringContext',
    ],
    loading_attention: [
      'liveChat.inAppAiStatusLoadingAttention',
      'liveChat.inAppAiStatusGatheringContext',
    ],
    loading_calendar: [
      'liveChat.inAppAiStatusLoadingCalendar',
      'liveChat.inAppAiStatusGatheringContext',
    ],
    web_research: [
      'liveChat.inAppAiStatusWebResearch',
      'liveChat.inAppAiStatusConnecting',
    ],
    thinking: [
      'liveChat.inAppAiStatusThinking',
      'liveChat.inAppAiStatusReviewingAsk',
      'liveChat.inAppAiStatusConnecting',
    ],
    calling_model: [
      'liveChat.inAppAiStatusThinking',
      'liveChat.inAppAiStatusReviewingAsk',
      'liveChat.inAppAiStatusConnecting',
    ],
    drafting: [
      'liveChat.inAppAiStatusDrafting',
      'liveChat.inAppAiStatusShaping',
      'liveChat.inAppAiStatusPolishing',
    ],
    shaping: [
      'liveChat.inAppAiStatusShaping',
      'liveChat.inAppAiStatusDrafting',
      'liveChat.inAppAiStatusPolishing',
    ],
    polishing: [
      'liveChat.inAppAiStatusPolishing',
      'liveChat.inAppAiStatusShaping',
      'liveChat.inAppAiStatusStructuring',
    ],
    structuring: [
      'liveChat.inAppAiStatusStructuring',
      'liveChat.inAppAiStatusEnriching',
      'liveChat.inAppAiStatusAlmostDone',
    ],
    enriching: [
      'liveChat.inAppAiStatusEnriching',
      'liveChat.inAppAiStatusAlmostDone',
    ],
    preparing_visuals: [
      'liveChat.inAppAiStatusPreparingVisuals',
      'liveChat.inAppAiStatusAlmostDone',
    ],
    almost_done: [
      'liveChat.inAppAiStatusAlmostDone',
      'liveChat.inAppAiStatusPolishing',
    ],
  };

  function stopAstraAmbient() {
    if (astraAmbientTimer != null) {
      clearInterval(astraAmbientTimer);
      astraAmbientTimer = null;
    }
    astraAmbientIndex = 0;
  }

  function labelForStep(step: string): string {
    const key = ASTRA_STEP_I18N[step];
    return key ? t(key) : '';
  }

  function ambientKeysForStep(step: string): string[] {
    return ASTRA_AMBIENT_BY_STEP[step]
      || ASTRA_AMBIENT_BY_STEP.thinking
      || ['liveChat.inAppAiStatusThinking'];
  }

  function applyAstraStatusFromStep(step: string) {
    const label = labelForStep(step);
    if (label) astraStatusLine.value = label;
    astraAmbientIndex = 0;
    stopAstraAmbient();
    if (!aiAsking.value) return;
    const keys = ambientKeysForStep(step);
    if (keys.length < 2) return;
    astraAmbientTimer = setInterval(() => {
      if (!aiAsking.value) {
        stopAstraAmbient();
        return;
      }
      astraAmbientIndex = (astraAmbientIndex + 1) % keys.length;
      const ambientKey = keys[astraAmbientIndex] ?? keys[0] ?? '';
      if (ambientKey) astraStatusLine.value = t(ambientKey);
    }, 2200);
  }

  function pushAstraProgress(step: string, detail?: string) {
    const s = String(step || '').trim();
    if (!s) return;
    const d = detail ? String(detail).trim() : undefined;
    const last = astraProgressSteps.value[astraProgressSteps.value.length - 1];
    // Always refresh display on real server phases (including same family with new phase).
    const phaseChanged = !last || last.step !== s || (last.detail || '') !== (d || '');
    if (!phaseChanged) return;
    astraProgressSteps.value = [
      ...astraProgressSteps.value.slice(-8),
      { step: s, detail: d, at: Date.now() },
    ];
    applyAstraStatusFromStep(s);
  }

  function clearAstraProgress() {
    stopAstraAmbient();
    astraProgressSteps.value = [];
    astraStatusLine.value = '';
  }
  const cachedAgents = ref<Array<{
    _id: string;
    name: string;
    enabled?: boolean;
    mentionable?: boolean;
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

    const finishTyping = () => {
      if (gen !== typingGen) return;
      typedHeadlineLen.value = headline.length;
      typedBodyLen.value = body.length;
      typedDetailLen.value = detail.length;
      typedBulletLens.value = bullets.map((b) => String(b || '').length);
      revealedBulletCount.value = bullets.length;
      revealedQuestionCount.value = questions.length;
      visualsRevealed.value = true;
      actionsRevealed.value = true;
      typingMessageId.value = null;
      typingProgress.value += 1;
    };

    try {
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
    } finally {
      // Never leave the UI mid-sentence if typing was interrupted or errored.
      finishTyping();
    }
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

  function applyConversationToList(
    entry: InAppAiConversation,
    { bumpToFront = true }: { bumpToFront?: boolean } = {},
  ) {
    const idx = aiConversations.value.findIndex((c) => c.id === entry.id);
    if (!bumpToFront && idx >= 0) {
      const next = aiConversations.value.slice();
      next[idx] = entry;
      aiConversations.value = next;
      return;
    }
    aiConversations.value = [
      entry,
      ...aiConversations.value.filter((c) => c.id !== entry.id),
    ].slice(0, MAX_AI_CONVERSATIONS);
  }

  async function persistConversationNow(
    entry: InAppAiConversation,
    { bumpToFront = true }: { bumpToFront?: boolean } = {},
  ): Promise<InAppAiConversation | null> {
    const seq = ++persistSeq;
    try {
      if (entry.id && isMongoId(entry.id)) {
        const data = await apiClient.put(`/ai/conversations/${encodeURIComponent(entry.id)}`, {
          title: entry.title,
          messages: entry.messages.slice(-MAX_AI_MESSAGES),
          moduleKey: entry.moduleKey || '',
          recordId: entry.recordId || '',
          contextLabel: entry.contextLabel || '',
        }, { skipAuthLogout: true });
        if (seq !== persistSeq) return null;
        const saved = mapApiConversation(data?.conversation || entry);
        if (!bumpToFront) {
          saved.updatedAt = entry.updatedAt;
        }
        applyConversationToList(saved, { bumpToFront });
        return saved;
      }
      const data = await apiClient.post('/ai/conversations', {
        title: entry.title,
        messages: entry.messages.slice(-MAX_AI_MESSAGES),
        moduleKey: entry.moduleKey || '',
        recordId: entry.recordId || '',
        contextLabel: entry.contextLabel || '',
      }, { skipAuthLogout: true });
      if (seq !== persistSeq) return null;
      const saved = mapApiConversation(data?.conversation || {});
      if (activeConversationId.value === entry.id || !activeConversationId.value) {
        activeConversationId.value = saved.id;
        rememberActiveId(saved.id);
      }
      applyConversationToList(saved, { bumpToFront });
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
        }, { skipAuthLogout: true });
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
      const data = await apiClient.get('/ai/conversations', { skipAuthLogout: true });
      let list = Array.isArray(data?.conversations)
        ? (data.conversations as Record<string, unknown>[]).map((c) => mapApiConversation(c))
        : [];
      await migrateLegacyIfNeeded(orgId, userId, list.length);
      if (!list.length && aiConversations.value.length) {
        list = [...aiConversations.value];
      } else if (!list.length) {
        const refresh = await apiClient.get('/ai/conversations', { skipAuthLogout: true });
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
        const full = await apiClient.get(`/ai/conversations/${encodeURIComponent(activeId)}`, {
          skipAuthLogout: true,
        });
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
      }, { skipAuthLogout: true });
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
        // Sync messages only — do not bump updatedAt / list position on mere select.
        void persistConversationNow({
          ...existing,
          messages: aiMessages.value.slice(-MAX_AI_MESSAGES),
          updatedAt: existing.updatedAt,
          title: titleFromMessages(aiMessages.value) || existing.title,
        }, { bumpToFront: false });
      }
    }
    try {
      if (isMongoId(id)) {
        const data = await apiClient.get(`/ai/conversations/${encodeURIComponent(id)}`, {
          skipAuthLogout: true,
        });
        const conv = mapApiConversation(data?.conversation || {});
        const prev = aiConversations.value.find((c) => c.id === conv.id);
        if (prev?.updatedAt) {
          conv.updatedAt = prev.updatedAt;
        }
        applyConversationToList(conv, { bumpToFront: false });
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
      .slice()
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
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
      // Skip legacy /people/:id/summarize — it returns field dumps with no actions.
      // Record summarize goes through tenant agents (coaching brief + Do-next).

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

  function buildHistoryPayload() {
    return aiMessages.value
      .slice(-16)
      .map((m) => {
        const structuredBits = [
          m.structured?.headline,
          ...(Array.isArray(m.structured?.bullets) ? m.structured.bullets.slice(0, 6) : []),
          m.structured?.detail,
        ].map((s) => String(s || '').trim()).filter(Boolean);
        const body = String(m.body || '').trim();
        const content = [body, ...structuredBits.filter((s) => !body.includes(s))]
          .join('\n')
          .trim()
          .slice(0, 8000);
        const actions = Array.isArray(m.structured?.actions)
          ? m.structured.actions.slice(0, 6).map((a) => ({
            kind: String(a?.kind || ''),
            recordId: String(a?.recordId || ''),
            fields: a?.fields && typeof a.fields === 'object'
              ? {
                reportId: a.fields.reportId,
                widgetId: a.fields.widgetId,
                dashboardId: a.fields.dashboardId,
              }
              : undefined,
          }))
          : [];
        return { role: m.role, body: content, actions };
      })
      .filter((m) => m.body || (Array.isArray(m.actions) && m.actions.length));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider payload shape
  function parseTenantAgentStructured(data: any): InAppAiStructured | null {
    if (!(data?.structured && typeof data.structured === 'object')) return null;
    return {
      headline: String(data.structured.headline || '').trim(),
      bullets: Array.isArray(data.structured.bullets)
        ? data.structured.bullets.map((b: unknown) => String(b || '').trim()).filter(Boolean)
        : [],
      clarifyingQuestions: Array.isArray(data.structured.clarifyingQuestions)
        ? data.structured.clarifyingQuestions.map((q: unknown) => String(q || '').trim()).filter(Boolean)
        : [],
      suggestionMode: Boolean(data.structured.suggestionMode),
      nbaMode: Boolean(data.structured.nbaMode),
      coached: Boolean(data.structured.coached),
      detail: String(data.structured.detail || '').trim(),
      actions: Array.isArray(data.structured.actions) ? data.structured.actions : [],
      visuals: Array.isArray(data.structured.visuals)
        ? data.structured.visuals
          .filter((v: unknown) => v && typeof v === 'object')
          .map((raw: InAppAiVisual) => {
            const component = (
              ['chart', 'kpi_strip', 'data_table', 'callout', 'progress_list', 'research_brief'].includes(String(raw.component))
                ? raw.component
                : 'chart'
            ) as InAppAiVisual['component'];
            return {
              id: String(raw.id || ''),
              component,
              chartType: (['pie', 'donut', 'bar', 'line'].includes(String(raw.chartType))
                ? raw.chartType
                : 'pie') as InAppAiVisual['chartType'],
              title: String(raw.title || '').trim(),
              metricLabel: String(raw.metricLabel || '').trim(),
              summary: String((raw as { summary?: string }).summary || '').trim() || undefined,
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
              facts: Array.isArray((raw as { facts?: unknown }).facts)
                ? ((raw as { facts: Array<{ label?: string; value?: string }> }).facts).map((f) => ({
                  label: String(f?.label || '').trim(),
                  value: String(f?.value ?? '').trim(),
                })).filter((f) => f.label && f.value)
                : [],
              sections: Array.isArray((raw as { sections?: unknown }).sections)
                ? ((raw as {
                  sections: Array<{ title?: string; body?: string; bullets?: unknown[] }>
                }).sections).map((s) => ({
                  title: String(s?.title || '').trim(),
                  body: String(s?.body || '').trim() || undefined,
                  bullets: Array.isArray(s?.bullets)
                    ? s.bullets.map((b) => String(b || '').trim()).filter(Boolean)
                    : [],
                })).filter((s) => s.title && (s.body || (s.bullets && s.bullets.length)))
                : [],
              sources: Array.isArray((raw as { sources?: unknown }).sources)
                ? ((raw as { sources: unknown[] }).sources).map((s) => String(s || '').trim()).filter(Boolean)
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
              ...(raw.pinSource && typeof raw.pinSource === 'object' && String((raw.pinSource as { moduleKey?: string }).moduleKey || '').trim()
                ? {
                  pinSource: {
                    moduleKey: String((raw.pinSource as { moduleKey?: string }).moduleKey || '').trim(),
                    // Keep empty string — missing group means record-level, not "default to stage"
                    groupField: Object.prototype.hasOwnProperty.call(raw.pinSource, 'groupField')
                      ? String((raw.pinSource as { groupField?: string }).groupField || '').trim()
                      : undefined,
                    metric: (raw.pinSource as { metric?: string }).metric === 'amount' ? 'amount' as const : 'count' as const,
                    reportType: String((raw.pinSource as { reportType?: string }).reportType || '').trim() || undefined,
                    question: String((raw.pinSource as { question?: string }).question || '').trim() || undefined,
                    recordLevel: (raw.pinSource as { recordLevel?: boolean }).recordLevel === true,
                  },
                }
                : {}),
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
            if (v.component === 'research_brief') {
              return Boolean(v.sections?.length || v.facts?.length || v.summary);
            }
            return false;
          })
        : [],
      talkToAgent: Boolean(data.structured.talkToAgent),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider payload shape
  function messageFromTenantAgentData(data: any): InAppAiMessage | null {
    let answer = String(data?.answer || '').trim();
    // Never show internal CRM pack / chunk-resolve scaffolding in the chat bubble.
    if (/CHUNK-RESOLVED|STICKY CHAT RULE|Treat digests as compressed/i.test(answer)) {
      answer = '';
    }
    const structured = parseTenantAgentStructured(data);
    if (structured?.bullets?.length) {
      structured.bullets = structured.bullets.filter((b) => (
        !/CHUNK-RESOLVED|STICKY CHAT RULE|Treat digests|Conversation focus|RECORD ANALYSIS|PRIMARY RECORD/i.test(b)
      ));
    }
    const hasStructured = Boolean(
      structured?.bullets?.length
      || structured?.actions?.length
      || structured?.clarifyingQuestions?.length
      || structured?.visuals?.length
      || structured?.detail
      || (structured?.headline
        && structured.headline.toLowerCase() !== String(data?.agent?.name || '').trim().toLowerCase()),
    );
    if (!answer && !hasStructured) return null;
    const agentName = data?.agent?.name ? String(data.agent.name) : '';
    if (isThinAgentResponse(answer, structured, agentName)) return null;
    return {
      id: nextId('a'),
      role: 'assistant',
      body: answer
        || String(structured?.detail || '').trim()
        || structured?.headline
        || t('liveChat.inAppAiRunAgent'),
      structured: structured || undefined,
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
    };
  }

  async function streamTenantAgentAsk(
    body: Record<string, unknown>,
    handlers: {
      onProgress?: (step: string, detail?: string) => void;
      onPartial?: (data: Record<string, unknown>) => void;
    } = {},
  ): Promise<Record<string, unknown>> {
    const token = authStore.user?.token;
    const response = await fetch(getApiUrlForFetch('/ai/tenant-agents/ask'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      const err = new Error(
        String((errPayload as { message?: string })?.message || `HTTP ${response.status}`),
      ) as Error & { status?: number; code?: string; response?: { status: number; data: unknown } };
      err.status = response.status;
      err.code = String((errPayload as { code?: string })?.code || '');
      err.response = { status: response.status, data: errPayload };
      throw err;
    }

    const contentType = String(response.headers.get('content-type') || '');
    if (!contentType.includes('text/event-stream')) {
      return (await response.json()) as Record<string, unknown>;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Astra stream unavailable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let donePayload: Record<string, unknown> | null = null;
    let streamError: { message?: string; code?: string } | null = null;

    const consumeEvent = (rawEvent: string) => {
      const lines = rawEvent.split('\n');
      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) return;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
      } catch {
        return;
      }
      if (eventName === 'progress') {
        handlers.onProgress?.(String(payload.step || ''), payload.detail ? String(payload.detail) : undefined);
      } else if (eventName === 'partial') {
        handlers.onPartial?.(payload);
      } else if (eventName === 'done') {
        donePayload = payload;
      } else if (eventName === 'error') {
        streamError = {
          message: String(payload.message || 'Ask failed'),
          code: payload.code ? String(payload.code) : undefined,
        };
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        if (part.trim()) consumeEvent(part);
      }
    }
    if (buffer.trim()) consumeEvent(buffer);

    // Closure assignment is invisible to CFA — assert after stream completes.
    const failed = streamError as { message?: string; code?: string } | null;
    if (failed) {
      const err = new Error(failed.message || 'Ask failed') as Error & { code?: string };
      err.code = failed.code;
      throw err;
    }
    if (!donePayload) {
      throw new Error('Astra stream ended without a result');
    }
    return donePayload;
  }

  async function tryTenantAgent(
    question: string,
    page: PageAiContext | null,
    agentId = '',
    options: {
      onPartialMessage?: (message: InAppAiMessage) => void;
      llmModel?: string;
      mentionResolved?: boolean;
      recordTitle?: string;
    } = {},
  ): Promise<TenantAgentTryResult> {
    try {
      const requestBody = {
        question,
        agentId: agentId || undefined,
        mentionResolved: options.mentionResolved === true ? true : undefined,
        moduleKey: page?.moduleKey || '',
        recordId: page?.kind === 'record' ? (page.recordId || '') : '',
        recordTitle: options.recordTitle || undefined,
        appKey: page?.appKey || 'SALES',
        history: buildHistoryPayload(),
        ...(options.llmModel ? { llmModel: options.llmModel } : {}),
      };

      let partialApplied = false;
      const data = await streamTenantAgentAsk(requestBody, {
        onProgress: (step, detail) => pushAstraProgress(step, detail),
        onPartial: (partial) => {
          if (!partial?.matched || partialApplied) return;
          const msg = messageFromTenantAgentData(partial);
          if (!msg) return;
          partialApplied = true;
          options.onPartialMessage?.(msg);
        },
      });

      if (!data?.matched) return { matched: false, message: null };
      const message = messageFromTenantAgentData(data);
      if (!message) {
        return { matched: true, message: null };
      }
      trackAiAbilityUsed({
        abilityKey: 'tenant_agent',
        provider: data?.provider as string | undefined,
        model: data?.model as string | undefined,
        found: data?.found as boolean | undefined,
        keyMode: data?.keyMode as string | undefined,
        tokens: (data?.usage as { totalTokens?: number } | undefined)?.totalTokens,
      });
      return { matched: true, message };
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
        || (err as { response?: { status?: number } })?.response?.status;
      const is404 = (err as { is404?: boolean })?.is404 === true || status === 404;
      if (is404) {
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
      mentionable?: boolean;
    },
    question: string,
    moduleKey = '',
  ): number {
    const pageMod = String(moduleKey || '').toLowerCase();
    const moduleKeys = Array.isArray(agent.moduleKeys)
      ? agent.moduleKeys.map((k) => String(k).toLowerCase())
      : [];
    // Super Agents (@mentionable) stay eligible on any CRM page — same as full-page Astra.
    if (pageMod && moduleKeys.length && !moduleKeys.includes(pageMod) && !agent.mentionable) {
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
    if (pageMod && !agent.mentionable) {
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

  function resolveClientAgentMention(question: string): { agentId: string; question: string } | null {
    const raw = String(question || '').trim();
    if (!raw.startsWith('@')) return null;
    const rest = raw.slice(1);
    const mentionable = cachedAgents.value
      .filter((a) => a.mentionable && a.enabled !== false)
      .slice()
      .sort((a, b) => String(b.name || '').length - String(a.name || '').length);
    for (const agent of mentionable) {
      const name = String(agent.name || '').trim();
      if (!name) continue;
      if (!rest.toLowerCase().startsWith(name.toLowerCase())) continue;
      const after = rest.slice(name.length);
      if (after && !/^[\s,.:;!?]/.test(after)) continue;
      let q = after.replace(/^[\s,.:;!?]+/, '').trim();
      if (!q) {
        q = 'Run your specialist analysis for the current CRM record. Focus on actionable insights and next best steps.';
      }
      return { agentId: String(agent._id), question: q };
    }
    return null;
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

  function withRecordIntentContext(question: string, page: PageAiContext | null, recordTitle = ''): string {
    const q = String(question || '').trim();
    if (!q || !page || page.kind !== 'record' || !page.recordId) return q;
    const title = String(recordTitle || '').trim();
    const label = title || `${page.moduleKey} record`;
    if (
      /\bsummar(y|ize|ise)\b/i.test(q)
      || /\brecap\b/i.test(q)
      || /\boverview\b/i.test(q)
    ) {
      return [
        `Coaching summary for ${label} (moduleKey=${page.moduleKey}; recordId=${page.recordId}).`,
        'Write a clear summary first: situation, risk or stall, and what matters now.',
        'Then add 2–4 next actions (send an email, or a concrete call ask).',
        'Do NOT create events or ask for meeting start/end times.',
        'Do NOT restate obvious fields (email, owner, organization, do-not-contact).',
        'Do NOT replace the summary with an email body. Do NOT open Canvas unless I ask for it.',
      ].join(' ');
    }
    // Vague record chips → ground intent on the open CRM row (parity with full-page named asks).
    if (/\b(this|the)\s+record\b/i.test(q) || /\bnext best action here\b/i.test(q)) {
      return `${q} (Current CRM record: ${label}; moduleKey=${page.moduleKey}; recordId=${page.recordId})`;
    }
    // Vague reach-out / follow-up chips → email draft (avoid looping the same CTA).
    const reachOut = q.match(
      /^(?:reach out to|follow up (?:on|with)|check in on|advance|email(?:\s+to)?(?:\s+advance)?|email check-in on)\s+(.+?)(?:\s+with one clear ask)?$/i,
    );
    if (reachOut) {
      const who = String(reachOut[1] || label)
        .replace(/\s+with one clear ask\s*$/i, '')
        .replace(/\s*[.…]+\s*$/, '')
        .trim() || label;
      return [
        `Draft a short follow-up email for ${who} with one clear ask.`,
        `Current CRM record: ${label}; moduleKey=${page.moduleKey}; recordId=${page.recordId}.`,
        'Put To/Subject/Body in a send_email action.',
        `Do not suggest "Reach out to ${who}" again.`,
      ].join(' ');
    }
    return q;
  }

  async function ensureAgentsLoaded(force = false): Promise<void> {
    if (agentsLoaded.value && !force) return;
    try {
      const data = await apiClient.get('/ai/tenant-agents?includeDisabled=false', {
        skipAuthLogout: true,
      });
      cachedAgents.value = Array.isArray(data?.agents) ? data.agents : [];
    } catch {
      cachedAgents.value = [];
    } finally {
      agentsLoaded.value = true;
    }
  }

  async function askAssistant(
    question: string,
    options: { agentId?: string; llmModel?: string; recordTitle?: string } = {},
  ): Promise<void> {
    const q = String(question || '').trim();
    if (!q || aiAsking.value) return;

    await ensureHydrated();
    if (!activeConversationId.value) {
      activeConversationId.value = `pending_${Date.now()}`;
    }
    cancelAssistantTyping();

    aiAsking.value = true;
    aiError.value = '';
    clearAstraProgress();
    pushAstraProgress('routing');
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
      const mention = resolveClientAgentMention(q);
      // Sticky specialist: short follow-up answers stay with the last agent in-thread.
      let stickyAgentId = options.agentId || '';
      if (!stickyAgentId && !mention) {
        const lastAgentMsg = [...aiMessages.value].reverse().find((m) => (
          m.role === 'assistant' && m.source === 'agent' && m.meta?.agentId
        ));
        const qWords = q.split(/\s+/).filter(Boolean).length;
        if (lastAgentMsg?.meta?.agentId && qWords <= 24) {
          stickyAgentId = String(lastAgentMsg.meta.agentId);
        }
      }
      const agentId = mention?.agentId
        || resolveAgentIdByQuestion(mention?.question || q, stickyAgentId, page?.moduleKey || '');
      const mentionResolved = Boolean(mention?.agentId)
        || (Boolean(options.agentId) && String(q).trim().startsWith('@'));
      const baseAsk = expandAgentQuestion(mention?.question || q, agentId);
      const askText = withRecordIntentContext(baseAsk, page, options.recordTitle || '');
      let earlyMessageId: string | null = null;
      const agentResult = await tryTenantAgent(askText, page, agentId, {
        llmModel: options.llmModel || '',
        mentionResolved,
        recordTitle: options.recordTitle || '',
        onPartialMessage: (msg) => {
          earlyMessageId = msg.id;
          aiMessages.value.push({ ...msg, createdAt: msg.createdAt || Date.now() });
          upsertActiveConversation(aiMessages.value);
        },
      });
      const chosen: InAppAiMessage | null = agentResult.message;

      let pushed: InAppAiMessage | null = null;
      if (chosen?.source === 'agent') {
        lastAbilityKey.value = chosen.meta?.abilityKey || '';
        if (earlyMessageId) {
          const idx = aiMessages.value.findIndex((m) => m.id === earlyMessageId);
          const existing = idx >= 0 ? aiMessages.value[idx] : undefined;
          if (existing) {
            const updated: InAppAiMessage = {
              ...chosen,
              id: earlyMessageId,
              createdAt: existing.createdAt || Date.now(),
            };
            aiMessages.value[idx] = updated;
            pushed = updated;
          } else {
            pushed = { ...chosen, createdAt: chosen.createdAt || Date.now() };
            aiMessages.value.push(pushed);
          }
        } else {
          pushed = { ...chosen, createdAt: chosen.createdAt || Date.now() };
          aiMessages.value.push(pushed);
        }
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
      clearAstraProgress();
      if (pushed && !earlyMessageId) {
        await playAssistantTyping(pushed);
      }
    } catch {
      /* aiError already set by helpers when applicable */
    } finally {
      aiAsking.value = false;
      clearAstraProgress();
      upsertActiveConversation(aiMessages.value);
    }
  }

  async function sendAiFeedback(message: InAppAiMessage, rating: 'up' | 'down') {
    if (!message.meta?.abilityKey) return;
    const firstAction = Array.isArray(message.structured?.actions)
      ? message.structured.actions[0]
      : null;
    const actionFingerprint = firstAction
      ? [
        String(firstAction.kind || ''),
        String(firstAction.moduleKey || ''),
        String(firstAction.recordId || ''),
        String(firstAction.label || '').slice(0, 48),
      ].join(':')
      : '';
    await submitAiFeedback({
      abilityKey: message.meta.abilityKey,
      rating,
      provider: message.meta.provider,
      model: message.meta.model,
      actionFingerprint: rating === 'down' && actionFingerprint ? actionFingerprint : undefined,
      comment: rating === 'down' && message.structured?.coached
        ? 'summarize_quality'
        : undefined,
    });
  }

  return {
    aiMessages,
    aiAsking,
    aiError,
    astraProgressSteps,
    astraStatusLine,
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

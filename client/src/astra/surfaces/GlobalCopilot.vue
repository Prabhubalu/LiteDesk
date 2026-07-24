<template>
  <div class="astra-copilot flex h-full min-h-0 w-full flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950">
    <div
      class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden"
      :class="showHistorySidebar ? 'md:grid-cols-[17.5rem_minmax(0,1fr)]' : ''"
    >
      <AstraConversationSidebar
        v-if="showHistorySidebar"
        :items="conversations"
        :active-id="conversationId"
        :loading="historyLoading"
        :loading-more="historyLoadingMore"
        :has-more="historyHasMore"
        :mobile-open="mobileHistoryOpen"
        @select="onSelectConversation"
        @delete="onDeleteConversation"
        @new-chat="onNewChat"
        @close-mobile="mobileHistoryOpen = false"
        @clear-older="onClearOlder"
        @load-more="onLoadMoreHistory"
      />

      <!-- Chat column -->
      <section class="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <header
        v-if="showHistorySidebar"
        class="relative z-10 flex shrink-0 items-center border-b border-neutral-200/60 px-4 py-2 dark:border-white/[0.08] md:hidden"
      >
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-200/60 dark:bg-neutral-900 dark:ring-white/10"
          :aria-label="t('astra.historyHeading')"
          @click="mobileHistoryOpen = true"
        >
          <Bars3Icon class="h-4 w-4" />
        </button>
      </header>

      <div
        class="relative z-10 flex min-h-0 flex-1 flex-col"
        :class="isEmptyLanding ? 'justify-center overflow-y-auto px-4 pb-28 pt-4 sm:px-6 sm:pb-36 sm:pt-6' : ''"
      >
        <!-- Empty landing: hero + composer as one centered stack -->
        <div
          v-if="isEmptyLanding"
          class="mx-auto flex w-full max-w-3xl shrink-0 flex-col items-center px-2 text-center"
        >
          <div class="astra-hero-logo mb-2 flex items-center justify-center">
            <AstraLogo size="hero" />
          </div>
          <h1 class="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
            {{ greeting }}
          </h1>
          <p class="mt-1 max-w-md text-sm text-neutral-500">{{ t('astra.tagline') }}</p>
          <div class="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
            <button
              v-for="card in heroSuggestions"
              :key="card.id"
              type="button"
              class="rounded-2xl border border-neutral-200/70 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-primary-300 dark:border-white/10 dark:bg-neutral-900"
              @click="onSuggestion(card)"
            >
              <span class="flex items-start gap-3">
                <span class="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300">
                  <component :is="card.icon" class="h-4 w-4" />
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-neutral-900 dark:text-white">{{ card.title }}</span>
                  <span class="mt-0.5 block text-xs text-neutral-500">{{ card.subtitle }}</span>
                </span>
              </span>
            </button>
          </div>
        </div>

        <!-- Thread -->
        <div
          v-else
          ref="messagesEl"
          class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
        >
          <div class="mx-auto w-full max-w-3xl space-y-6">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex gap-3"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                v-if="msg.role === 'assistant'"
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/70 dark:bg-neutral-900 dark:ring-white/10"
              >
                <AstraLogo size="sm" />
              </div>
              <div
                v-if="msg.role === 'user'"
                class="max-w-[85%] rounded-3xl rounded-br-lg bg-sky-50 px-4 py-2.5 text-sm text-sky-950 dark:bg-sky-950/40 dark:text-sky-100"
              >
                <p class="whitespace-pre-wrap break-words">{{ msg.body }}</p>
              </div>
              <div v-else class="min-w-0 max-w-[min(100%,42rem)] flex-1 space-y-3">
                <p
                  v-if="msg.agentName"
                  class="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500"
                >
                  {{ t('astra.responseFromAgent', { name: msg.agentName }) }}
                </p>
                <AstraAnswerBody v-if="msg.body" :body="msg.body" />
                <div v-if="msg.href" class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-600"
                    @click="onNavigateProposal(msg.href)"
                  >
                    {{ msg.navigateLabel || t('astra.viewRecord') }}
                  </button>
                </div>
                <AstraMessageBlocks
                  v-if="msg.blocks?.length"
                  :blocks="msg.blocks"
                />
                <div v-if="msg.proposals?.length" class="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    {{ t('astra.proposalsHeading') }}
                  </p>
                  <div
                    v-for="proposal in msg.proposals"
                    :key="proposal.id"
                    class="rounded-xl border border-neutral-100 px-3 py-2.5 dark:border-white/10"
                  >
                    <p class="text-sm font-medium text-neutral-900 dark:text-white">{{ proposal.label }}</p>
                    <p v-if="proposal.rationale" class="mt-0.5 whitespace-pre-line text-xs text-neutral-500">{{ proposal.rationale }}</p>
                    <dl
                      v-if="proposal.status !== 'completed' && proposal.details?.length"
                      class="mt-2 space-y-1 border-t border-neutral-100 pt-2 dark:border-white/10"
                    >
                      <div
                        v-for="(row, dIdx) in proposal.details"
                        :key="`${proposal.id}-d-${dIdx}`"
                        class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 text-xs"
                      >
                        <dt class="text-neutral-400">{{ row.label }}</dt>
                        <dd class="truncate text-neutral-700 dark:text-neutral-200" :title="row.value">{{ row.value }}</dd>
                      </div>
                    </dl>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <template v-if="proposal.status === 'completed'">
                        <button
                          v-if="proposal.href"
                          type="button"
                          class="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-600"
                          @click="onNavigateProposal(proposal.href)"
                        >
                          {{ proposal.navigateLabel || t('astra.viewRecord') }}
                        </button>
                        <span class="self-center text-xs text-emerald-600 dark:text-emerald-400">
                          {{ t('astra.actionCompleted') }}
                        </span>
                      </template>
                      <template v-else>
                        <button
                          type="button"
                          class="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-40 dark:bg-primary-500 dark:hover:bg-primary-600"
                          :disabled="confirming"
                          @click="onConfirmProposal(msg.id, proposal)"
                        >
                          {{ isOverrideProposal(proposal) ? t('astra.overrideAction') : t('astra.confirmAction') }}
                        </button>
                        <button
                          type="button"
                          class="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 dark:border-white/10 dark:text-neutral-300"
                          :disabled="confirming"
                          @click="onDismissProposal(msg.id, proposal.id)"
                        >
                          {{ isOverrideProposal(proposal) ? t('astra.cancelAction') : t('astra.dismissAction') }}
                        </button>
                      </template>
                    </div>
                  </div>
                </div>
                <div v-if="msg.suggestions?.length" class="flex flex-wrap gap-1.5">
                  <button
                    v-for="(suggestion, idx) in msg.suggestions"
                    :key="`${msg.id}-s-${idx}`"
                    type="button"
                    class="rounded-full border border-neutral-200/80 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-50/60 hover:text-primary-800 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-primary-500/40 dark:hover:bg-primary-950/40 dark:hover:text-primary-200"
                    @click="onSuggestion(suggestion)"
                  >
                    {{ suggestionLabel(suggestion) }}
                  </button>
                </div>
              </div>
            </div>

            <div v-if="asking" class="flex items-center gap-3 text-sm text-neutral-500">
              <span class="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-neutral-200/70 dark:bg-neutral-900 dark:ring-white/10">
                <AstraLogo size="sm" />
              </span>
              <div class="astra-status-stage min-h-[1.25rem] min-w-0 flex-1 overflow-hidden">
                <Transition name="astra-status" mode="out-in">
                  <p
                    :key="statusLine"
                    class="truncate text-sm text-neutral-500 dark:text-neutral-400"
                  >
                    {{ statusLine }}
                  </p>
                </Transition>
              </div>
            </div>

            <p
              v-if="error"
              class="rounded-2xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-200"
            >
              {{ error }}
            </p>
          </div>
        </div>

        <!-- Composer: grouped under hero when empty; docked when in a thread -->
        <div
          :class="isEmptyLanding
            ? 'mx-auto mt-8 w-full max-w-3xl shrink-0'
            : 'shrink-0 border-t border-neutral-200/60 bg-neutral-50/95 px-3 py-3 backdrop-blur dark:border-white/[0.08] dark:bg-neutral-950/95 sm:px-6 sm:py-4'"
        >
          <div :class="isEmptyLanding ? '' : 'mx-auto w-full max-w-3xl'">
            <form
              class="flex items-end gap-2 rounded-[1.5rem] border border-neutral-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-neutral-900"
              @submit.prevent="onSend"
            >
              <textarea
                ref="inputEl"
                v-model="draft"
                rows="1"
                class="max-h-40 min-h-[2.75rem] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100"
                :placeholder="composerPlaceholder"
                :disabled="asking"
                @keydown.enter.exact.prevent="onSend"
                @input="autoGrow"
              />
              <button
                type="submit"
                class="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-35 dark:bg-primary-500 dark:hover:bg-primary-600 dark:text-white"
                :disabled="asking || !draft.trim()"
                :aria-label="t('astra.send')"
              >
                <PaperAirplaneIcon class="h-4 w-4 -rotate-45 translate-x-px" />
              </button>
            </form>
            <p class="mt-2 text-center text-[10px] text-neutral-400">{{ t('astra.composerFootnote') }}</p>
          </div>
        </div>
      </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onErrorCaptured, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  Bars3Icon,
  BriefcaseIcon,
  ChartBarIcon,
  PaperAirplaneIcon,
  TicketIcon,
  UserIcon,
} from '@heroicons/vue/24/outline';
import type { Component } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useAstraAsk, type AstraProposal, type AstraSuggestion } from '@/astra/composables/useAstraAsk';
import { useAstraConversations } from '@/astra/composables/useAstraConversations';
import { useAstraStatusLine } from '@/astra/composables/useAstraStatusLine';
import AstraMessageBlocks from '@/astra/blocks/AstraMessageBlocks.vue';
import AstraAnswerBody from '@/astra/components/AstraAnswerBody.vue';
import AstraConversationSidebar from '@/astra/components/AstraConversationSidebar.vue';
import AstraLogo from '@/astra/components/AstraLogo.vue';
import type { AstraUiBlock } from '@/astra/blocks/types';
import { resolveAstraNbaIcon } from '@/astra/utils/resolveAstraNbaIcon';

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  blocks?: AstraUiBlock[];
  proposals?: AstraProposal[];
  suggestions?: AstraSuggestion[];
  agentKey?: string;
  agentName?: string;
  href?: string;
  navigateLabel?: string;
}

interface HeroSuggestion {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  moduleKey?: string;
  recordId?: string;
  recordName?: string;
  icon: Component;
}

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { asking, confirming, error, askSync, confirmProposal, fetchNba } = useAstraAsk('copilot');
const { statusLine } = useAstraStatusLine(asking);
const {
  conversations,
  loading: historyLoading,
  loadingMore: historyLoadingMore,
  hasMore: historyHasMore,
  refresh: refreshHistory,
  loadMore: loadMoreHistory,
  loadOne,
  remove: removeConversation,
  clearAll: clearConversations,
  upsertLocal,
} = useAstraConversations();

const draft = ref('');
const messages = ref<CopilotMessage[]>([]);
const conversationId = ref<string | undefined>(undefined);
const conversationTitle = ref('');
const mobileHistoryOpen = ref(false);
const messagesEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);

/** Always mount the history rail so the grid does not jump after conversations hydrate. */
const showHistorySidebar = computed(() => true);

const isEmptyLanding = computed(
  () => !messages.value.length && !asking.value,
);
const nbaCards = ref<Array<{
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  moduleKey?: string;
  recordId?: string;
  recordName?: string;
  iconKey?: string;
}>>([]);

onErrorCaptured((err) => {
  console.error('[Astra] render error:', err);
  return false;
});

const firstName = computed(() => {
  const user = authStore.user as { firstName?: string; username?: string; email?: string } | null;
  const raw = String(user?.firstName || '').trim();
  if (raw) return raw;
  const username = String(user?.username || '').trim();
  if (username) return username.split(/[.\s_-]/)[0] || username;
  const email = String(user?.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return '';
});

const greeting = computed(() => {
  const hour = new Date().getHours();
  const name = firstName.value;
  if (hour < 12) return name ? t('astra.greetingMorningNamed', { name }) : t('astra.greetingMorning');
  if (hour < 17) return name ? t('astra.greetingAfternoonNamed', { name }) : t('astra.greetingAfternoon');
  return name ? t('astra.greetingEveningNamed', { name }) : t('astra.greetingEvening');
});

const composerPlaceholder = computed(() =>
  firstName.value ? t('astra.askPromptNamed', { name: firstName.value }) : t('astra.askPrompt'),
);

const defaultHero = computed<HeroSuggestion[]>(() => [
  { id: 'deals', title: t('astra.heroDealsTitle'), subtitle: t('astra.heroDealsSubtitle'), prompt: t('astra.starterOpenDeals'), icon: BriefcaseIcon },
  { id: 'pulse', title: t('astra.heroPulseTitle'), subtitle: t('astra.heroPulseSubtitle'), prompt: t('astra.starterPipelinePulse'), icon: ChartBarIcon },
  { id: 'cases', title: t('astra.heroCasesTitle'), subtitle: t('astra.heroCasesSubtitle'), prompt: t('astra.starterOpenCases'), icon: TicketIcon },
  { id: 'people', title: t('astra.heroPeopleTitle'), subtitle: t('astra.heroPeopleSubtitle'), prompt: t('astra.starterFindContact'), icon: UserIcon },
]);

const heroSuggestions = computed(() => {
  if (!nbaCards.value.length) return defaultHero.value;
  // Never pad with static placeholders once we have live workload cards.
  return nbaCards.value.slice(0, 4).map((card, index) => ({
    id: card.id || `nba-${index}`,
    title: card.title,
    subtitle: card.subtitle || t('astra.heroPersonalizedSubtitle'),
    prompt: card.prompt,
    moduleKey: card.moduleKey,
    recordId: card.recordId,
    recordName: card.recordName || card.title,
    icon: resolveAstraNbaIcon({
      iconKey: card.iconKey,
      moduleKey: card.moduleKey,
      title: card.title,
      label: card.title,
    }),
  }));
});

type ConversationGroupId = 'today' | 'yesterday' | 'week' | 'month' | 'older';

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function groupIdForDate(value?: string | null): ConversationGroupId {
  if (!value) return 'older';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return 'older';
  const today = startOfLocalDay(new Date());
  const day = startOfLocalDay(new Date(ts));
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'week';
  if (diffDays < 30) return 'month';
  return 'older';
}

function historyForAsk() {
  return messages.value.slice(-8).map((m) => ({ role: m.role, content: m.body }));
}

async function scrollToEnd() {
  await nextTick();
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
}

function autoGrow() {
  const el = inputEl.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

async function ask(text: string, focus: {
  moduleKey?: string;
  recordId?: string;
  recordName?: string;
} = {}) {
  const prompt = text.trim();
  if (!prompt || asking.value) return;
  messages.value.push({ id: `u-${Date.now()}`, role: 'user', body: prompt });
  await scrollToEnd();
  const result = await askSync(prompt, {
    conversationId: conversationId.value,
    history: historyForAsk().slice(0, -1),
    moduleKey: focus.moduleKey,
    recordId: focus.recordId,
    recordName: focus.recordName,
  });
  if (!result) {
    await scrollToEnd();
    return;
  }
  conversationId.value = result.conversationId;
  if (result.conversationId) {
    const title = result.conversationTitle || conversationTitle.value || prompt.slice(0, 80);
    conversationTitle.value = title;
    upsertLocal({
      id: result.conversationId,
      title,
      preview: result.answer,
      updatedAt: new Date().toISOString(),
      messageCount: messages.value.length + 1,
    });
  }
  messages.value.push({
    id: `a-${Date.now()}`,
    role: 'assistant',
    body: result.answer,
    blocks: result.blocks,
    proposals: result.proposals,
    suggestions: result.suggestions,
    agentKey: result.agentKey,
    agentName: result.agentName,
  });
  await scrollToEnd();
  await nextTick();
  inputEl.value?.focus();
}

async function onSend() {
  const text = draft.value;
  draft.value = '';
  await nextTick();
  autoGrow();
  await ask(text);
}

async function onSuggestion(suggestion: string | AstraSuggestion | {
  prompt?: string;
  moduleKey?: string;
  recordId?: string;
  recordName?: string;
  title?: string;
  label?: string;
}) {
  if (typeof suggestion === 'string') {
    const parsed = tryParseSuggestionJson(suggestion);
    if (parsed) {
      await ask(parsed.prompt, {});
      return;
    }
    await ask(suggestion);
    return;
  }
  const prompt = String(
    suggestion.prompt || suggestion.label || suggestion.title || '',
  ).trim();
  if (!prompt) return;
  await ask(prompt, {
    moduleKey: suggestion.moduleKey,
    recordId: suggestion.recordId,
    recordName: suggestion.recordName || suggestion.title || suggestion.label,
  });
}

function suggestionLabel(suggestion: AstraSuggestion): string {
  if (typeof suggestion === 'string') {
    const parsed = tryParseSuggestionJson(suggestion);
    return parsed?.label || suggestion;
  }
  return suggestion.label || suggestion.prompt;
}

function tryParseSuggestionJson(raw: string): { label: string; prompt: string } | null {
  const text = String(raw || '').trim();
  if (!text.startsWith('{')) return null;
  try {
    const obj = JSON.parse(text) as { label?: unknown; prompt?: unknown };
    const label = String(obj.label || '').trim();
    const prompt = String(obj.prompt || obj.label || '').trim();
    if (!label && !prompt) return null;
    return { label: label || prompt, prompt: prompt || label };
  } catch {
    return null;
  }
}

function isOverrideProposal(proposal: { label?: string } | null | undefined): boolean {
  return /override/i.test(String(proposal?.label || ''));
}

async function onConfirmProposal(messageId: string, proposal: AstraProposal) {
  const result = await confirmProposal(
    proposal,
    { conversationId: conversationId.value },
  );
  if (!result.ok) return;
  messages.value = messages.value.map((m) => {
    if (m.id !== messageId) return m;
    return {
      ...m,
      proposals: (m.proposals || []).map((p) => {
        if (p.id !== proposal.id) return p;
        return {
          ...p,
          status: 'completed',
          href: result.href || p.href,
          recordId: result.recordId || p.recordId,
          navigateLabel: result.navigateLabel || p.navigateLabel,
          rationale: result.message || p.rationale,
        };
      }),
    };
  });
  messages.value.push({
    id: `a-confirm-${Date.now()}`,
    role: 'assistant',
    body: result.message || t('astra.actionCompleted'),
    href: result.href,
    navigateLabel: result.navigateLabel,
  });
  await scrollToEnd();
}

function onNavigateProposal(href: string) {
  const path = String(href || '').trim();
  if (!path) return;
  void router.push(path);
}

function onDismissProposal(messageId: string, proposalId: string) {
  messages.value = messages.value.map((m) => {
    if (m.id !== messageId) return m;
    return {
      ...m,
      proposals: (m.proposals || []).filter((p) => p.id !== proposalId),
    };
  });
}

function onNewChat() {
  messages.value = [];
  conversationId.value = undefined;
  conversationTitle.value = '';
  error.value = '';
  draft.value = '';
  mobileHistoryOpen.value = false;
  void nextTick(() => {
    autoGrow();
    inputEl.value?.focus();
  });
}

async function onSelectConversation(id: string) {
  if (!id || asking.value) return;
  try {
    const detail = await loadOne(id);
    if (!detail) return;
    conversationId.value = detail.id;
    conversationTitle.value = detail.title || '';
    messages.value = (detail.messages || []).map((m, index) => ({
      id: m.id || `m-${index}`,
      role: m.role === 'assistant' ? 'assistant' : 'user',
      body: String(m.body || ''),
      blocks: Array.isArray(m.blocks) ? (m.blocks as AstraUiBlock[]) : [],
      proposals: Array.isArray(m.proposals)
        ? (m.proposals as AstraProposal[]).map((p) => ({
          ...p,
          status: p.status === 'completed' ? 'completed' : 'pending',
        }))
        : [],
      suggestions: Array.isArray(m.suggestions) ? (m.suggestions as AstraSuggestion[]) : [],
      href: m.navigate?.href,
      navigateLabel: m.navigate?.label,
    }));
  } catch (err) {
    console.error('[Astra] failed to load conversation', err);
    error.value = t('astra.failGeneric');
  }
  await nextTick();
  await scrollToEnd();
}

async function onDeleteConversation(id: string) {
  const ok = await removeConversation(id);
  if (!ok) return;
  if (conversationId.value === id) onNewChat();
}

function onLoadMoreHistory() {
  void loadMoreHistory();
}

async function onClearOlder() {
  const beforeIds = new Set(
    conversations.value
      .filter((c) => groupIdForDate(c.updatedAt || c.createdAt) !== 'today')
      .map((c) => c.id),
  );
  await clearConversations('older');
  if (conversationId.value && beforeIds.has(conversationId.value)) onNewChat();
}

onMounted(async () => {
  await Promise.all([
    refreshHistory().then(async () => {
      // Retry wipe until older threads are gone (v1 flag could stick after a failed bulk delete).
      const flag = 'astra.clearedOlder.v2';
      try {
        if (localStorage.getItem(flag) === '1') return;
      } catch {
        /* ignore */
      }
      await onClearOlder();
      const stillOlder = conversations.value.some(
        (c) => groupIdForDate(c.updatedAt || c.createdAt) !== 'today',
      );
      if (!stillOlder) {
        try {
          localStorage.setItem(flag, '1');
        } catch {
          /* ignore */
        }
      }
    }),
    fetchNba({ surface: 'home' }).then((nba) => {
      nbaCards.value = nba
        .map((item, index) => {
          const title = String(item.label || item.prompt || '').trim();
          const prompt = String(item.prompt || item.label || '').trim();
          if (!title || !prompt) return null;
          return {
            id: item.id || `nba-${index}`,
            title,
            subtitle: String(item.rationale || '').trim() || t('astra.heroPersonalizedSubtitle'),
            prompt,
            moduleKey: item.moduleKey || undefined,
            recordId: item.recordId || undefined,
            recordName: title,
            iconKey: item.iconKey || undefined,
          };
        })
        .filter((c): c is {
          id: string;
          title: string;
          subtitle: string;
          prompt: string;
          moduleKey?: string;
          recordId?: string;
          recordName?: string;
          iconKey?: string;
        } => c != null)
        .slice(0, 6);
    }),
  ]);
  inputEl.value?.focus();
});

watch(draft, () => {
  void nextTick(autoGrow);
});
</script>

<style scoped>
.astra-hero-logo {
  position: relative;
  display: inline-flex;
  isolation: isolate;
}

.astra-hero-logo :deep(img) {
  position: relative;
  z-index: 0;
  display: block;
  filter: drop-shadow(0 8px 20px rgb(15 23 42 / 0.12));
}

.astra-hero-logo::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgb(255 255 255 / 0.12) 40%,
    rgb(255 255 255 / 0.85) 50%,
    rgb(255 255 255 / 0.12) 60%,
    transparent 100%
  );
  background-size: 220% 100%;
  animation: astra-hero-logo-shimmer 2.8s linear infinite;
  pointer-events: none;
  /* Clip shine to logo silhouette only */
  -webkit-mask-image: url('/assets/logo/Ai%20Logo.svg');
  mask-image: url('/assets/logo/Ai%20Logo.svg');
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  will-change: background-position;
}

html.dark .astra-hero-logo::after {
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgb(255 255 255 / 0.1) 40%,
    rgb(255 255 255 / 0.7) 50%,
    rgb(255 255 255 / 0.1) 60%,
    transparent 100%
  );
  background-size: 220% 100%;
}

@keyframes astra-hero-logo-shimmer {
  0% {
    background-position: 140% 0;
  }
  100% {
    background-position: -40% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .astra-hero-logo::after {
    animation: none;
    opacity: 0;
  }
}

.astra-status-enter-active,
.astra-status-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.astra-status-enter-from {
  opacity: 0;
  transform: translateY(0.45rem);
}

.astra-status-leave-to {
  opacity: 0;
  transform: translateY(-0.45rem);
}

.astra-status-enter-to,
.astra-status-leave-from {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .astra-status-enter-active,
  .astra-status-leave-active {
    transition: none;
  }
}
</style>

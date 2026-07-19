<template>
  <div class="astra-full relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
    <div class="relative flex min-h-0 flex-1 flex-row overflow-hidden">
      <div class="astra-full__atmosphere pointer-events-none absolute inset-0" aria-hidden="true">
        <div class="astra-full__orb astra-full__orb--a" />
        <div class="astra-full__orb astra-full__orb--b" />
        <div class="astra-full__orb astra-full__orb--c" />
        <div class="astra-full__veil" />
      </div>

      <button
        v-if="railOpen"
        type="button"
        class="absolute inset-0 z-[30] bg-black/40 md:hidden"
        :aria-label="t('navigation.closeSidebar')"
        @click="railOpen = false"
      />

      <aside
        class="astra-rail z-[40] flex h-full min-h-0 w-[15rem] shrink-0 flex-col self-stretch
          max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:shadow-xl max-md:transition-transform max-md:duration-200
          md:relative md:z-[1] md:translate-x-0"
        :class="railOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'"
      >
        <div class="flex shrink-0 items-center justify-between gap-2 px-3.5 pb-2 pt-3.5">
          <h2 class="truncate text-[13px] font-semibold tracking-tight text-neutral-800 dark:text-neutral-100">
            {{ t('liveChat.inAppTitle') }}
          </h2>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="astra-rail__new inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
              @click="onNewChat"
            >
              <PlusIcon class="h-3 w-3" aria-hidden="true" />
              {{ t('liveChat.astraFullPageNewChat') }}
            </button>
            <button
              type="button"
              class="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5 hover:text-neutral-800 md:hidden dark:hover:bg-white/10 dark:hover:text-neutral-100"
              :aria-label="t('navigation.closeSidebar')"
              @click="railOpen = false"
            >
              <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-1">
          <p class="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            {{ t('liveChat.astraFullPageRecentChats') }}
          </p>
          <ul v-if="sidebarConversations.length" class="space-y-0.5">
            <li
              v-for="item in sidebarConversations"
              :key="item.id"
            >
              <button
                type="button"
                class="astra-rail__item group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left"
                :class="activeConversationId === item.id ? 'astra-rail__item--active' : ''"
                @click="void onOpenConversation(item.id)"
              >
                <span class="astra-rail__dot shrink-0" aria-hidden="true" />
                <span class="min-w-0 flex-1 truncate text-[12.5px] text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-300 dark:group-hover:text-white">
                  {{ item.title || t('liveChat.inAppAiNewConversationTitle') }}
                </span>
              </button>
            </li>
          </ul>
          <p
            v-else
            class="px-2 py-8 text-center text-[12px] text-neutral-400"
          >
            {{ t('liveChat.inAppAiConversationsEmpty') }}
          </p>
        </div>
      </aside>

      <main class="relative z-[1] flex h-full min-h-0 min-w-0 flex-1 flex-col self-stretch">
        <div class="absolute left-3 top-3 z-[2] md:hidden">
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/90 text-neutral-700 shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-neutral-900/90 dark:text-neutral-200 dark:hover:bg-neutral-900"
            :aria-label="t('liveChat.astraFullPageRecentChats')"
            :aria-expanded="railOpen"
            @click="railOpen = true"
          >
            <Bars3Icon class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <!-- Landing (Brain²-style) -->
        <div
          v-if="!aiMessages.length && !aiAsking"
          class="astra-landing arivu-scrollbar flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain px-6"
        >
          <div class="my-auto flex w-full max-w-[44rem] flex-col items-center py-10 pt-14 md:pt-10">
            <div class="flex flex-col items-center">
              <img
                src="/assets/logo/Ai%20Logo.svg"
                alt=""
                class="h-12 w-12 object-contain sm:h-14 sm:w-14"
                aria-hidden="true"
              />
              <h1 class="mt-3 text-[1.75rem] font-semibold tracking-[-0.03em] text-neutral-800 dark:text-neutral-50 sm:text-[2rem]">
                {{ t('liveChat.inAppTitle') }}
              </h1>
            </div>

            <form
              class="mt-7 w-full"
              @submit.prevent="onSend"
            >
              <div class="astra-board">
                <div class="astra-composer-field relative">
                  <textarea
                    ref="composerEl"
                    v-model="draft"
                    rows="3"
                    class="relative z-[1] min-h-[4.75rem] w-full resize-none border-0 bg-transparent px-1 py-0.5 text-[15px] leading-relaxed text-neutral-800 placeholder:text-transparent focus:outline-none focus:ring-0 dark:text-neutral-100"
                    :placeholder="composerPlaceholder"
                    :disabled="aiAsking || !!typingMessageId"
                    @keydown.enter.exact.prevent="onSend"
                  />
                  <div
                    v-if="!draft.trim()"
                    class="astra-ph-stage pointer-events-none absolute inset-x-1 top-0.5 z-0 overflow-hidden"
                    aria-hidden="true"
                  >
                    <Transition
                      name="astra-ph"
                      mode="out-in"
                    >
                      <p
                        :key="placeholderIndex"
                        class="astra-ph-line text-[15px] leading-relaxed text-neutral-400 dark:text-neutral-500"
                      >
                        {{ composerPlaceholder }}
                      </p>
                    </Transition>
                  </div>
                </div>

                <div class="mt-2 flex items-center justify-end gap-1.5">
                  <span class="astra-model inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-neutral-600 dark:text-neutral-300">
                    <img
                      src="/assets/logo/Ai%20Logo.svg"
                      alt=""
                      class="h-3.5 w-3.5 object-contain"
                      aria-hidden="true"
                    />
                    {{ t('liveChat.inAppTitle') }}
                  </span>
                  <button
                    type="submit"
                    class="astra-send flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                    :disabled="aiAsking || !!typingMessageId || !draft.trim()"
                    :aria-label="t('actions.send')"
                  >
                    <PaperAirplaneIcon class="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </form>

            <div class="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button
                v-for="card in suggestionCards"
                :key="card.id"
                type="button"
                class="astra-card group text-left"
                @click="onSuggestion(card.prompt)"
              >
                <span class="astra-card__icon">
                  <component
                    :is="card.icon"
                    class="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                </span>
                <span class="astra-card__title">{{ card.title }}</span>
                <span class="astra-card__hint">{{ card.hint }}</span>
                <span class="astra-card__reason">{{ card.reason }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Thread -->
        <template v-else>
          <div
            ref="messagesEl"
            class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-12"
          >
            <div class="mx-auto w-full max-w-[42rem] space-y-7">
              <div
                v-for="msg in aiMessages"
                :key="msg.id"
                class="flex"
                :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <div
                  v-if="msg.role === 'user'"
                  class="astra-user-bubble max-w-[82%] px-4 py-2.5 text-[14px] text-neutral-900 dark:text-neutral-100"
                >
                  <p class="whitespace-pre-wrap break-words">{{ msg.body }}</p>
                </div>
                <div
                  v-else
                  class="max-w-[94%] text-[14px] text-neutral-900 dark:text-neutral-100"
                >
                  <div class="mb-2.5 flex items-center gap-2">
                    <img
                      src="/assets/logo/Ai%20Logo.svg"
                      alt=""
                      class="h-4 w-4 object-contain"
                      aria-hidden="true"
                    />
                    <span class="text-[13px] font-semibold tracking-tight">
                      {{ t('liveChat.inAppTitle') }}
                    </span>
                  </div>
                  <template v-if="hasStructured(msg)">
                    <div class="rounded-2xl border border-neutral-200/80 bg-white/90 p-4 shadow-sm shadow-neutral-900/[0.04] backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/70 dark:shadow-none">
                      <p
                        v-if="msg.structured?.headline || showTypingCaret(msg)"
                        class="text-[15px] font-semibold leading-snug tracking-tight text-neutral-900 dark:text-white"
                      >
                        {{ displayHeadline(msg) }}
                      </p>
                      <ul
                        v-if="displayBullets(msg).length"
                        class="mt-3 space-y-2"
                      >
                        <li
                          v-for="(bullet, idx) in displayBullets(msg)"
                          :key="`${msg.id}-b-${idx}`"
                          class="flex gap-2.5 text-[13.5px] leading-snug text-neutral-700 dark:text-neutral-200"
                        >
                          <span
                            class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600 dark:bg-primary-300"
                            aria-hidden="true"
                          />
                          <span>{{ bullet }}</span>
                        </li>
                      </ul>
                      <div
                        v-if="displayVisuals(msg).length"
                        class="mt-1"
                      >
                        <AstraVisualStack :visuals="displayVisuals(msg)" />
                      </div>
                      <Disclosure
                        v-if="displayDetail(msg)"
                        v-slot="{ open }"
                        as="div"
                        class="mt-3"
                        :default-open="displayDetail(msg).length < 280"
                      >
                        <DisclosureButton
                          class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary-800 transition hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-500/10"
                        >
                          {{ open ? t('liveChat.astraHideDetails') : t('liveChat.astraShowDetails') }}
                          <ChevronDownIcon
                            class="h-3.5 w-3.5 transition-transform"
                            :class="open ? 'rotate-180' : ''"
                            aria-hidden="true"
                          />
                        </DisclosureButton>
                        <DisclosurePanel
                          class="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-700 dark:text-neutral-200"
                        >
                          {{ displayDetail(msg) }}
                        </DisclosurePanel>
                      </Disclosure>
                      <div
                        v-if="assistantActions(msg).length"
                        class="mt-3 space-y-2"
                      >
                        <p class="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
                          {{ t('liveChat.inAppAiNextActions') }}
                        </p>
                        <button
                          v-for="(action, aIdx) in assistantActions(msg)"
                          :key="`${msg.id}-a-${aIdx}`"
                          type="button"
                          class="inline-flex w-full flex-col gap-1 rounded-xl border border-primary-200 bg-white px-3 py-2.5 text-left text-primary-900 transition hover:bg-primary-50 disabled:cursor-wait disabled:opacity-60 dark:border-primary-500/40 dark:bg-neutral-900 dark:text-primary-100 dark:hover:bg-primary-500/10"
                          :disabled="mutationBusy"
                          @click="void onAssistantAction(action, msg)"
                        >
                          <span class="text-xs font-semibold leading-snug">{{ action.label }}</span>
                          <span
                            v-if="action.rationale"
                            class="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400"
                          >
                            {{ action.rationale }}
                          </span>
                        </button>
                      </div>
                    </div>
                  </template>
                  <p
                    v-else
                    class="whitespace-pre-wrap break-words text-[14px] leading-relaxed"
                  >
                    {{ displayBody(msg) }}
                  </p>
                </div>
              </div>

              <div
                v-if="aiAsking"
                class="flex items-center gap-2.5 text-[13px] text-neutral-500"
              >
                <img
                  src="/assets/logo/Ai%20Logo.svg"
                  alt=""
                  class="h-4 w-4 animate-pulse object-contain"
                  aria-hidden="true"
                />
                <span>{{ astraWorkingLabel }}</span>
              </div>

              <p
                v-if="aiError"
                class="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-200"
              >
                {{ aiError }}
              </p>
            </div>
          </div>

          <div class="shrink-0 px-6 pb-6 pt-2 sm:px-12">
            <form
              class="mx-auto w-full max-w-[42rem]"
              @submit.prevent="onSend"
            >
              <div class="astra-board astra-board--compact">
                <textarea
                  v-model="draft"
                  rows="2"
                  class="min-h-[2.75rem] w-full resize-none border-0 bg-transparent text-[14px] leading-relaxed text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-0 dark:text-neutral-100"
                  :placeholder="t('liveChat.astraFullPagePlaceholder')"
                  :disabled="aiAsking || !!typingMessageId"
                  @keydown.enter.exact.prevent="onSend"
                />
                <div class="mt-1.5 flex items-center justify-end">
                  <button
                    type="submit"
                    class="astra-send flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                    :disabled="aiAsking || !!typingMessageId || !draft.trim()"
                    :aria-label="t('actions.send')"
                  >
                    <PaperAirplaneIcon class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Bars3Icon,
  ChevronDownIcon,
  PaperAirplaneIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import AstraVisualStack from '@/components/support/AstraVisualStack.vue';
import { usePlatformHome } from '@/composables/usePlatformHome';
import {
  useInProductAiAsk,
  type InAppAiAction,
  type InAppAiMessage,
} from '@/composables/useInProductAiAsk';
import { buildAstraRecommendations } from '@/utils/buildAstraRecommendations';
import type { AstraRecommendationSnapshot } from '@/utils/buildAstraRecommendations';
import { openContentStudioFromAstraAction } from '@/utils/openContentStudioFromAstra';
import { openArivuCanvasFromAstraAction } from '@/utils/openArivuCanvasFromAstra';
import {
  openReportBuilderFromAstraAction,
  openReportFromAstraAction,
  publishReportFromAstraAction,
  exportReportFromAstraAction,
  pinReportFromAstraAction,
  openWidgetFromAstraAction,
  openDashboardFromAstraAction,
} from '@/utils/openReportFromAstra';
import { resolveModuleRecordRoute } from '@/utils/resolveModuleRecordRoute';
import { resolvePageAiContext } from '@/utils/resolvePageAiContext';
import apiClient from '@/utils/apiClient';
import { useRouter, useRoute } from 'vue-router';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const draft = ref('');
const composerEl = ref<HTMLTextAreaElement | null>(null);
const messagesEl = ref<HTMLElement | null>(null);
const placeholderIndex = ref(0);
const mutationBusy = ref(false);
/** Mobile chat history drawer; always visible as a side rail from md up. */
const railOpen = ref(false);
let placeholderTimer: ReturnType<typeof setInterval> | null = null;
let railMq: MediaQueryList | null = null;

function onRailMqChange(e: MediaQueryListEvent | MediaQueryList) {
  if (e.matches) railOpen.value = false;
}

function closeRailOnMobile() {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
    railOpen.value = false;
  }
}

const COMPOSER_PLACEHOLDER_INTERVAL_MS = 3200;
const composerPlaceholderKeys = [
  'liveChat.astraFullPageComposerHint',
  'liveChat.astraPlaceholderPrioritize',
  'liveChat.astraPlaceholderSummarize',
  'liveChat.astraPlaceholderPrepare',
  'liveChat.astraPlaceholderDraft',
  'liveChat.astraPlaceholderFind',
];
const composerPlaceholder = computed(() => {
  const key = composerPlaceholderKeys[placeholderIndex.value]
    ?? 'liveChat.astraFullPageComposerHint';
  return t(key);
});

const {
  aiMessages,
  aiAsking,
  aiError,
  allAiConversations,
  activeConversationId,
  typingMessageId,
  askAssistant,
  startNewConversation,
  openConversation,
  displayHeadline,
  displayBody,
  displayBullets,
  displayDetail,
  displayVisuals,
  showTypingCaret,
} = useInProductAiAsk();

/** Full page rail shows every stored chat — not the hub’s compact top-12. */
const sidebarConversations = allAiConversations;

const { snapshot, fetchSnapshot } = usePlatformHome();

const suggestionCards = computed(() => buildAstraRecommendations(
  snapshot.value as AstraRecommendationSnapshot,
  t,
));

const ASTRA_WORKING_KEYS = [
  'liveChat.inAppAiWorking',
  'liveChat.inAppAiWorkingOnIt',
  'liveChat.inAppAiWorkingGathering',
  'liveChat.inAppAiWorkingAnalyzing',
  'liveChat.inAppAiWorkingDigging',
  'liveChat.inAppAiWorkingAlmost',
];
const astraWorkingLabel = ref(t('liveChat.inAppAiWorking'));

watch(aiAsking, (asking) => {
  if (!asking) return;
  const key = ASTRA_WORKING_KEYS[Math.floor(Math.random() * ASTRA_WORKING_KEYS.length)]
    ?? 'liveChat.inAppAiWorking';
  astraWorkingLabel.value = t(key);
});

function hasStructured(msg: InAppAiMessage): boolean {
  return Boolean(msg?.structured && typeof msg.structured === 'object');
}

function assistantActions(msg: InAppAiMessage): InAppAiAction[] {
  const actions = msg?.structured?.actions;
  return Array.isArray(actions) ? actions.filter((a) => a?.label) : [];
}

async function onAssistantAction(action: InAppAiAction, msg?: InAppAiMessage) {
  if (!action) return;
  const kind = String(action.kind || '');
  if (kind === 'open_canvas') {
    const result = await openArivuCanvasFromAstraAction(router, action, {
      fallbackDetail: String(msg?.structured?.detail || ''),
      fallbackHeadline: String(msg?.structured?.headline || ''),
    });
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiCanvasOpenFailed');
    }
    return;
  }
  if (kind === 'open_content_studio' || kind === 'draft_deck') {
    const result = await openContentStudioFromAstraAction(router, action, {
      fallbackDetail: String(msg?.structured?.detail || ''),
    });
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiContentStudioOpenFailed');
    }
    return;
  }
  if (kind === 'open_report_builder') {
    const result = await openReportBuilderFromAstraAction(router, action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiReportOpenFailed');
    }
    return;
  }
  if (kind === 'open_report') {
    const result = await openReportFromAstraAction(router, action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiReportOpenFailed');
    }
    return;
  }
  if (kind === 'publish_report') {
    mutationBusy.value = true;
    aiError.value = '';
    try {
      const result = await publishReportFromAstraAction(router, action);
      if (!result.ok) {
        aiError.value = result.error || t('liveChat.inAppAiReportPublishFailed');
        return;
      }
      aiMessages.value.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        body: t('liveChat.inAppAiReportPublished'),
        source: 'agent',
        createdAt: Date.now(),
      });
      await scrollMessages();
    } finally {
      mutationBusy.value = false;
    }
    return;
  }
  if (kind === 'export_report') {
    mutationBusy.value = true;
    aiError.value = '';
    try {
      const result = await exportReportFromAstraAction(action);
      if (!result.ok) {
        aiError.value = result.error || t('liveChat.inAppAiReportExportFailed');
        return;
      }
      aiMessages.value.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        body: t('liveChat.inAppAiReportExported'),
        source: 'agent',
        createdAt: Date.now(),
      });
      await scrollMessages();
    } finally {
      mutationBusy.value = false;
    }
    return;
  }
  if (kind === 'pin_report_to_dashboard') {
    mutationBusy.value = true;
    aiError.value = '';
    try {
      const result = await pinReportFromAstraAction(router, action);
      if (!result.ok) {
        aiError.value = result.error || t('liveChat.inAppAiReportPinFailed');
        return;
      }
      aiMessages.value.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        body: t('liveChat.inAppAiReportPinned', { name: result.dashboardName || 'dashboard' }),
        source: 'agent',
        createdAt: Date.now(),
      });
      await scrollMessages();
    } finally {
      mutationBusy.value = false;
    }
    return;
  }
  if (kind === 'open_widget') {
    const result = await openWidgetFromAstraAction(router, action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiWidgetOpenFailed');
    }
    return;
  }
  if (kind === 'open_dashboard') {
    const result = await openDashboardFromAstraAction(router, action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiDashboardOpenFailed');
    }
    return;
  }

  if (kind === 'create_record' || kind === 'update_record') {
    if (mutationBusy.value) return;
    const moduleKey = String(action.moduleKey || '').trim().toLowerCase();
    const fields: Record<string, string | number | boolean> = (
      action.fields && typeof action.fields === 'object' ? { ...action.fields } : {}
    );
    if (!moduleKey || !Object.keys(fields).length) {
      aiError.value = t('liveChat.inAppAiMutationIncomplete');
      await scrollMessages();
      return;
    }
    const lastUser = [...aiMessages.value].reverse().find((m) => m.role === 'user');
    const forcePhrase = /\b(force\s+create|create\s+anyway|create\s+a\s+new\s+one|duplicate\s+ok|new\s+meeting\s+anyway)\b/i
      .test(String(lastUser?.body || ''));
    if (forcePhrase) {
      fields.forceCreate = true;
      fields.forceCreateReason = String(lastUser?.body || 'create anyway');
    }
    const page = resolvePageAiContext(route);
    mutationBusy.value = true;
    aiError.value = '';
    try {
      const data = await apiClient.post('/ai/astra/mutations/apply', {
        op: kind === 'create_record' ? 'create' : 'update',
        moduleKey,
        recordId: action.recordId || '',
        fields,
        appKey: page?.appKey || 'SALES',
        pageModuleKey: page?.moduleKey || '',
        pageRecordId: page?.kind === 'record' ? (page.recordId || '') : '',
      }) as { recordId?: string; success?: boolean };
      const rid = data?.recordId ? String(data.recordId) : '';
      aiMessages.value.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        body: kind === 'create_record'
          ? t('liveChat.inAppAiMutationCreated', { module: moduleKey, id: rid })
          : t('liveChat.inAppAiMutationUpdated', { module: moduleKey, id: rid || action.recordId || '' }),
        source: 'agent',
        createdAt: Date.now(),
      });
      await scrollMessages();
      if (kind === 'create_record' && rid) {
        const dest = resolveModuleRecordRoute(moduleKey, rid);
        if (dest?.name) await router.push({ name: dest.name, params: dest.params });
        else if (dest?.path) await router.push(dest.path);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { code?: string; message?: string; details?: { duplicates?: Array<{ moduleKey?: string; recordId?: string; label?: string }> } } }; message?: string };
      const code = e?.response?.data?.code || '';
      const msg = e?.response?.data?.message || e?.message || t('liveChat.inAppAiMutationFailed');
      aiError.value = String(msg);
      if (code === 'AI_ASTRA_DUPLICATE') {
        const dup = e?.response?.data?.details?.duplicates?.[0];
        if (dup?.moduleKey && dup?.recordId) {
          aiMessages.value.push({
            id: `a-${Date.now()}`,
            role: 'assistant',
            body: t('liveChat.inAppAiDuplicateBlocked', {
              label: dup.label || 'existing record',
            }),
            source: 'agent',
            createdAt: Date.now(),
            structured: {
              headline: t('liveChat.inAppAiDuplicateHeadline'),
              bullets: [
                t('liveChat.inAppAiDuplicateBlocked', { label: dup.label || 'existing record' }),
                t('liveChat.inAppAiDuplicateCreateAnyway'),
              ],
              actions: [{
                label: t('liveChat.inAppAiDuplicateOpenExisting', { label: dup.label || 'record' }),
                kind: 'review_record',
                moduleKey: dup.moduleKey,
                recordId: dup.recordId,
                priority: 'high',
              }],
              detail: '',
            },
          });
        }
      }
      await scrollMessages();
    } finally {
      mutationBusy.value = false;
    }
    return;
  }

  if (kind === 'send_email' || action.email?.subject || action.email?.body || action.email?.to) {
    window.dispatchEvent(new CustomEvent('arivu:open-email-compose', {
      detail: {
        to: String(action.email?.to || '').trim(),
        subject: String(action.email?.subject || action.label || '').trim(),
        body: String(action.email?.body || '').trim(),
        relatedModuleKey: action.moduleKey || '',
        relatedRecordId: action.recordId || '',
      },
    }));
    return;
  }

  const moduleKey = String(action.moduleKey || '').trim().toLowerCase();
  const recordId = String(action.recordId || '').trim();
  const navigableKinds = new Set([
    'complete_task',
    'review_record',
    'follow_up',
    'update_status',
    'open_record',
  ]);
  if (moduleKey && recordId && navigableKinds.has(kind)) {
    const dest = resolveModuleRecordRoute(moduleKey, recordId);
    if (!dest) return;
    if (dest.name) await router.push({ name: dest.name, params: dest.params });
    else if (dest.path) await router.push(dest.path);
    return;
  }

  if (kind === 'talk_to_agent') {
    return;
  }
}

async function scrollMessages() {
  await nextTick();
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  }
}

async function maybeAutoOpenCanvas(msg?: InAppAiMessage | null) {
  const actions = msg?.structured?.actions;
  if (!Array.isArray(actions)) return;
  // Never steal focus from Report Builder / widget flows (sticky canvas history).
  const hasReportFlow = actions.some((a) => {
    const k = String(a?.kind || '');
    return k === 'open_report_builder'
      || k === 'open_report'
      || k === 'publish_report'
      || k === 'export_report'
      || k === 'pin_report_to_dashboard'
      || k === 'open_widget'
      || k === 'open_dashboard';
  });
  if (hasReportFlow) return;
  const lastUser = [...aiMessages.value].reverse().find((m) => m.role === 'user');
  const userQ = String(lastUser?.body || '').toLowerCase();
  if (/\b(report|matrix|metrix|pivot|widget|chart|dashboard)\b/.test(userQ)) return;

  const canvasAction = actions.find((a) => {
    if (String(a?.kind || '') !== 'open_canvas') return false;
    if (a.executeNow) return true;
    const fields = a.fields && typeof a.fields === 'object' ? a.fields : {};
    return Boolean((fields as Record<string, unknown>).autoOpen);
  });
  if (!canvasAction) return;
  const fields = canvasAction.fields && typeof canvasAction.fields === 'object'
    ? canvasAction.fields as Record<string, unknown>
    : {};
  if (!canvasAction.executeNow && !fields.autoOpen) return;
  await onAssistantAction(canvasAction, msg || undefined);
}

async function maybeAutoOpenReportBuilder(msg?: InAppAiMessage | null) {
  const actions = msg?.structured?.actions;
  if (!Array.isArray(actions)) return;
  const reportAction = actions.find((a) => {
    if (String(a?.kind || '') !== 'open_report_builder') return false;
    if (a.executeNow) return true;
    const fields = a.fields && typeof a.fields === 'object' ? a.fields : {};
    return Boolean((fields as Record<string, unknown>).autoOpen);
  });
  if (!reportAction) return;
  const fields = reportAction.fields && typeof reportAction.fields === 'object'
    ? reportAction.fields as Record<string, unknown>
    : {};
  if (!reportAction.executeNow && !fields.autoOpen) return;
  await onAssistantAction(reportAction, msg || undefined);
}

async function maybeAutoOpenWidget(msg?: InAppAiMessage | null) {
  const actions = msg?.structured?.actions;
  if (!Array.isArray(actions)) return;
  const widgetAction = actions.find((a) => {
    if (String(a?.kind || '') !== 'open_widget') return false;
    if (a.executeNow) return true;
    const fields = a.fields && typeof a.fields === 'object' ? a.fields : {};
    return Boolean((fields as Record<string, unknown>).autoOpen);
  });
  if (!widgetAction) return;
  const fields = widgetAction.fields && typeof widgetAction.fields === 'object'
    ? widgetAction.fields as Record<string, unknown>
    : {};
  if (!widgetAction.executeNow && !fields.autoOpen) return;
  await onAssistantAction(widgetAction, msg || undefined);
}

async function onSend() {
  const text = draft.value.trim();
  if (!text || aiAsking.value || typingMessageId.value) return;
  draft.value = '';
  await askAssistant(text);
  await scrollMessages();
  const last = [...aiMessages.value].reverse().find((m) => m.role === 'assistant');
  // Prefer report/widget auto-open; canvas only if no analytics intent.
  await maybeAutoOpenReportBuilder(last || null);
  await maybeAutoOpenWidget(last || null);
  await maybeAutoOpenCanvas(last || null);
}

async function onSuggestion(prompt: string) {
  const text = String(prompt || '').trim();
  if (!text) return;
  draft.value = text;
  await onSend();
}

async function onNewChat() {
  await startNewConversation();
  draft.value = '';
  closeRailOnMobile();
  await nextTick();
  composerEl.value?.focus();
}

async function onOpenConversation(id: string) {
  const ok = await openConversation(id);
  if (!ok) return;
  closeRailOnMobile();
  await scrollMessages();
}

watch(
  () => [aiMessages.value.length, aiAsking.value, typingMessageId.value],
  () => {
    void scrollMessages();
  },
);

onMounted(() => {
  composerEl.value?.focus();
  void fetchSnapshot();
  if (typeof window !== 'undefined') {
    railMq = window.matchMedia('(min-width: 768px)');
    onRailMqChange(railMq);
    railMq.addEventListener('change', onRailMqChange);
  }
  placeholderTimer = setInterval(() => {
    if (draft.value) return;
    placeholderIndex.value = (placeholderIndex.value + 1) % composerPlaceholderKeys.length;
  }, COMPOSER_PLACEHOLDER_INTERVAL_MS);

  const seeded = typeof route.query.q === 'string' ? route.query.q.trim() : '';
  if (seeded && !aiMessages.value.length && !aiAsking.value) {
    void askAssistant(seeded).then(async () => {
      await scrollMessages();
      const last = [...aiMessages.value].reverse().find((m) => m.role === 'assistant');
      await maybeAutoOpenReportBuilder(last || null);
      await maybeAutoOpenWidget(last || null);
      await maybeAutoOpenCanvas(last || null);
    });
  }
});

onBeforeUnmount(() => {
  if (placeholderTimer) clearInterval(placeholderTimer);
  railMq?.removeEventListener('change', onRailMqChange);
  railMq = null;
});
</script>

<style scoped>
.astra-full {
  --astra-c1: #8e2ef7;
  --astra-c2: #3277fe;
  --astra-c3: #06d0fa;
  --astra-c4: #d633eb;
  --astra-c5: #ff4e66;
  background: #ffffff;
  min-height: 0;
  height: 100%;
  max-height: 100%;
}

.astra-full__atmosphere {
  overflow: hidden;
}

.astra-full__orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(72px);
  opacity: 0.5;
}

.astra-full__orb--a {
  top: -6%;
  left: 32%;
  width: 26rem;
  height: 14rem;
  background: radial-gradient(circle, rgba(255, 168, 184, 0.55), transparent 70%);
}

.astra-full__orb--b {
  top: -4%;
  left: 48%;
  width: 22rem;
  height: 12rem;
  background: radial-gradient(circle, rgba(196, 181, 253, 0.5), transparent 70%);
}

.astra-full__orb--c {
  top: -2%;
  right: 18%;
  width: 18rem;
  height: 11rem;
  background: radial-gradient(circle, rgba(147, 197, 253, 0.45), transparent 70%);
}

.astra-full__veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.75) 36%,
    #ffffff 72%
  );
}

.astra-rail {
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(12px);
}

/* Mobile drawer: opaque so the dim backdrop does not wash the rail out. */
@media (max-width: 767px) {
  .astra-rail {
    background: #ffffff;
    backdrop-filter: none;
  }
}

.astra-rail__new {
  color: #525252;
  background: rgba(0, 0, 0, 0.04);
}

.astra-rail__new:hover {
  background: rgba(0, 0, 0, 0.07);
}

.astra-rail__dot {
  width: 5px;
  height: 5px;
  border-radius: 9999px;
  background: linear-gradient(135deg, var(--astra-c1), var(--astra-c2), var(--astra-c5));
  opacity: 0.4;
}

.astra-rail__item:hover {
  background: rgba(0, 0, 0, 0.035);
}

.astra-rail__item--active {
  background: rgba(142, 46, 247, 0.07);
}

.astra-rail__item--active .astra-rail__dot {
  opacity: 1;
}

.astra-landing {
  min-height: 0;
}

/* Brain²-style composer board */
.astra-board {
  position: relative;
  border-radius: 1.5rem;
  padding: 0.85rem 1rem 0.9rem;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(
      120deg,
      rgba(251, 182, 206, 0.85),
      rgba(196, 181, 253, 0.8),
      rgba(147, 197, 253, 0.85),
      rgba(251, 182, 206, 0.85)
    ) border-box;
  border: 1.5px solid transparent;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 16px 40px -28px rgba(88, 28, 135, 0.22);
}

.astra-ph-stage {
  perspective: 480px;
}

.astra-ph-line {
  transform-origin: 50% 50%;
  backface-visibility: hidden;
  will-change: transform, opacity;
}

.astra-ph-enter-active,
.astra-ph-leave-active {
  transition:
    opacity 0.38s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.38s cubic-bezier(0.22, 1, 0.36, 1);
}

.astra-ph-enter-from {
  opacity: 0;
  transform: translateY(10px) rotateX(-28deg);
}

.astra-ph-leave-to {
  opacity: 0;
  transform: translateY(-10px) rotateX(28deg);
}

.astra-ph-enter-to,
.astra-ph-leave-from {
  opacity: 1;
  transform: translateY(0) rotateX(0deg);
}

@media (prefers-reduced-motion: reduce) {
  .astra-ph-enter-active,
  .astra-ph-leave-active {
    transition: opacity 0.2s ease;
  }

  .astra-ph-enter-from,
  .astra-ph-leave-to {
    transform: none;
  }
}

.astra-board--compact {
  border-radius: 1.25rem;
  padding: 0.8rem 0.95rem 0.75rem;
}

.astra-model {
  border-radius: 9999px;
}

.astra-send {
  color: #fff;
  background: #171717;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.astra-send:hover:not(:disabled) {
  transform: translateY(-1px);
}

.astra-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: 0;
  border-radius: 0.85rem;
  padding: 0.75rem 0.8rem 0.7rem;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.astra-card:hover {
  border-color: rgba(0, 0, 0, 0.1);
  background: #fcfcfc;
  box-shadow: 0 8px 20px -16px rgba(15, 23, 42, 0.28);
  transform: translateY(-1px);
}

.astra-card__icon {
  display: inline-flex;
  height: 1.65rem;
  width: 1.65rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: #737373;
  background: rgba(0, 0, 0, 0.04);
}

.astra-card:hover .astra-card__icon {
  color: #525252;
  background: rgba(0, 0, 0, 0.06);
}

.astra-card__title {
  margin-top: 0.55rem;
  display: block;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  color: #262626;
}

.astra-card__hint {
  margin-top: 0.25rem;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  min-height: 2.1em;
  font-size: 12px;
  line-height: 1.35;
  color: #737373;
}

.astra-card__reason {
  margin-top: 0.55rem;
  display: block;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  color: #8a8a8a;
  letter-spacing: 0.01em;
}

.astra-user-bubble {
  border-radius: 1.15rem;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 8px 24px -18px rgba(15, 23, 42, 0.35);
}
</style>

<style>
/* Unscoped: Vue scoped :global(html.dark) compiles onto <html>, so dark overrides never apply. */
/* Match PlatformShell work panel: dark:bg-neutral-900 (#111827). */
html.dark .astra-full {
  background: var(--color-neutral-900);
}

html.dark .astra-full__veil {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-neutral-900) 25%, transparent) 0%,
    color-mix(in srgb, var(--color-neutral-900) 80%, transparent) 40%,
    var(--color-neutral-900) 100%
  );
}

html.dark .astra-full__orb {
  opacity: 0.28;
}

html.dark .astra-rail {
  border-right-color: rgba(255, 255, 255, 0.06);
  background: color-mix(in srgb, var(--color-neutral-900) 72%, transparent);
}

@media (max-width: 767px) {
  html.dark .astra-rail {
    background: var(--color-neutral-900);
    backdrop-filter: none;
  }
}

html.dark .astra-rail__new {
  color: #d4d4d4;
  background: rgba(255, 255, 255, 0.06);
}

html.dark .astra-rail__item:hover {
  background: rgba(255, 255, 255, 0.04);
}

html.dark .astra-rail__item--active {
  background: rgba(142, 46, 247, 0.14);
}

html.dark .astra-board {
  background:
    linear-gradient(var(--color-neutral-800), var(--color-neutral-800)) padding-box,
    linear-gradient(
      120deg,
      rgba(255, 78, 102, 0.45),
      rgba(142, 46, 247, 0.5),
      rgba(50, 119, 254, 0.45)
    ) border-box;
  box-shadow: 0 16px 40px -24px rgba(0, 0, 0, 0.55);
}

html.dark .astra-send {
  color: #111;
  background: #f5f5f5;
}

html.dark .astra-card {
  background: color-mix(in srgb, var(--color-neutral-800) 92%, transparent);
  border-color: rgba(255, 255, 255, 0.08);
}

html.dark .astra-card:hover {
  background: var(--color-neutral-800);
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow: none;
}

html.dark .astra-card__icon {
  color: #a3a3a3;
  background: rgba(255, 255, 255, 0.06);
}

html.dark .astra-card:hover .astra-card__icon {
  color: #d4d4d4;
  background: rgba(255, 255, 255, 0.09);
}

html.dark .astra-card__title {
  color: #f5f5f5;
}

html.dark .astra-card__hint {
  color: #a3a3a3;
}

html.dark .astra-card__reason {
  color: #8b8b8b;
}

html.dark .astra-user-bubble {
  background: color-mix(in srgb, var(--color-neutral-800) 92%, transparent);
  border-color: rgba(255, 255, 255, 0.08);
}
</style>

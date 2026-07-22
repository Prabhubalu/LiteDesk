<template>
  <div class="astra-copilot grid h-full min-h-0 w-full grid-cols-1 overflow-hidden bg-neutral-50 dark:bg-neutral-950 md:grid-cols-[17.5rem_minmax(0,1fr)]">
    <!-- History column -->
    <aside class="hidden min-h-0 flex-col border-r border-neutral-200/70 bg-white/90 dark:border-white/[0.08] dark:bg-neutral-950/80 md:flex">
      <div class="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {{ t('astra.historyHeading') }}
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-neutral-900"
          @click="onNewChat"
        >
          <PlusIcon class="h-3.5 w-3.5" />
          {{ t('astra.newChat') }}
        </button>
      </div>
      <div class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <p v-if="historyLoading" class="px-2 py-3 text-xs text-neutral-400">{{ t('astra.historyLoading') }}</p>
        <p v-else-if="!conversations.length" class="px-2 py-3 text-xs text-neutral-400">{{ t('astra.historyEmpty') }}</p>
        <div v-else class="space-y-4">
          <section v-for="group in conversationGroups" :key="group.id">
            <p class="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {{ group.label }}
            </p>
            <ul class="space-y-0.5">
              <li v-for="item in group.items" :key="item.id">
                <div
                  class="group flex items-center gap-1 rounded-xl px-2 py-2"
                  :class="item.id === conversationId ? 'bg-primary-50 dark:bg-primary-950/40' : 'hover:bg-neutral-100 dark:hover:bg-neutral-900/70'"
                >
                  <button type="button" class="min-w-0 flex-1 truncate text-left text-sm font-medium text-neutral-800 dark:text-neutral-100" @click="onSelectConversation(item.id)">
                    {{ item.title || t('astra.historyUntitled') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg p-1 text-neutral-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                    :aria-label="t('astra.historyDelete')"
                    @click.stop="onDeleteConversation(item.id)"
                  >
                    <TrashIcon class="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>
      <div v-if="hasOlderHistory" class="shrink-0 border-t border-neutral-200/70 px-3 py-2 dark:border-white/[0.08]">
        <button
          type="button"
          class="w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
          @click="onClearOlder"
        >
          {{ t('astra.historyClearOlder') }}
        </button>
      </div>
    </aside>

    <!-- Chat column -->
    <section class="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.07),_transparent_55%)]"
        aria-hidden="true"
      />

      <header class="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200/60 px-4 py-3 dark:border-white/[0.08] sm:px-6">
        <div class="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-200/60 md:hidden dark:bg-neutral-900 dark:ring-white/10"
            :aria-label="t('astra.historyHeading')"
            @click="mobileHistoryOpen = true"
          >
            <Bars3Icon class="h-4 w-4" />
          </button>
          <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-200/60 dark:bg-neutral-900 dark:ring-white/10">
            <AstraLogo size="sm" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
              {{ conversationTitle || t('astra.brandName') }}
            </p>
            <p class="truncate text-[11px] text-neutral-500">{{ t('astra.tagline') }}</p>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200"
          @click="onNewChat"
        >
          <PlusIcon class="h-3.5 w-3.5" />
          {{ t('astra.newChat') }}
        </button>
      </header>

      <div ref="messagesEl" class="arivu-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div class="mx-auto w-full max-w-3xl">
          <!-- Empty -->
          <div
            v-if="!messages.length && !asking"
            class="flex flex-col items-center px-2 py-10 text-center"
          >
            <div class="mb-5 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-white shadow-md ring-1 ring-neutral-200/70 dark:bg-neutral-900 dark:ring-white/10">
              <AstraLogo size="hero" />
            </div>
            <h1 class="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
              {{ greeting }}
            </h1>
            <p class="mt-2 max-w-md text-sm text-neutral-500">{{ t('astra.emptyFirstTime') }}</p>
            <div class="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                v-for="card in heroSuggestions"
                :key="card.id"
                type="button"
                class="rounded-2xl border border-neutral-200/70 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-primary-300 dark:border-white/10 dark:bg-neutral-900"
                @click="onSuggestion(card.prompt)"
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
          <div v-else class="space-y-6">
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
                class="max-w-[85%] rounded-3xl rounded-br-lg bg-neutral-900 px-4 py-2.5 text-sm text-white dark:bg-white dark:text-neutral-900"
              >
                <p class="whitespace-pre-wrap break-words">{{ msg.body }}</p>
              </div>
              <div v-else class="min-w-0 max-w-[min(100%,42rem)] flex-1 space-y-3">
                <p
                  v-if="msg.body"
                  class="whitespace-pre-wrap text-[15px] leading-7 text-neutral-800 dark:text-neutral-100"
                >
                  {{ msg.body }}
                </p>
                <div v-if="msg.href" class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
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
                          class="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
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
                          class="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
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
                    class="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200"
                    @click="onSuggestion(suggestion)"
                  >
                    {{ suggestion }}
                  </button>
                </div>
              </div>
            </div>

            <div v-if="asking" class="flex items-center gap-3 text-sm text-neutral-500">
              <span class="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-neutral-200/70 dark:bg-neutral-900 dark:ring-white/10">
                <AstraLogo size="sm" />
              </span>
              <span class="inline-flex gap-1">
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500" />
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500 [animation-delay:150ms]" />
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500 [animation-delay:300ms]" />
              </span>
            </div>

            <p
              v-if="error"
              class="rounded-2xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-200"
            >
              {{ error }}
            </p>
          </div>
        </div>
      </div>

      <!-- Composer -->
      <div class="relative z-10 shrink-0 border-t border-neutral-200/60 bg-neutral-50/95 px-3 py-3 backdrop-blur dark:border-white/[0.08] dark:bg-neutral-950/95 sm:px-6 sm:py-4">
        <div class="mx-auto w-full max-w-3xl">
          <div
            v-if="composerChips.length && !asking"
            class="mb-2 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              v-for="chip in composerChips"
              :key="chip"
              type="button"
              class="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300"
              @click="onChip(chip)"
            >
              {{ chip }}
            </button>
          </div>
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
              class="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white disabled:opacity-35 dark:bg-white dark:text-neutral-900"
              :disabled="asking || !draft.trim()"
              :aria-label="t('astra.send')"
            >
              <PaperAirplaneIcon class="h-4 w-4 -rotate-45 translate-x-px" />
            </button>
          </form>
          <p class="mt-2 text-center text-[10px] text-neutral-400">{{ t('astra.composerFootnote') }}</p>
        </div>
      </div>
    </section>

    <!-- Mobile history drawer -->
    <Teleport to="body">
      <TransitionRoot :show="mobileHistoryOpen" as="template">
        <Dialog class="relative z-[80] md:hidden" @close="mobileHistoryOpen = false">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0"
            enter-to="opacity-100"
            leave="ease-in duration-150"
            leave-from="opacity-100"
            leave-to="opacity-0"
          >
            <div class="fixed inset-0 bg-neutral-950/40" />
          </TransitionChild>
          <div class="fixed inset-0 flex">
            <TransitionChild
              as="template"
              enter="transform transition ease-out duration-200"
              enter-from="-translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in duration-150"
              leave-from="translate-x-0"
              leave-to="-translate-x-full"
            >
              <DialogPanel class="flex h-full w-[18rem] max-w-[85vw] flex-col bg-white dark:bg-neutral-950">
                <div class="flex items-center justify-between border-b border-neutral-200 px-3 py-3 dark:border-white/10">
                  <DialogTitle class="text-sm font-semibold">{{ t('astra.historyHeading') }}</DialogTitle>
                  <button type="button" class="rounded-lg p-1.5" @click="mobileHistoryOpen = false">
                    <XMarkIcon class="h-4 w-4" />
                  </button>
                </div>
                <div class="p-3">
                  <button
                    type="button"
                    class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900"
                    @click="onNewChat(); mobileHistoryOpen = false"
                  >
                    <PlusIcon class="h-3.5 w-3.5" />
                    {{ t('astra.newChat') }}
                  </button>
                </div>
                <div class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-4">
                  <div class="space-y-4">
                    <section v-for="group in conversationGroups" :key="`m-${group.id}`">
                      <p class="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                        {{ group.label }}
                      </p>
                      <button
                        v-for="item in group.items"
                        :key="`m-${item.id}`"
                        type="button"
                        class="mb-0.5 block w-full truncate rounded-xl px-2.5 py-2 text-left text-sm font-medium"
                        :class="item.id === conversationId ? 'bg-primary-50 dark:bg-primary-950/40' : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'"
                        @click="onSelectConversation(item.id); mobileHistoryOpen = false"
                      >
                        {{ item.title || t('astra.historyUntitled') }}
                      </button>
                    </section>
                  </div>
                </div>
                <div v-if="hasOlderHistory" class="border-t border-neutral-200 px-3 py-2 dark:border-white/10">
                  <button
                    type="button"
                    class="w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    @click="onClearOlder"
                  >
                    {{ t('astra.historyClearOlder') }}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </TransitionRoot>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onErrorCaptured, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import {
  Bars3Icon,
  BriefcaseIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TicketIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import { useAstraAsk, type AstraProposal } from '@/astra/composables/useAstraAsk';
import { useAstraConversations, type AstraConversationSummary } from '@/astra/composables/useAstraConversations';
import AstraMessageBlocks from '@/astra/blocks/AstraMessageBlocks.vue';
import AstraLogo from '@/astra/components/AstraLogo.vue';
import type { AstraUiBlock } from '@/astra/blocks/types';

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  blocks?: AstraUiBlock[];
  proposals?: AstraProposal[];
  suggestions?: string[];
  href?: string;
  navigateLabel?: string;
}

interface HeroSuggestion {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  icon: typeof BriefcaseIcon;
}

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { asking, confirming, error, askSync, confirmProposal, fetchNba } = useAstraAsk('copilot');
const {
  conversations,
  loading: historyLoading,
  refresh: refreshHistory,
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
const nbaPrompts = ref<string[]>([]);

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
  if (!nbaPrompts.value.length) return defaultHero.value;
  const fromNba = nbaPrompts.value.slice(0, 4).map((prompt, index) => ({
    id: `nba-${index}`,
    title: prompt,
    subtitle: t('astra.heroPersonalizedSubtitle'),
    prompt,
    icon: index % 2 === 0 ? ChartBarIcon : MagnifyingGlassIcon,
  }));
  const merged = [...fromNba];
  for (const card of defaultHero.value) {
    if (merged.length >= 4) break;
    if (!merged.some((m) => m.prompt.toLowerCase() === card.prompt.toLowerCase())) merged.push(card);
  }
  return merged.slice(0, 4);
});

const composerChips = computed(() => {
  const pool = [
    ...nbaPrompts.value,
    t('astra.starterOpenDeals'),
    t('astra.starterPipelinePulse'),
    t('astra.starterOpenCases'),
    t('astra.starterFindContact'),
  ];
  const unique: string[] = [];
  for (const item of pool) {
    const text = String(item || '').trim();
    if (!text || unique.some((u) => u.toLowerCase() === text.toLowerCase())) continue;
    unique.push(text);
    if (unique.length >= 4) break;
  }
  return unique;
});

type ConversationGroupId = 'today' | 'yesterday' | 'week' | 'month' | 'older';

type ConversationGroup = {
  id: ConversationGroupId;
  label: string;
  items: AstraConversationSummary[];
};

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

const conversationGroups = computed<ConversationGroup[]>(() => {
  const buckets: Record<ConversationGroupId, AstraConversationSummary[]> = {
    today: [],
    yesterday: [],
    week: [],
    month: [],
    older: [],
  };
  for (const item of conversations.value) {
    buckets[groupIdForDate(item.updatedAt || item.createdAt)].push(item);
  }
  const order: Array<{ id: ConversationGroupId; label: string }> = [
    { id: 'today', label: t('astra.historyGroupToday') },
    { id: 'yesterday', label: t('astra.historyGroupYesterday') },
    { id: 'week', label: t('astra.historyGroupWeek') },
    { id: 'month', label: t('astra.historyGroupMonth') },
    { id: 'older', label: t('astra.historyGroupOlder') },
  ];
  return order
    .map((entry) => ({ ...entry, items: buckets[entry.id] }))
    .filter((group) => group.items.length > 0);
});

const hasOlderHistory = computed(() =>
  conversationGroups.value.some((g) => g.id !== 'today' && g.items.length > 0),
);

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

async function ask(text: string) {
  const prompt = text.trim();
  if (!prompt || asking.value) return;
  messages.value.push({ id: `u-${Date.now()}`, role: 'user', body: prompt });
  await scrollToEnd();
  const result = await askSync(prompt, {
    conversationId: conversationId.value,
    history: historyForAsk().slice(0, -1),
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

async function onSuggestion(suggestion: string) {
  await ask(suggestion);
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

function onChip(chip: string) {
  draft.value = chip;
  void nextTick(() => {
    autoGrow();
    inputEl.value?.focus();
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
      suggestions: Array.isArray(m.suggestions) ? m.suggestions.map(String) : [],
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
      nbaPrompts.value = nba.map((item) => String(item.label || '').trim()).filter(Boolean).slice(0, 6);
    }),
  ]);
  inputEl.value?.focus();
});

watch(draft, () => {
  void nextTick(autoGrow);
});
</script>

<template>
  <Teleport to="body">
    <button
      v-if="showLauncher"
      type="button"
      class="fixed bottom-4 right-4 z-[9000] flex h-10 w-10 items-center justify-center rounded-full bg-primary-800 text-white shadow-md transition hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:bg-neutral-950 dark:hover:bg-neutral-800 dark:focus-visible:ring-offset-gray-900"
      :aria-label="t('liveChat.inAppOpen')"
      :title="t('liveChat.inAppOpen')"
      @click="openPanel"
    >
      <SparklesIcon class="h-5 w-5" aria-hidden="true" />
    </button>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="panelOpen"
        class="fixed z-[9010] flex flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        :class="expanded
          ? 'inset-y-0 right-0 h-[100dvh] w-[min(420px,100vw)] rounded-none border-y-0 border-r-0'
          : 'bottom-4 right-4 h-[min(600px,calc(100vh-1.5rem))] w-[min(360px,calc(100vw-1.5rem))] rounded-2xl'"
        role="dialog"
        :aria-label="t('liveChat.inAppTitle')"
      >
        <!-- Header -->
        <header class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div class="flex min-w-0 items-center gap-2.5">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white dark:bg-primary-700">
              <SparklesIcon class="h-5 w-5" aria-hidden="true" />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <h2 class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {{ t('liveChat.inAppTitle') }}
                </h2>
                <span class="rounded-md bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-800 dark:bg-primary-500/20 dark:text-primary-200">
                  {{ t('liveChat.inAppAiBadge') }}
                </span>
              </div>
              <p class="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {{ t('liveChat.inAppOnline') }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="expanded ? t('liveChat.inAppCollapse') : t('liveChat.inAppExpand')"
              @click="toggleExpanded"
            >
              <ArrowsPointingInIcon v-if="expanded" class="h-4 w-4" aria-hidden="true" />
              <ArrowsPointingOutIcon v-else class="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="t('actions.close')"
              @click="closePanel"
            >
              <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <!-- Context strip -->
        <div class="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2 dark:border-gray-800 dark:bg-gray-950/60">
          <MapPinIcon class="h-3.5 w-3.5 shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />
          <p class="min-w-0 flex-1 truncate text-xs text-gray-600 dark:text-gray-300">
            <span class="text-gray-500 dark:text-gray-400">{{ t('liveChat.inAppYouAreIn') }}</span>
            {{ ' ' }}
            <span class="font-medium text-gray-900 dark:text-white">{{ locationLabel }}</span>
          </p>
        </div>

        <!-- Home -->
        <div v-if="activeSection === 'home'" class="flex min-h-0 flex-1 flex-col">
          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <p class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('liveChat.inAppGreeting', { name: greetName || t('liveChat.inAppGuestName') }) }}
            </p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('liveChat.inAppHelpPrompt') }}
            </p>

            <div class="mt-4 grid grid-cols-2 gap-2">
              <button
                v-for="action in quickActions"
                :key="action.id"
                type="button"
                class="flex flex-col items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-primary-300 hover:bg-primary-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10"
                @click="action.run()"
              >
                <component :is="action.icon" class="h-5 w-5 text-primary-700 dark:text-primary-300" aria-hidden="true" />
                <span class="text-xs font-medium text-gray-900 dark:text-gray-100">{{ action.label }}</span>
              </button>
            </div>

            <div class="mt-6">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ t('liveChat.inAppRecentTitle') }}
                </h3>
              </div>
              <ul v-if="recentConversations.length" class="mt-2 space-y-1">
                <li v-for="item in recentConversations" :key="item.sessionId">
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                    @click="void openChat()"
                  >
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-800 dark:bg-primary-500/20 dark:text-primary-200">
                      <ChatBubbleLeftRightIcon class="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium text-gray-900 dark:text-white">{{ item.title }}</span>
                      <span class="block text-xs text-gray-500 dark:text-gray-400">{{ formatRecentWhen(item.updatedAt) }}</span>
                    </span>
                  </button>
                </li>
              </ul>
              <p v-else class="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {{ t('liveChat.inAppRecentEmpty') }}
              </p>
            </div>
          </div>

          <form
            class="shrink-0 border-t border-gray-100 p-3 dark:border-gray-800"
            @submit.prevent="onHomeAsk"
          >
            <div class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-950">
              <input
                v-model="draft"
                type="text"
                class="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-white"
                :placeholder="t('liveChat.inAppAskPlaceholder')"
                autocomplete="off"
              />
              <button
                type="submit"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white hover:bg-primary-700 disabled:opacity-40 dark:bg-primary-700"
                :disabled="!draft.trim()"
                :aria-label="t('actions.send')"
              >
                <PaperAirplaneIcon class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p class="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
              {{ t('liveChat.inAppPoweredBy') }}
            </p>
          </form>
        </div>

        <!-- Chat -->
        <div v-else class="flex min-h-0 flex-1 flex-col">
          <div class="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <button
              type="button"
              class="rounded-lg px-2 py-1 text-xs font-medium text-primary-800 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-500/10"
              @click="goHome"
            >
              ← {{ t('liveChat.inAppBackHome') }}
            </button>
            <span class="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-gray-400">{{ identityLabel }}</span>
            <button
              v-if="!sessionClosed"
              type="button"
              class="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
              @click="onEndChat"
            >
              {{ t('liveChat.inAppEndChat') }}
            </button>
          </div>

          <div
            ref="messagesEl"
            class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
          >
            <p
              v-if="welcomeMessage && !messages.length && !starting"
              class="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              {{ welcomeMessage }}
            </p>

            <div
              v-if="starting"
              class="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400"
            >
              {{ t('states.loading') }}
            </div>

            <div
              v-for="msg in messages"
              :key="msg._id"
              class="flex"
              :class="msg.direction === 'inbound' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[85%] rounded-2xl px-3 py-2 text-sm"
                :class="msg.direction === 'inbound'
                  ? 'bg-primary-800 text-white dark:bg-primary-700'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'"
              >
                <p class="whitespace-pre-wrap break-words">{{ msg.body }}</p>
              </div>
            </div>

            <p
              v-if="agentTyping"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ t('liveChat.inAppAgentTyping') }}
            </p>

            <p
              v-if="sessionClosed"
              class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
            >
              {{ t('liveChat.inAppSessionClosed') }}
            </p>

            <p
              v-if="chatError"
              class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-200"
            >
              {{ chatError }}
            </p>
          </div>

          <form
            class="shrink-0 border-t border-gray-100 p-3 dark:border-gray-800"
            @submit.prevent="onSend"
          >
            <div class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-950">
              <input
                v-model="draft"
                type="text"
                class="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-white"
                :placeholder="t('liveChat.inAppAskPlaceholder')"
                :disabled="sending || sessionClosed || starting"
                autocomplete="off"
              />
              <button
                type="submit"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white hover:bg-primary-700 disabled:opacity-40 dark:bg-primary-700"
                :disabled="sending || sessionClosed || starting || !draft.trim()"
                :aria-label="t('actions.send')"
              >
                <PaperAirplaneIcon class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  BugAntIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  NewspaperIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { useInProductSupportChat } from '@/composables/useInProductSupportChat';
import { getTabTitleMetaForPath, resolveTabTitle } from '@/utils/navigationLabels';

const { t, te } = useI18n();
const route = useRoute();
const messagesEl = ref(null);

const {
  isAvailable,
  bootstrapLoading,
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
  goHome,
  closePanel,
  toggleExpanded,
  sendMessage,
  endSession,
} = useInProductSupportChat();

const hideOnAgentWorkspace = computed(() => String(route.path || '').startsWith('/live-chat'));

const showLauncher = computed(
  () => isAvailable.value && !bootstrapLoading.value && !hideOnAgentWorkspace.value && !panelOpen.value,
);

const identityLabel = computed(() => {
  const v = visitor.value;
  if (v?.name && v?.email) return `${v.name} · ${v.email}`;
  return v?.name || v?.email || '';
});

const locationLabel = computed(() => {
  const meta = getTabTitleMetaForPath(route.path, route.params || {});
  const title = resolveTabTitle(
    { path: route.path, params: route.params, titleKey: meta.titleKey, titleParams: meta.titleParams },
    t,
    te,
  );
  return title || route.path || '—';
});

const quickActions = computed(() => [
  {
    id: 'ask',
    label: t('liveChat.inAppAskQuestion'),
    icon: ChatBubbleLeftRightIcon,
    run: () => { void openChat(); },
  },
  {
    id: 'whats-new',
    label: t('liveChat.inAppWhatsNew'),
    icon: NewspaperIcon,
    run: () => {
      window.dispatchEvent(new CustomEvent('arivu:open-whats-new'));
      closePanel();
    },
  },
  {
    id: 'search',
    label: t('liveChat.inAppSearchHelp'),
    icon: MagnifyingGlassIcon,
    run: () => {
      window.dispatchEvent(new CustomEvent('arivu:open-global-search'));
      closePanel();
    },
  },
  {
    id: 'report',
    label: t('liveChat.inAppReportIssue'),
    icon: BugAntIcon,
    run: () => {
      void openChat({ draft: t('liveChat.inAppReportIssueDraft') });
    },
  },
]);

function formatRecentWhen(ts) {
  const ms = Number(ts) || 0;
  if (!ms) return '';
  const diff = Date.now() - ms;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return t('liveChat.inAppRecentToday');
  if (diff < 2 * day) return t('liveChat.inAppRecentYesterday');
  const days = Math.max(2, Math.floor(diff / day));
  return t('liveChat.inAppRecentDaysAgo', { days });
}

async function onHomeAsk() {
  const text = draft.value.trim();
  if (!text) return;
  await openChat();
  await sendMessage();
  await nextTick();
  scrollMessages();
}

async function onSend() {
  await sendMessage();
  await nextTick();
  scrollMessages();
}

async function onEndChat() {
  await endSession();
  goHome();
}

function scrollMessages() {
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  }
}

watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    scrollMessages();
  },
);

onMounted(() => {
  void loadBootstrap();
});
</script>

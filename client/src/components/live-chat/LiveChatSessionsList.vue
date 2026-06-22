<template>
  <aside
    class="flex w-full shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:w-[340px]"
  >
    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 flex-1 gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
          <button
            v-for="tab in queueTabs"
            :key="tab.id"
            type="button"
            class="min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-xs font-semibold transition"
            :class="activeQueueTab === tab.id
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'"
            @click="setQueueTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </div>
        <button
          type="button"
          class="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          :title="t('actions.refresh')"
          @click="reload"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex flex-1 items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <div v-else-if="error" class="p-4 text-sm text-rose-600 dark:text-rose-300">{{ error }}</div>

    <LiveChatEmptyState
      v-else-if="!hasAnySessions"
      :variant="activeQueueTab === 'all' ? 'list-all' : 'list-mine'"
      compact
      :show-browse-all-action="activeQueueTab === 'mine' && allQueueCount > 0"
      @action="setQueueTab('all')"
    />

    <div v-else class="min-h-0 flex-1 overflow-y-auto">
      <section v-for="section in visibleSections" :key="section.id" class="py-1">
        <h3
          v-if="section.label"
          class="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
        >
          {{ section.label }}
          <span v-if="section.sessions.length" class="ml-1 text-gray-400 dark:text-gray-500">
            ({{ section.sessions.length }})
          </span>
        </h3>

        <ul>
          <li v-for="session in section.sessions" :key="session._id">
            <button
              type="button"
              class="w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
              :class="selectedSessionId === String(session._id)
                ? 'border-l-2 border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/30'
                : 'border-l-2 border-l-transparent'"
              @click="$emit('select', session)"
            >
              <div class="flex items-start gap-3">
                <div class="relative shrink-0">
                  <AvatarInitials
                    :first-name="visitorFirstName(session)"
                    :last-name="visitorLastName(session)"
                    :email="session.visitor?.email"
                    size="sm"
                  />
                  <span
                    class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-900"
                    :class="visitorPresenceDotClass(session)"
                    aria-hidden="true"
                  />
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {{ visitorLabel(session) }}
                    </p>
                    <span class="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                      {{ formatRelative(session.lastMessageAt || session.createdAt) }}
                    </span>
                  </div>
                  <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                    {{ messagePreview(session) }}
                  </p>
                </div>

                <span
                  v-if="session.unreadCount > 0"
                  class="mt-0.5 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white"
                >
                  {{ session.unreadCount > 9 ? '9+' : session.unreadCount }}
                </span>
              </div>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import LiveChatEmptyState from '@/components/live-chat/LiveChatEmptyState.vue';
import apiClient from '@/utils/apiClient';
import { formatLiveChatRelativeTime } from '@/utils/liveChatRelativeTime';

const props = defineProps({
  selectedSessionId: { type: String, default: '' },
});

const emit = defineEmits(['select', 'clear-selection']);

const { t } = useI18n();
const authStore = useAuthStore();

const loading = ref(true);
const error = ref('');
const openSessions = ref([]);
const activeQueueTab = ref('mine');

const currentUserId = computed(() => String(authStore.user?._id || ''));

const myQueueSessions = computed(() =>
  openSessions.value.filter((session) => {
    const agentId = String(session?.assignedAgentId || '');
    if (!agentId || agentId !== currentUserId.value) return false;
    if (String(session?.status || 'open') === 'closed') return false;
    const lifecycle = String(session?.lifecycleStatus || '').trim();
    return lifecycle !== 'ended';
  }),
);

const waitingInQueue = computed(() =>
  openSessions.value.filter((session) => {
    const agentId = String(session?.assignedAgentId || '');
    if (agentId) return false;
    const lifecycle = String(session?.lifecycleStatus || 'waiting');
    return lifecycle === 'waiting' || lifecycle === 'assigned' || lifecycle === 'bot_handling';
  }),
);

const allOpenSessions = computed(() => [...openSessions.value]);

const myQueueCount = computed(() => myQueueSessions.value.length);
const allQueueCount = computed(() => allOpenSessions.value.length);

const queueTabs = computed(() => [
  {
    id: 'mine',
    label: t('liveChat.queueTabMine', { count: myQueueCount.value }),
  },
  {
    id: 'all',
    label: t('liveChat.queueTabAll', { count: allQueueCount.value }),
  },
]);

const visibleSections = computed(() => {
  if (activeQueueTab.value === 'all') {
    const sections = [];
    if (allOpenSessions.value.length) {
      sections.push({
        id: 'all-open',
        label: t('liveChat.sectionAllOpen'),
        sessions: allOpenSessions.value,
      });
    }
    return sections;
  }

  const sections = [];
  if (myQueueSessions.value.length) {
    sections.push({
      id: 'my-queue',
      label: '',
      sessions: myQueueSessions.value,
    });
  }
  return sections;
});

const hasAnySessions = computed(() =>
  visibleSections.value.some((section) => section.sessions.length > 0),
);

function visitorLabel(session) {
  const name = String(session?.visitor?.name || '').trim();
  return name || t('liveChat.visitor');
}

function visitorFirstName(session) {
  const name = String(session?.visitor?.name || '').trim();
  if (!name) return '';
  return name.split(/\s+/)[0] || '';
}

function visitorLastName(session) {
  const name = String(session?.visitor?.name || '').trim();
  if (!name) return '';
  const parts = name.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

function messagePreview(session) {
  const body = String(session?.lastMessage?.body || '').trim();
  if (body) return body;
  const summary = String(session?.summary || '').trim();
  if (summary) return summary;
  const lifecycle = lifecycleLabel(session);
  return lifecycle || t('liveChat.noMessagesYet');
}

function lifecycleLabel(session) {
  const status = String(session?.lifecycleStatus || 'waiting').trim();
  if (!session?.assignedAgentId && (status === 'waiting' || status === 'assigned')) {
    return t('liveChat.unassigned');
  }
  return t(`liveChat.lifecycle.${status}`, status);
}

function visitorPresenceDotClass(session) {
  if (session.status === 'closed') return 'bg-gray-400 dark:bg-gray-500';
  const lifecycle = String(session?.lifecycleStatus || '');
  if (lifecycle === 'active' || lifecycle === 'assigned') return 'bg-emerald-500';
  if (lifecycle === 'waiting' || lifecycle === 'bot_handling') return 'bg-amber-500';
  return 'bg-gray-400 dark:bg-gray-500';
}

function formatRelative(value) {
  return formatLiveChatRelativeTime(value);
}

async function loadSessions({ background = false } = {}) {
  if (!background) {
    loading.value = true;
  }
  error.value = '';
  try {
    const openRes = await apiClient.get('/live-chat/sessions', {
      params: { status: 'open', limit: 100 },
    });
    openSessions.value = Array.isArray(openRes?.data) ? openRes.data : [];
  } catch (err) {
    if (!background) {
      error.value = err?.message || t('liveChat.sessionsLoadFailed');
      openSessions.value = [];
    }
  } finally {
    if (!background) {
      loading.value = false;
    }
  }
}

function isSessionInActiveQueue(sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return false;
  return visibleSections.value.some((section) =>
    section.sessions.some((session) => String(session._id) === id),
  );
}

function reconcileSelection() {
  if (loading.value) return;
  const id = String(props.selectedSessionId || '').trim();
  if (!id) return;
  if (!isSessionInActiveQueue(id)) {
    emit('clear-selection');
  }
}

function setQueueTab(tabId) {
  if (activeQueueTab.value === tabId) return;
  activeQueueTab.value = tabId;
  reconcileSelection();
}

function reload() {
  return loadSessions({ background: true });
}

watch(
  () => props.selectedSessionId,
  (id, prev) => {
    if (!id || prev === undefined) return;
    reload();
  },
);

watch(visibleSections, reconcileSelection);

onMounted(async () => {
  await loadSessions();
  reconcileSelection();
});

defineExpose({ reload });
</script>

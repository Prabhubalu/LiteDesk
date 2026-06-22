<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <LiveChatWorkspaceNav />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <LiveChatSessionsList
        ref="listRef"
        :selected-session-id="selectedSessionId"
        @select="onSelectSession"
        @clear-selection="onClearSelection"
      />

      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LiveChatSessionPanel
          v-if="selectedSessionId"
          :key="selectedSessionId"
          :session-id="selectedSessionId"
          :session="selectedSession"
          :can-reply="canReply"
          @session-ended="onSessionEnded"
        />
        <LiveChatEmptyState v-else variant="detail" />
      </div>

      <div
        v-if="selectedSessionId"
        class="live-chat-context-rail hidden shrink-0 border-l border-[#EBEBEB] bg-[#FAFAF8] dark:border-gray-800 dark:bg-gray-900 xl:block"
        :class="{ 'live-chat-context-rail--open': contextPanelOpen }"
        :style="{ '--live-chat-context-rail-width': `${CONTEXT_PANEL_WIDTH_PX}px` }"
      >
        <button
          v-show="!contextPanelOpen"
          type="button"
          class="flex h-full w-8 flex-col items-center justify-center gap-1 text-[#787774] hover:bg-[#F1F1EF] hover:text-[#37352F] dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          :title="t('liveChat.visitorContextExpand')"
          :aria-label="t('liveChat.visitorContextExpand')"
          @click="contextPanelOpen = true"
        >
          <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
          <span class="text-[10px] font-medium uppercase tracking-wide [writing-mode:vertical-rl]">
            {{ t('liveChat.visitorContextTitle') }}
          </span>
        </button>

        <div
          v-show="contextPanelOpen"
          class="live-chat-context-rail-panel h-full w-full min-w-0"
        >
          <LiveChatSessionContextPanel
            :session-id="selectedSessionId"
            :session="selectedSession"
            class="h-full"
            @close="contextPanelOpen = false"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ChevronLeftIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import { canReplyLiveChatSessions } from '@/utils/liveChatPermissions';
import { useLiveChatPresenceSync } from '@/composables/useLiveChatPresenceSync';
import {
  clearLiveChatLastSessionId,
  persistLiveChatLastSessionId,
  readLiveChatLastSessionId,
} from '@/utils/liveChatSessionSelection';
import LiveChatSessionsList from '@/components/live-chat/LiveChatSessionsList.vue';
import LiveChatEmptyState from '@/components/live-chat/LiveChatEmptyState.vue';
import LiveChatSessionPanel from '@/components/live-chat/LiveChatSessionPanel.vue';
import LiveChatSessionContextPanel from '@/components/live-chat/LiveChatSessionContextPanel.vue';
import LiveChatWorkspaceNav from '@/components/live-chat/LiveChatWorkspaceNav.vue';
import { useLiveChatRealtimeSync } from '@/composables/useLiveChatRealtimeSync';
import { useLiveChatWorkspaceAlerts } from '@/composables/useLiveChatWorkspaceAlerts';
import { useLiveChatTabNavigation } from '@/composables/useLiveChatTabNavigation';

const CONTEXT_PANEL_OPEN_KEY = 'arivu:live-chat-context-panel-open';
const CONTEXT_PANEL_WIDTH_PX = 320;

function loadContextPanelOpenPref() {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(CONTEXT_PANEL_OPEN_KEY) !== 'false';
}

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const listRef = ref(null);
const selectedSession = ref(null);
const contextPanelOpen = ref(loadContextPanelOpenPref());
const { clearSessionsAlert } = useLiveChatWorkspaceAlerts();
const { isSessionsActive } = useLiveChatTabNavigation();

const selectedSessionId = computed(() => {
  const fromRoute = String(route.params.sessionId || '').trim();
  if (fromRoute) return fromRoute;
  return String(selectedSession.value?._id || '').trim();
});

useLiveChatRealtimeSync({
  reloadSessions: () => listRef.value?.reload?.(),
  selectedSessionId,
});

watch(isSessionsActive, (active) => {
  if (active) clearSessionsAlert();
}, { immediate: true });

const canReply = computed(() => canReplyLiveChatSessions(authStore.user));
const currentUserId = computed(() => authStore.user?._id || null);

useLiveChatPresenceSync(currentUserId, canReply);

watch(contextPanelOpen, (open) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CONTEXT_PANEL_OPEN_KEY, open ? 'true' : 'false');
  }
});

function onSelectSession(session) {
  if (!session?._id) return;
  selectedSession.value = session;
  persistLiveChatLastSessionId(session._id);
  router.replace({ name: 'live-chat-session', params: { sessionId: String(session._id) } });
}

function onClearSelection() {
  selectedSession.value = null;
  clearLiveChatLastSessionId();
  if (route.name === 'live-chat-session') {
    router.replace({ name: 'live-chat-sessions' });
  }
}

function onSessionEnded(session) {
  if (session) {
    selectedSession.value = session;
  }
  clearLiveChatLastSessionId();
  listRef.value?.reload?.();
  router.replace({ name: 'live-chat-sessions' });
}

watch(
  () => ({ name: route.name, sessionId: route.params.sessionId }),
  ({ name, sessionId: rawId }) => {
    const routeName = String(name || '');
    const isSessionsRoute = routeName === 'live-chat-sessions' || routeName === 'live-chat-session';
    if (!isSessionsRoute) return;

    const sessionId = String(rawId || '').trim();
    if (sessionId) {
      persistLiveChatLastSessionId(sessionId);
      if (selectedSession.value && String(selectedSession.value._id) === sessionId) {
        return;
      }
      selectedSession.value = { _id: sessionId };
      return;
    }

    if (routeName === 'live-chat-sessions') {
      const lastSessionId = readLiveChatLastSessionId();
      if (lastSessionId) {
        router.replace({ name: 'live-chat-session', params: { sessionId: lastSessionId } });
        return;
      }
    }

    selectedSession.value = null;
  },
  { immediate: true },
);
</script>

<style scoped>
.live-chat-context-rail {
  width: 2rem;
  flex-shrink: 0;
  transition: width 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.live-chat-context-rail--open {
  width: var(--live-chat-context-rail-width, 320px);
  min-width: var(--live-chat-context-rail-width, 320px);
}
</style>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <LiveChatWorkspaceNav />

    <LiveChatClosedSessionWorkspace
      v-if="sessionId"
      :key="sessionId"
      :session-id="sessionId"
      @back="goBack"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LiveChatWorkspaceNav from '@/components/live-chat/LiveChatWorkspaceNav.vue';
import LiveChatClosedSessionWorkspace from '@/components/live-chat/LiveChatClosedSessionWorkspace.vue';
import { LIVE_CHAT_CLOSED_TAB_PATH } from '@/utils/liveChatTabPaths';

const route = useRoute();
const router = useRouter();

const sessionId = computed(() => String(route.params.sessionId || '').trim());

function goBack() {
  router.push(LIVE_CHAT_CLOSED_TAB_PATH);
}
</script>

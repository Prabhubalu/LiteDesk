<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <LiveChatWorkspaceNav />

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <LiveChatVisitorsList
        ref="listRef"
        :selected-visitor-id="selectedVisitorId"
        @select="onSelectVisitor"
      />

      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LiveChatVisitorPanel
          v-if="selectedVisitorId"
          :key="selectedVisitorId"
          :visitor-id="selectedVisitorId"
        />
        <div
          v-else
          class="flex flex-1 items-center justify-center p-8 text-center"
        >
          <p class="max-w-sm text-sm text-gray-500 dark:text-gray-400">
            {{ t('liveChat.selectVisitorHint') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useTabs } from '@/composables/useTabs';
import LiveChatWorkspaceNav from '@/components/live-chat/LiveChatWorkspaceNav.vue';
import LiveChatVisitorsList from '@/components/live-chat/LiveChatVisitorsList.vue';
import LiveChatVisitorPanel from '@/components/live-chat/LiveChatVisitorPanel.vue';

const { t } = useI18n();
const route = useRoute();
const { openLiveChatVisitor } = useTabs();

const listRef = ref(null);
const selectedVisitor = ref(null);

const selectedVisitorId = computed(() => {
  const fromRoute = String(route.params.visitorId || '').trim();
  if (fromRoute) return fromRoute;
  return String(selectedVisitor.value?._id || '').trim();
});

function onSelectVisitor(visitor) {
  if (!visitor?._id) return;
  selectedVisitor.value = visitor;
  openLiveChatVisitor(String(visitor._id));
}

watch(
  () => route.params.visitorId,
  (id) => {
    if (!id) {
      selectedVisitor.value = null;
      return;
    }
    if (selectedVisitor.value && String(selectedVisitor.value._id) === String(id)) {
      return;
    }
    selectedVisitor.value = { _id: String(id) };
  },
  { immediate: true },
);
</script>

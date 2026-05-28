<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900">
    <div v-if="loading" class="flex flex-1 items-center justify-center py-16">
      <span class="inline-block h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div
      v-else-if="!displayItems.length"
      class="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center"
    >
      <EnvelopeIcon class="h-12 w-12 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ emptyTitle }}</p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ emptyMessage }}</p>
    </div>

    <div v-else ref="scrollRef" class="flex-1 min-h-0 overflow-y-auto">
      <div class="mx-auto w-[90%] divide-y divide-gray-200 py-2 dark:divide-gray-700">
        <template v-for="row in displayItems" :key="row.id">
          <div v-if="row.kind === 'system'" class="flex justify-center py-6">
            <span
              class="inline-flex max-w-full items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            >
              {{ formatSystemPill(row.activity) }}
            </span>
          </div>

          <div v-else-if="row.kind === 'message'" class="py-4">
            <CaseEmailTimelineMessage
              :message="row.message"
              :case-record="caseRecord"
              :created-at="row.createdAt"
              :expanded="isMessageExpanded(row.id)"
              @toggle="toggleMessage(row.id)"
              @reply="$emit('reply-email', $event)"
              @reply-all="$emit('reply-email', { ...$event, replyAll: true })"
              @forward="$emit('reply-email', { ...$event, forward: true })"
            />
          </div>

          <div v-else-if="row.kind === 'internal_comment'" class="py-4">
            <CaseInternalCommentTimelineCard
              :activity="row.activity"
              :created-at="row.createdAt"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { EnvelopeIcon } from '@heroicons/vue/24/outline';
import CaseEmailTimelineMessage from '@/components/cases/CaseEmailTimelineMessage.vue';
import CaseInternalCommentTimelineCard from '@/components/cases/CaseInternalCommentTimelineCard.vue';
import {
  buildCaseEmailConversationItems,
  formatCaseEmailSystemPill
} from '@/utils/caseEmailConversation';

const props = defineProps({
  activities: { type: Array, default: () => [] },
  caseRecord: { type: Object, default: null },
  emailThreads: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  emptyTitle: { type: String, default: '' },
  emptyMessage: { type: String, default: '' }
});

defineEmits(['reply-email']);

const { t } = useI18n();
const scrollRef = ref(null);
const expandedMessageIds = ref(new Set());
const expandedInitKey = ref('');
const lastTrackedMessageId = ref(null);

const displayItems = computed(() =>
  buildCaseEmailConversationItems({
    activities: props.activities,
    emailThreads: props.emailThreads,
    caseRecord: props.caseRecord
  })
);

const messageItems = computed(() => displayItems.value.filter((i) => i.kind === 'message'));

function syncExpandedMessages() {
  const caseKey = String(props.caseRecord?._id || props.caseRecord?.id || 'none');
  const msgs = messageItems.value;
  const lastId = msgs.length ? msgs[msgs.length - 1].id : null;

  if (!lastId) {
    expandedMessageIds.value = new Set();
    expandedInitKey.value = caseKey;
    return;
  }

  if (expandedInitKey.value !== caseKey) {
    expandedMessageIds.value = new Set([lastId]);
    expandedInitKey.value = caseKey;
    lastTrackedMessageId.value = lastId;
    return;
  }

  if (lastTrackedMessageId.value !== lastId) {
    expandedMessageIds.value = new Set([...expandedMessageIds.value, lastId]);
    lastTrackedMessageId.value = lastId;
  }
}

watch(displayItems, syncExpandedMessages, { immediate: true });

function isMessageExpanded(id) {
  return expandedMessageIds.value.has(id);
}

function toggleMessage(id) {
  const next = new Set(expandedMessageIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedMessageIds.value = next;
}

function formatSystemPill(activity) {
  return formatCaseEmailSystemPill(activity, t);
}

watch(
  () => displayItems.value.length,
  async () => {
    await nextTick();
    const el = scrollRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  }
);
</script>

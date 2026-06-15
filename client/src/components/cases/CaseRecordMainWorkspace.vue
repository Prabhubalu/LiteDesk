<template>
  <div class="case-record-main-workspace flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
    <template v-if="embed">
      <div class="shrink-0 px-6 pt-4 pb-4">
        <RecordPageTitleRow
          embed
          :sticky="false"
          class="!mb-0 shrink-0 border-0 !bg-transparent !py-0 shadow-none backdrop-blur-none lg:mb-0"
        >
          <Avatar
            :record="{ name: caseModuleLabel }"
            :icon="TicketIcon"
            size="lg"
            class="shrink-0"
          />
          <div class="min-w-0 flex-1">
            <h2
              class="truncate text-lg font-semibold text-gray-900 dark:text-white"
              :title="caseRecord.title"
            >
              {{ caseRecord.title || '—' }}
            </h2>
            <p
              class="mt-0.5 truncate font-mono text-xs text-gray-500 dark:text-gray-400"
              :title="caseRecord.caseId"
            >
              {{ caseRecord.caseId || caseRecord._id?.slice(-8) }}
            </p>
          </div>
        </RecordPageTitleRow>
      </div>
      <CaseRecordHeader
        class="shrink-0"
        embed-toolbar
        preview-mode
        :case-record="caseRecord"
        :allowed-status-transitions="allowedStatusTransitions"
        :priorities="priorities"
        :status-updating="statusUpdating"
        :is-closed="isClosed"
        :show-navigation="false"
        :can-previous="false"
        :can-next="false"
        :can-delete="canDelete"
        :can-edit="canEdit"
        :can-email="canEmail"
        @status-change="$emit('status-change', $event)"
        @priority-change="$emit('priority-change', $event)"
        @edit-record="$emit('edit-record')"
        @email="$emit('email')"
        @delete="$emit('delete')"
        @copy-url="$emit('copy-url')"
      />
      <div v-if="isClosed" class="shrink-0 px-6 pb-2">
        <RecordClosedBanner
          module-key="cases"
          :can-reopen="canEdit"
          @reopen="$emit('reopen')"
        />
      </div>
    </template>

    <div
      class="flex shrink-0 gap-0.5 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      :class="embed ? 'px-6' : 'px-4 sm:px-6'"
      role="tablist"
      :aria-label="t('cases.recordMainTabsLabel')"
    >
      <button
        v-for="tab in mainTabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        class="relative px-3 py-2.5 text-sm font-medium transition-colors"
        :class="
          activeTab === tab.id
            ? 'text-indigo-600 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-indigo-600 dark:text-indigo-400 dark:after:bg-indigo-400'
            : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
        "
        @click="$emit('update:activeTab', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div
      v-if="activeTab === 'conversation'"
      class="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <CaseLiveChatPanel
        v-if="isLiveChatCase"
        ref="liveChatPanelRef"
        :case-id="caseId"
        :can-reply="canEdit"
        @chat-updated="$emit('chat-updated')"
        @typing-label="setLiveChatTypingLabel"
      />
      <CaseEmailConversationFeed
        v-else-if="isEmailCase"
        :activities="tabActivities"
        :case-record="caseRecord"
        :email-threads="emailThreads"
        :loading="emailThreadsLoading"
        :empty-title="emptyConversationTitle"
        :empty-message="emptyConversationMessage"
        @reply-email="onTimelineReplyEmail"
      />
      <CaseTimelineFeed
        v-else
        :activities="tabActivities"
        :case-record="caseRecord"
        :empty-title="emptyConversationTitle"
        :empty-message="emptyConversationMessage"
      />
      <div
        v-if="isLiveChatCase && liveChatTypingLabel"
        class="shrink-0 bg-white px-4 py-2 text-xs text-indigo-600 dark:bg-gray-900 dark:text-indigo-300 sm:px-6"
      >
        {{ liveChatTypingLabel }}
      </div>
      <CaseResizableReplyComposer
        v-if="!isClosed && caseId"
        ref="replyComposerRef"
        pane-key="conversation"
        :case-id="caseId"
        :case-record="caseRecord"
        :contact-email="contactEmail"
        :email-threads="emailThreads"
        :sending="sending"
        :fixed-channel="isLiveChatCase ? 'Live Chat' : ''"
        :hide-channel-select="isLiveChatCase"
        :show-internal-toggle="!isLiveChatCase"
        placeholder="Reply to visitor…"
        @send="$emit('send-message', $event)"
        @send-email="$emit('send-email', $event)"
        @typing="$emit('typing', $event)"
      />
    </div>

    <div
      v-else-if="activeTab === 'activity'"
      class="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <CaseTimelineFeed
        :activities="tabActivities"
        :case-record="caseRecord"
        :empty-title="emptyActivityTitle"
        :empty-message="emptyActivityMessage"
      />
    </div>

    <div
      v-else-if="activeTab === 'notes'"
      class="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <CaseTimelineFeed
        :activities="tabActivities"
        :case-record="caseRecord"
        :empty-title="emptyNotesTitle"
        :empty-message="emptyNotesMessage"
      />
      <CaseResizableReplyComposer
        v-if="!isClosed"
        pane-key="notes"
        :case-id="caseId"
        :case-record="caseRecord"
        :contact-email="contactEmail"
        :email-threads="emailThreads"
        :sending="sending"
        :show-internal-toggle="false"
        :placeholder="notesPlaceholder"
        @send="$emit('send-note', $event)"
      />
    </div>

    <CaseTasksTab
      v-else-if="activeTab === 'tasks'"
      class="min-h-0 flex-1 overflow-hidden"
      :case-id="caseId"
      :can-edit="canEdit"
      @open-record="$emit('open-record', $event)"
      @link-task="$emit('link-task')"
    />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { TicketIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import RecordPageTitleRow from '@/components/record-page/RecordPageTitleRow.vue';
import RecordClosedBanner from '@/components/record-page/RecordClosedBanner.vue';
import CaseRecordHeader from '@/components/cases/CaseRecordHeader.vue';
import CaseTimelineFeed from '@/components/cases/CaseTimelineFeed.vue';
import CaseEmailConversationFeed from '@/components/cases/CaseEmailConversationFeed.vue';
import { isEmailChannelCase } from '@/utils/caseEmailReply';
import CaseLiveChatPanel from '@/components/cases/CaseLiveChatPanel.vue';
import CaseResizableReplyComposer from '@/components/cases/CaseResizableReplyComposer.vue';
import CaseTasksTab from '@/components/cases/CaseTasksTab.vue';

const props = defineProps({
  embed: { type: Boolean, default: false },
  caseRecord: { type: Object, required: true },
  caseId: { type: String, required: true },
  activeTab: { type: String, required: true },
  mainTabs: { type: Array, required: true },
  tabActivities: { type: Array, default: () => [] },
  allowedStatusTransitions: { type: Array, default: () => [] },
  priorities: { type: Array, default: () => [] },
  statusUpdating: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false },
  sending: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: true },
  canDelete: { type: Boolean, default: false },
  canEmail: { type: Boolean, default: false },
  emptyConversationTitle: { type: String, default: '' },
  emptyConversationMessage: { type: String, default: '' },
  emptyActivityTitle: { type: String, default: '' },
  emptyActivityMessage: { type: String, default: '' },
  emptyNotesTitle: { type: String, default: '' },
  emptyNotesMessage: { type: String, default: '' },
  notesPlaceholder: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  emailThreads: { type: Array, default: () => [] },
  emailThreadsLoading: { type: Boolean, default: false }
});

const { t } = useI18n();
const liveChatPanelRef = ref(null);
const liveChatTypingLabel = ref('');
const caseModuleLabel = computed(() => t('navigation.moduleCases'));
const isLiveChatCase = computed(() => String(props.caseRecord?.channel || '').toLowerCase() === 'live chat');
const isEmailCase = computed(() => isEmailChannelCase(props.caseRecord));

function setLiveChatTypingLabel(label) {
  liveChatTypingLabel.value = String(label || '');
}

function appendLiveChatMessage(msg) {
  liveChatPanelRef.value?.appendMessage?.(msg);
}

function refreshLiveChatMessages() {
  return liveChatPanelRef.value?.refreshMessages?.();
}

const replyComposerRef = ref(null);

function clearReplyComposer() {
  replyComposerRef.value?.clear?.();
}

function onTimelineReplyEmail(payload) {
  if (!payload) return;
  const replyAll = Boolean(payload.replyAll);
  const forward = Boolean(payload.forward);
  const message = { ...payload };
  delete message.replyAll;
  delete message.forward;
  replyComposerRef.value?.applyReplyTarget?.(message, { replyAll, forward });
}

defineExpose({ appendLiveChatMessage, refreshLiveChatMessages, clearReplyComposer });

defineEmits([
  'update:activeTab',
  'status-change',
  'priority-change',
  'edit-record',
  'email',
  'delete',
  'copy-url',
  'reopen',
  'chat-updated',
  'typing',
  'send-message',
  'send-email',
  'reply-email',
  'send-note',
  'open-record',
  'link-task'
]);
</script>

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
    >
      <button
        v-for="tab in mainTabs"
        :key="tab.id"
        type="button"
        class="border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="
          activeTab === tab.id
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
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
      <CaseTimelineFeed
        :activities="tabActivities"
        :case-record="caseRecord"
        :empty-title="emptyConversationTitle"
        :empty-message="emptyConversationMessage"
      />
      <CaseResizableReplyComposer
        v-if="!isClosed"
        pane-key="conversation"
        :case-record="caseRecord"
        :sending="sending"
        @send="$emit('send-message', $event)"
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
        :case-record="caseRecord"
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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { TicketIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import RecordPageTitleRow from '@/components/record-page/RecordPageTitleRow.vue';
import RecordClosedBanner from '@/components/record-page/RecordClosedBanner.vue';
import CaseRecordHeader from '@/components/cases/CaseRecordHeader.vue';
import CaseTimelineFeed from '@/components/cases/CaseTimelineFeed.vue';
import CaseResizableReplyComposer from '@/components/cases/CaseResizableReplyComposer.vue';
import CaseTasksTab from '@/components/cases/CaseTasksTab.vue';

defineProps({
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
  notesPlaceholder: { type: String, default: '' }
});

const { t } = useI18n();
const caseModuleLabel = computed(() => t('navigation.moduleCases'));

defineEmits([
  'update:activeTab',
  'status-change',
  'priority-change',
  'edit-record',
  'email',
  'delete',
  'copy-url',
  'reopen',
  'send-message',
  'send-note',
  'open-record',
  'link-task'
]);
</script>

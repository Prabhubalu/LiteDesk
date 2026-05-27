<template>
  <div class="case-record-page-root flex flex-1 min-h-0 flex-col overflow-hidden">
    <RecordPageShell
      :loading="loading"
      :error="error"
      :loading-message="t('cases.recordLoading')"
      :error-title="t('cases.recordErrorTitle')"
      @retry="fetchCase"
    >
      <template v-if="caseRecord" #header>
          <CaseRecordHeader
            :case-record="caseRecord"
            :allowed-status-transitions="allowedStatusTransitions"
            :priorities="priorities"
            :status-updating="statusUpdating"
            :is-closed="isClosed"
            :can-previous="!!neighbors.previousId"
            :can-next="!!neighbors.nextId"
            :can-delete="canDelete"
            :can-edit="canEdit"
            :can-email="!!contactEmail"
            @status-change="onStatusSelect"
            @priority-change="updatePriority"
            @edit-record="openEditDrawer"
            @email="openEmailCompose"
            @delete="showDeleteModal = true"
            @copy-url="copyUrl"
            @previous="goToPrevious"
            @next="goToNext"
          />
      </template>

      <template v-if="caseRecord" #left>
          <div class="case-record-left flex min-h-0 flex-1 flex-col">
            <div class="flex shrink-0 gap-0.5 border-b border-gray-200 dark:border-gray-700">
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
                @click="activeTab = tab.id"
              >
                {{ tab.label }}
              </button>
            </div>

            <template v-if="activeTab === 'conversation'">
              <CaseTimelineFeed
                :activities="tabActivities"
                :case-record="caseRecord"
                :empty-title="t('cases.recordEmptyConversationTitle')"
                :empty-message="t('cases.recordEmptyConversationMessage')"
              />
              <CaseReplyComposer
                :case-record="caseRecord"
                :sending="sending"
                :is-closed="isClosed"
                :disabled="isClosed"
                @send="onSendMessage"
                @reopen="reopenCase"
              />
            </template>

            <template v-else-if="activeTab === 'activity'">
              <CaseTimelineFeed
                :activities="tabActivities"
                :case-record="caseRecord"
                :empty-title="t('cases.recordEmptyActivityTitle')"
                :empty-message="t('cases.recordEmptyActivityMessage')"
              />
            </template>

            <template v-else-if="activeTab === 'notes'">
              <CaseTimelineFeed
                :activities="tabActivities"
                :case-record="caseRecord"
                :empty-title="t('cases.recordEmptyNotesTitle')"
                :empty-message="t('cases.recordEmptyNotesMessage')"
              />
              <CaseReplyComposer
                :case-record="caseRecord"
                :sending="sending"
                :is-closed="isClosed"
                :disabled="isClosed"
                :show-internal-toggle="false"
                :placeholder="t('cases.recordNotesPlaceholder')"
                @send="onSendNote"
                @reopen="reopenCase"
              />
            </template>

            <CaseTasksTab
              v-else-if="activeTab === 'tasks'"
              :case-id="effectiveCaseId"
              :can-edit="canEdit"
              @open-record="openRelatedRecord"
              @link-task="openLinkTaskDrawer"
            />
          </div>
      </template>

      <template v-if="caseRecord" #right>
          <RecordRightPane
            ref="rightPaneRef"
            :tabs="rightPaneTabs"
            default-tab="details"
            :show-header="false"
            :persistence-key="`case-${caseRecord._id}`"
            :record-id="String(caseRecord._id)"
          >
            <template #tab-details>
              <CaseDetailsPanel
                :case-record="caseRecord"
                :case-id="effectiveCaseId"
                :is-closed="isClosed"
                :can-edit="canEdit"
                @edit-record="openEditDrawer"
              />
            </template>

            <template #tab-contact>
              <CaseContactProfilePanel
                :case-record="caseRecord"
                :can-edit="canEditPeople"
              />
            </template>

            <template #tab-related>
              <div class="flex h-full flex-col">
                <div class="record-context-panel__header flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                  <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.relatedTitle') }}</h2>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                      @click="openLinkTaskDrawer"
                    >
                      {{ t('cases.recordTasksLink') }}
                    </button>
                  </div>
                </div>
                <div class="min-h-0 flex-1 overflow-y-auto p-4">
                  <RelatedRecordsPanel
                    app-key="HELPDESK"
                    module-key="cases"
                    :record-id="caseRecord._id"
                  />
                </div>
              </div>
            </template>

            <template #tab-knowledge>
              <CaseKnowledgePanel />
            </template>
          </RecordRightPane>
      </template>
    </RecordPageShell>

    <CreateRecordDrawer
      v-if="caseRecord"
      :is-open="showEditDrawer"
      module-key="cases"
      :record="caseRecord"
      @close="closeEditDrawer"
      @saved="onCaseSaved"
    />

    <EmailComposeDrawer
      :is-open="showEmailModal"
      :related-to="emailRelatedTo"
      :initial-to="contactEmail"
      @close="showEmailModal = false"
      @submit="handleEmailSubmit"
    />

    <LinkRecordsDrawer
      :is-open="showLinkDrawer"
      module-key=""
      source-app-key="HELPDESK"
      source-module-key="cases"
      :multiple="true"
      :title="t('cases.recordTasksLink')"
      :context="{ sourceRecordId: effectiveCaseId }"
      @close="showLinkDrawer = false"
      @linked="onRecordsLinked"
    />

    <DeleteConfirmationModal
      :show="showDeleteModal"
      :record-name="caseRecord?.title || caseRecord?.caseId"
      record-type="cases"
      :deleting="deleting"
      @close="showDeleteModal = false"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  DocumentTextIcon,
  LinkIcon,
  UserIcon,
  BookOpenIcon
} from '@heroicons/vue/24/outline';
import RecordPageShell from '@/components/record-page/RecordPageShell.vue';
import RecordRightPane from '@/components/record-page/RecordRightPane.vue';
import CaseRecordHeader from '@/components/cases/CaseRecordHeader.vue';
import CaseTimelineFeed from '@/components/cases/CaseTimelineFeed.vue';
import CaseReplyComposer from '@/components/cases/CaseReplyComposer.vue';
import CaseTasksTab from '@/components/cases/CaseTasksTab.vue';
import CaseDetailsPanel from '@/components/cases/CaseDetailsPanel.vue';
import CaseContactProfilePanel from '@/components/cases/CaseContactProfilePanel.vue';
import CaseKnowledgePanel from '@/components/cases/CaseKnowledgePanel.vue';
import RelatedRecordsPanel from '@/components/relationships/RelatedRecordsPanel.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';
import LinkRecordsDrawer from '@/components/common/LinkRecordsDrawer.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import { useCaseRecord } from '@/composables/useCaseRecord';
import { useNotifications } from '@/composables/useNotifications';
import { useTabs } from '@/composables/useTabs';
import { useAuthStore } from '@/stores/authRegistry';
import { filterActivitiesForTab } from '@/utils/caseTimeline';
import apiClient from '@/utils/apiClient';
import { invalidateRecordContext } from '@/composables/useRecordContext';

const props = defineProps({
  embed: { type: Boolean, default: false },
  caseId: { type: String, default: null }
});

const emit = defineEmits(['close']);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const notifications = useNotifications();
const { openTab, replaceActiveTab } = useTabs();
const authStore = useAuthStore();

const rightPaneRef = ref(null);

const effectiveCaseId = computed(() => {
  if (props.embed && props.caseId) return props.caseId;
  return route.params?.id || '';
});

const {
  loading,
  error,
  caseRecord,
  sending,
  statusUpdating,
  neighbors,
  contactEmail,
  allowedStatusTransitions,
  isClosed,
  priorities,
  fetchCase,
  updateStatus,
  updatePriority,
  postActivity,
  reopenCase,
  deleteCase
} = useCaseRecord(effectiveCaseId);

const activeTab = ref('conversation');
const showEditDrawer = ref(false);
const showEmailModal = ref(false);
const showLinkDrawer = ref(false);
const showDeleteModal = ref(false);
const deleting = ref(false);

const canEdit = computed(() => authStore.can('cases', 'edit'));
const canEditPeople = computed(() => authStore.can('people', 'edit'));
const canDelete = computed(() => authStore.can('cases', 'delete'));

const emailRelatedTo = computed(() => {
  const id = effectiveCaseId.value;
  return id ? { moduleKey: 'cases', recordId: String(id) } : null;
});

const mainTabs = computed(() => [
  { id: 'conversation', label: t('cases.recordTabConversation') },
  { id: 'tasks', label: t('cases.recordTabTasks') },
  { id: 'activity', label: t('cases.recordTabActivity') },
  { id: 'notes', label: t('cases.recordTabNotes') }
]);

const rightPaneTabs = computed(() => [
  { id: 'details', name: t('cases.recordTabDetails'), icon: DocumentTextIcon },
  { id: 'contact', name: t('cases.recordTabContact'), icon: UserIcon },
  { id: 'related', name: t('records.relatedTitle'), icon: LinkIcon },
  { id: 'knowledge', name: t('cases.recordRailKnowledge'), icon: BookOpenIcon }
]);

const tabActivities = computed(() =>
  filterActivitiesForTab(caseRecord.value?.activities, activeTab.value)
);

function focusRightPaneTab(tabId) {
  if (rightPaneRef.value?.activeTab) {
    rightPaneRef.value.activeTab = tabId;
  }
}

function openEmailCompose() {
  if (!contactEmail.value) {
    notifications.error(t('cases.recordNoContactEmail'));
    return;
  }
  showEmailModal.value = true;
}

async function handleEmailSubmit(payload) {
  showEmailModal.value = false;
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res.success) {
      notifications.success(t('records.genericEmailSent'));
      await fetchCase();
    } else {
      notifications.error(res.message || t('records.genericEmailSendFailed'));
    }
  } catch (err) {
    const msg = err.response?.data?.error || err.response?.data?.message || err.message;
    notifications.error(msg || t('records.genericEmailSendFailed'));
  }
}

async function onStatusSelect(status) {
  if (!status || status === caseRecord.value?.status) return;
  const extra = {};
  if (status === 'Resolved' || status === 'Closed') {
    const existing = caseRecord.value?.resolutionSummary;
    if (!String(existing || '').trim()) {
      const summary = window.prompt(t('cases.recordResolutionPrompt'));
      if (!String(summary || '').trim()) return;
      extra.resolutionSummary = String(summary).trim();
    }
  }
  await updateStatus(status, extra);
}

async function onSendMessage(payload) {
  await postActivity({
    ...payload,
    activityType: payload.internal ? 'comment' : 'agent_message',
    internal: payload.internal
  });
}

async function onSendNote(payload) {
  await postActivity({
    message: payload.message,
    channel: payload.channel,
    internal: true,
    activityType: 'comment'
  });
}

function openEditDrawer() {
  if (!canEdit.value) {
    notifications.warning('You do not have permission to edit cases.');
    return;
  }
  if (isClosed.value) {
    notifications.warning(t('cases.recordEditClosedHint'));
    return;
  }
  showEditDrawer.value = true;
}

function closeEditDrawer() {
  showEditDrawer.value = false;
}

function onCaseSaved() {
  closeEditDrawer();
  fetchCase();
}

function openRelatedRecord(task) {
  if (!task?.recordId) return;
  openTab(`/tasks/${task.recordId}`, { background: false, insertAdjacent: true });
}

function openLinkTaskDrawer() {
  showLinkDrawer.value = true;
}

async function onRecordsLinked(payload = {}) {
  const ids = Array.isArray(payload?.ids) ? payload.ids : [];
  const moduleKey = String(payload?.moduleKey || 'tasks').toLowerCase();
  const relationshipKey = payload?.relationshipKey || 'task_cases';
  const targetAppKey = (payload?.targetAppKey || 'SALES').toUpperCase();
  const caseId = effectiveCaseId.value;

  for (const recordId of ids) {
    try {
      await apiClient.post('/relationships/link', {
        relationshipKey,
        source: { appKey: 'HELPDESK', moduleKey: 'cases', recordId: caseId },
        target: { appKey: targetAppKey, moduleKey, recordId }
      });
    } catch (err) {
      notifications.error(err?.response?.data?.message || 'Failed to link record');
      return;
    }
  }

  showLinkDrawer.value = false;
  invalidateRecordContext('HELPDESK', 'cases', caseId);
  notifications.success(t('cases.recordLinkSuccess'));
  focusRightPaneTab('related');
}

function goToPrevious() {
  if (!neighbors.value.previousId) return;
  const path = `/helpdesk/cases/${neighbors.value.previousId}`;
  if (props.embed) replaceActiveTab(path, { title: t('navigation.moduleCases') });
  else router.push(path);
}

function goToNext() {
  if (!neighbors.value.nextId) return;
  const path = `/helpdesk/cases/${neighbors.value.nextId}`;
  if (props.embed) replaceActiveTab(path, { title: t('navigation.moduleCases') });
  else router.push(path);
}

function copyUrl() {
  navigator.clipboard?.writeText(window.location.href).catch(() => {});
  notifications.success(t('records.useRecordHeaderActionsToastUrlCopiedToClipboard'));
}

async function confirmDelete() {
  deleting.value = true;
  const ok = await deleteCase();
  deleting.value = false;
  showDeleteModal.value = false;
  if (ok) {
    if (props.embed) emit('close');
    else router.push('/helpdesk/cases');
  }
}
</script>

<style scoped>
.case-record-page-root {
  isolation: isolate;
}

/* Let the conversation workspace use full left column width (not max-w-4xl form width). */
.case-record-page-root :deep(.record-page-layout__left-content) {
  max-width: none;
  padding-left: 0;
  padding-right: 0;
}

.case-record-left {
  min-height: calc(100vh - 10rem);
}
</style>

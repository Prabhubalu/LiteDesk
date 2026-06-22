<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <div v-if="loading && !session" class="flex flex-1 items-center justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <div v-else-if="error && !session" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p class="text-sm text-rose-600 dark:text-rose-300">{{ error }}</p>
      <button
        type="button"
        class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-white dark:border-gray-700 dark:text-gray-200"
        @click="load"
      >
        {{ t('actions.retry') }}
      </button>
    </div>

    <template v-else-if="session">
      <LiveChatClosedSessionHeader
        :session="session"
        @back="emit('back')"
      />

      <div
        class="flex shrink-0 gap-0.5 overflow-x-auto border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6"
        role="tablist"
        :aria-label="t('liveChat.closedSessionTabsLabel')"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          class="relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors"
          :class="activeTab === tab.id
            ? 'text-indigo-600 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-indigo-600 dark:text-indigo-400 dark:after:bg-indigo-400'
            : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="flex min-h-0 flex-1 overflow-hidden">
        <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <LiveChatClosedSessionTranscript
            v-if="activeTab === 'transcript'"
            :messages="messages"
            :session="session"
            :loading="messagesLoading"
            :error="messagesError"
            :can-reply="canReply"
            :can-admin="canAdmin"
            :exporting="exporting"
            @export="exportTranscript"
            @add-note="focusNotesTab"
          />

          <div
            v-else-if="activeTab === 'summary'"
            class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          >
            <DetailCard :title="t('liveChat.fieldSummary')">
              <p v-if="summaryLabel" class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                {{ summaryLabel }}
              </p>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('liveChat.closedSessionNoSummary') }}
              </p>
            </DetailCard>
            <DetailCard v-if="tagsLabel.length" :title="t('liveChat.fieldTags')" class="mt-4">
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="tag in tagsLabel"
                  :key="tag"
                  class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {{ tag }}
                </span>
              </div>
            </DetailCard>
            <DetailCard v-if="aiSummaryLabel" :title="t('liveChat.fieldAiSummary')" class="mt-4">
              <p class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ aiSummaryLabel }}</p>
            </DetailCard>
          </div>

          <div
            v-else-if="activeTab === 'journey'"
            class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          >
            <DetailCard :title="t('liveChat.visitorJourneyTitle')">
              <ol v-if="journeyEvents.length" class="space-y-3 border-l border-gray-200 pl-4 dark:border-gray-700">
                <li
                  v-for="event in journeyEvents"
                  :key="event._id"
                  class="relative text-sm text-gray-800 dark:text-gray-200"
                >
                  <span class="absolute -left-[1.27rem] top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
                  <div class="font-medium">{{ journeyPageLabel(event.page) }}</div>
                  <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ journeyEventMeta(event) }}
                  </div>
                </li>
              </ol>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('liveChat.visitorJourneyEmpty') }}
              </p>
            </DetailCard>
          </div>

          <div
            v-else-if="activeTab === 'linkedRecords'"
            class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          >
            <DetailCard :title="t('liveChat.linkedRecordsTitle')">
              <div v-if="linkedRecordRows.length" class="space-y-2">
                <div
                  v-for="row in linkedRecordRows"
                  :key="`${row.moduleKey}-${row.recordId}`"
                  class="rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-700"
                >
                  <div class="flex items-start justify-between gap-2">
                    <RouterLink
                      v-if="row.route"
                      :to="row.route"
                      class="truncate text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {{ row.label }}
                    </RouterLink>
                    <span v-else class="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {{ row.label }}
                    </span>
                    <span
                      v-if="row.status"
                      class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {{ row.status }}
                    </span>
                  </div>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ row.moduleLabel }}</p>
                </div>
              </div>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('liveChat.noLinkedRecords') }}
              </p>
            </DetailCard>
          </div>

          <div
            v-else-if="activeTab === 'notes'"
            class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          >
            <DetailCard :title="t('liveChat.sessionNotesTitle')">
              <div v-if="canReply" class="mb-4 space-y-2">
                <textarea
                  ref="noteInputRef"
                  v-model="noteDraft"
                  rows="3"
                  class="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  :placeholder="t('liveChat.sessionNotePlaceholder')"
                  :disabled="addingNote"
                />
                <button
                  type="button"
                  class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  :disabled="addingNote || !noteDraft.trim()"
                  @click="submitSessionNote"
                >
                  {{ t('liveChat.addSessionNote') }}
                </button>
              </div>
              <p v-if="sessionNotesError" class="mb-3 text-sm text-rose-600 dark:text-rose-300">
                {{ sessionNotesError }}
              </p>
              <ul v-if="sessionNotes.length" class="space-y-2">
                <li
                  v-for="note in sessionNotes"
                  :key="note._id"
                  class="rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-700"
                >
                  <p class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ note.body }}</p>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ sessionNoteMeta(note) }}</p>
                </li>
              </ul>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('liveChat.sessionNotesEmpty') }}
              </p>
            </DetailCard>
          </div>

          <div
            v-else-if="activeTab === 'feedback'"
            class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          >
            <DetailCard :title="t('liveChat.closedSessionFeedbackTitle')">
              <dl class="space-y-3 text-sm">
                <div v-if="csatLabel" class="flex justify-between gap-3">
                  <dt class="text-gray-500 dark:text-gray-400">{{ t('liveChat.fieldCsat') }}</dt>
                  <dd class="font-medium tabular-nums text-gray-900 dark:text-white">{{ csatLabel }}/5</dd>
                </div>
                <div v-if="feedbackCommentLabel" class="space-y-1">
                  <dt class="text-gray-500 dark:text-gray-400">{{ t('liveChat.fieldFeedbackComment') }}</dt>
                  <dd class="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{{ feedbackCommentLabel }}</dd>
                </div>
              </dl>
              <p v-if="!csatLabel && !feedbackCommentLabel" class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('liveChat.closedSessionNoFeedback') }}
              </p>
            </DetailCard>
          </div>

          <div
            v-else-if="activeTab === 'audit'"
            class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          >
            <DetailCard :title="t('liveChat.assignmentHistoryTitle')">
              <ul v-if="assignmentEvents.length" class="space-y-2">
                <li
                  v-for="event in assignmentEvents"
                  :key="event._id"
                  class="rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-700"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ assignmentActionLabel(event) }}
                    </span>
                    <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {{ formatDate(event.createdAt) }}
                    </span>
                  </div>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ assignmentEventLine(event) }}
                  </p>
                </li>
              </ul>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('liveChat.assignmentHistoryEmpty') }}
              </p>
            </DetailCard>
          </div>
        </div>

        <aside class="hidden w-72 shrink-0 overflow-y-auto border-r border-gray-200 bg-[#FAFAF8] dark:border-gray-800 dark:bg-gray-900 lg:block">
          <div class="space-y-4 p-4">
            <DetailCard :title="t('liveChat.closedSessionDetailsCard')">
              <dl class="space-y-2.5 text-sm">
                <MetricRow :label="t('liveChat.detailStatus')" :value="lifecycleLabel" />
                <MetricRow v-if="outcomeLabel" :label="t('liveChat.outcomeLabel')" :value="outcomeLabel" />
                <MetricRow v-if="priorityLabel" :label="t('liveChat.fieldPriority')" :value="priorityLabel" />
                <MetricRow v-if="csatLabel" :label="t('liveChat.fieldCsat')" :value="`${csatLabel}/5`" />
                <MetricRow :label="t('liveChat.detailStartedAt')" :value="startedAtLabel" />
                <MetricRow v-if="endedAtLabel" :label="t('liveChat.detailEndedAt')" :value="endedAtLabel" />
                <MetricRow v-if="durationLabel" :label="t('liveChat.detailDuration')" :value="durationLabel" />
                <MetricRow v-if="waitTimeLabel" :label="t('liveChat.fieldWaitTime')" :value="waitTimeLabel" />
                <MetricRow v-if="firstResponseTimeLabel" :label="t('liveChat.fieldFirstResponseTime')" :value="firstResponseTimeLabel" />
                <MetricRow v-if="handleTimeLabel" :label="t('liveChat.fieldHandleTime')" :value="handleTimeLabel" />
              </dl>
              <div v-if="tagsLabel.length" class="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
                <p class="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {{ t('liveChat.fieldTags') }}
                </p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="tag in tagsLabel"
                    :key="tag"
                    class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </DetailCard>

            <DetailCard :title="t('liveChat.closedSessionAgentCard')">
              <dl class="space-y-2.5 text-sm">
                <MetricRow :label="t('liveChat.detailQueue')" :value="queueLabel" />
                <MetricRow :label="t('liveChat.detailAgent')" :value="assignedAgentLabel" />
                <MetricRow :label="t('liveChat.detailHandledBy')" :value="handledByLabel" />
                <MetricRow :label="t('liveChat.fieldAgentsInvolved')" :value="agentsInvolvedLabel" />
                <template v-if="session?.botInvolved">
                  <MetricRow :label="t('liveChat.fieldBotInvolved')" :value="botInvolvedLabel" />
                  <MetricRow :label="t('liveChat.fieldBotEscalated')" :value="botEscalatedLabel" />
                </template>
              </dl>
            </DetailCard>
          </div>
        </aside>

        <aside class="hidden w-80 shrink-0 overflow-y-auto bg-[#FAFAF8] dark:bg-gray-900 xl:block">
          <div class="space-y-4 p-4">
            <DetailCard :title="t('liveChat.closedSessionVisitorCard')">
              <div class="flex items-start gap-3">
                <AvatarInitials
                  :first-name="visitorFirstName"
                  :last-name="visitorLastName"
                  :email="visitor?.email"
                  size="md"
                />
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ displayName }}</p>
                  <BadgeCell
                    v-if="visitorTypeLabel"
                    :value="visitorTypeLabel"
                    variant="info"
                    class="mt-1"
                  />
                  <dl class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                    <div v-if="visitor?.email">
                      <dt class="sr-only">{{ t('liveChat.visitorEmail') }}</dt>
                      <dd class="truncate">{{ visitor.email }}</dd>
                    </div>
                    <div v-if="visitor?.phone">
                      <dt class="sr-only">{{ t('liveChat.visitorPhone') }}</dt>
                      <dd class="truncate">{{ visitor.phone }}</dd>
                    </div>
                    <div v-if="countryLabel">
                      <dt class="sr-only">{{ t('liveChat.fieldCountry') }}</dt>
                      <dd class="truncate">{{ countryLabel }}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </DetailCard>

            <DetailCard
              v-if="linkedRecordRows.length"
              :title="t('liveChat.linkedRecordsTitle')"
            >
              <ul class="space-y-2">
                <li
                  v-for="row in linkedRecordRows.slice(0, 4)"
                  :key="`${row.moduleKey}-${row.recordId}`"
                >
                  <RouterLink
                    v-if="row.route"
                    :to="row.route"
                    class="block truncate text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {{ row.label }}
                  </RouterLink>
                  <span v-else class="block truncate text-sm text-gray-900 dark:text-white">{{ row.label }}</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{ row.moduleLabel }}</span>
                </li>
              </ul>
            </DetailCard>

            <DetailCard
              v-if="journeyEvents.length"
              :title="t('liveChat.visitorJourneyTitle')"
            >
              <ol class="space-y-2 border-l border-gray-200 pl-3 dark:border-gray-700">
                <li
                  v-for="event in journeyEvents.slice(0, 5)"
                  :key="event._id"
                  class="relative text-xs text-gray-700 dark:text-gray-300"
                >
                  <span class="absolute -left-[0.95rem] top-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  {{ journeyPageLabel(event.page) }}
                </li>
              </ol>
            </DetailCard>

            <DetailCard
              v-if="hasIntelligenceFields"
              :title="t('liveChat.closedSessionInsightsCard')"
            >
              <dl class="space-y-2.5 text-sm">
                <MetricRow v-if="intentLabel" :label="t('liveChat.fieldIntent')" :value="intentLabel" />
                <MetricRow v-if="sentimentLabel" :label="t('liveChat.fieldSentiment')" :value="sentimentLabel" />
                <MetricRow v-if="languageLabel" :label="t('liveChat.fieldLanguage')" :value="languageLabel" />
              </dl>
              <p v-if="aiSummaryLabel" class="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                {{ aiSummaryLabel }}
              </p>
            </DetailCard>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup>
import {
  computed,
  defineComponent,
  h,
  nextTick,
  ref,
  watch,
} from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import LiveChatClosedSessionHeader from '@/components/live-chat/LiveChatClosedSessionHeader.vue';
import LiveChatClosedSessionTranscript from '@/components/live-chat/LiveChatClosedSessionTranscript.vue';
import {
  liveChatLinkedRecordFallbackLabelKey,
  liveChatLinkedRecordModuleLabelKey,
  liveChatLinkedRecordRoute,
  normalizeLiveChatModuleKey,
} from '@/utils/liveChatLinkedRecordRoutes';
import {
  liveChatAgentLabel,
  liveChatAssignedByLabel,
  liveChatAssignmentActionLabel,
  liveChatCsatLabel,
  liveChatIntentLabel,
  liveChatJourneyActionLabel,
  liveChatLifecycleLabel,
  liveChatQueueLabel,
  liveChatSentimentLabel,
  liveChatSessionDuration,
  liveChatSessionEndedAt,
  liveChatSessionFirstResponseTime,
  liveChatSessionHandleTime,
  liveChatSessionPriorityLabel,
  liveChatSessionStartedAt,
  liveChatSessionSummaryLabel,
  liveChatSessionTagsLabel,
  liveChatSessionWaitTime,
  liveChatAgentsInvolvedLabel,
  liveChatOutcomeLabel,
  liveChatVisitorTypeLabel,
  liveChatYesNoLabel,
} from '@/utils/liveChatSessionDisplay';
import { canAdminLiveChat, canReplyLiveChatSessions } from '@/utils/liveChatPermissions';

const DetailCard = defineComponent({
  name: 'LiveChatClosedSessionDetailCard',
  props: {
    title: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () => h('section', {
      class: 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950',
    }, [
      h('h3', {
        class: 'text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400',
      }, props.title),
      h('div', { class: 'mt-3' }, slots.default?.()),
    ]);
  },
});

const MetricRow = defineComponent({
  name: 'LiveChatClosedSessionMetricRow',
  props: {
    label: { type: String, required: true },
    value: { type: String, default: '—' },
  },
  setup(props) {
    return () => h('div', { class: 'flex justify-between gap-3' }, [
      h('dt', { class: 'text-gray-500 dark:text-gray-400' }, props.label),
      h('dd', { class: 'truncate text-right font-medium text-gray-900 dark:text-white' }, props.value || '—'),
    ]);
  },
});

const props = defineProps({
  sessionId: { type: String, required: true },
});

const emit = defineEmits(['back']);

const { t, te } = useI18n();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref('');
const session = ref(null);
const messages = ref([]);
const messagesLoading = ref(false);
const messagesError = ref('');
const linkedRecords = ref([]);
const journeyEvents = ref([]);
const sessionNotes = ref([]);
const sessionNotesError = ref('');
const assignmentEvents = ref([]);
const activeTab = ref('transcript');
const noteDraft = ref('');
const addingNote = ref(false);
const exporting = ref(false);
const noteInputRef = ref(null);

const canReply = computed(() => canReplyLiveChatSessions(authStore.user));
const canAdmin = computed(() => canAdminLiveChat(authStore.user));

const lifecycleLabel = computed(() => liveChatLifecycleLabel(session.value?.lifecycleStatus, t));
const outcomeLabel = computed(() => liveChatOutcomeLabel(session.value?.outcome, t));
const priorityLabel = computed(() => liveChatSessionPriorityLabel(session.value?.priority, t));
const queueLabel = computed(() => liveChatQueueLabel(session.value, t));
const assignedAgentLabel = computed(() => liveChatAgentLabel(session.value?.assignedAgent, t));
const handledByLabel = computed(() => liveChatAgentLabel(session.value?.handledBy, t));
const agentsInvolvedLabel = computed(() => liveChatAgentsInvolvedLabel(session.value, t));
const startedAtLabel = computed(() => liveChatSessionStartedAt(session.value) || '—');
const endedAtLabel = computed(() => liveChatSessionEndedAt(session.value) || '');
const durationLabel = computed(() => liveChatSessionDuration(session.value) || '');
const waitTimeLabel = computed(() => liveChatSessionWaitTime(session.value));
const firstResponseTimeLabel = computed(() => liveChatSessionFirstResponseTime(session.value));
const handleTimeLabel = computed(() => liveChatSessionHandleTime(session.value));
const summaryLabel = computed(() => liveChatSessionSummaryLabel(session.value));
const tagsLabel = computed(() => liveChatSessionTagsLabel(session.value));
const csatLabel = computed(() => liveChatCsatLabel(session.value));
const feedbackCommentLabel = computed(() => String(session.value?.feedbackComment || '').trim());
const aiSummaryLabel = computed(() => String(session.value?.aiSummary || '').trim());
const intentLabel = computed(() => liveChatIntentLabel(session.value?.intent, t));
const sentimentLabel = computed(() => liveChatSentimentLabel(session.value?.sentiment, t));
const languageLabel = computed(() => String(session.value?.language || '').trim());
const botInvolvedLabel = computed(() => liveChatYesNoLabel(Boolean(session.value?.botInvolved), t));
const botEscalatedLabel = computed(() => liveChatYesNoLabel(Boolean(session.value?.botEscalated), t));
const visitorTypeLabel = computed(() => liveChatVisitorTypeLabel(session.value?.visitorType, t));
const countryLabel = computed(() => String(session.value?.country || '').trim());

const hasIntelligenceFields = computed(() => Boolean(
  intentLabel.value || sentimentLabel.value || aiSummaryLabel.value,
));

const visitor = computed(() => session.value?.visitor || {});

const displayName = computed(() => {
  const name = String(visitor.value?.name || '').trim();
  if (name) return name;
  const email = String(visitor.value?.email || '').trim();
  if (email) return email;
  return t('liveChat.anonymousVisitor');
});

const visitorFirstName = computed(() => {
  const name = String(visitor.value?.name || '').trim();
  if (!name) return '';
  return name.split(/\s+/)[0] || '';
});

const visitorLastName = computed(() => {
  const name = String(visitor.value?.name || '').trim();
  if (!name) return '';
  const parts = name.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
});

const linkedRecordRows = computed(() => linkedRecords.value.map((entry) => mapLinkedRecordRow(entry)));

const feedbackCount = computed(() => (csatLabel.value || feedbackCommentLabel.value ? 1 : 0));

const tabs = computed(() => [
  { id: 'transcript', label: t('liveChat.closedSessionTabTranscript') },
  { id: 'summary', label: t('liveChat.closedSessionTabSummary') },
  { id: 'journey', label: t('liveChat.closedSessionTabJourney') },
  {
    id: 'linkedRecords',
    label: linkedRecordRows.value.length
      ? t('liveChat.closedSessionTabLinkedRecordsCount', { count: linkedRecordRows.value.length })
      : t('liveChat.closedSessionTabLinkedRecords'),
  },
  {
    id: 'notes',
    label: sessionNotes.value.length
      ? t('liveChat.closedSessionTabNotesCount', { count: sessionNotes.value.length })
      : t('liveChat.closedSessionTabNotes'),
  },
  {
    id: 'feedback',
    label: feedbackCount.value
      ? t('liveChat.closedSessionTabFeedbackCount', { count: feedbackCount.value })
      : t('liveChat.closedSessionTabFeedback'),
  },
  { id: 'audit', label: t('liveChat.closedSessionTabAudit') },
]);

function mapLinkedRecordRow(entry) {
  const moduleKey = normalizeLiveChatModuleKey(entry?.moduleKey);
  const recordId = entry?.recordId ? String(entry.recordId) : '';
  const explicitLabel = String(entry?.label || '').trim();
  const fallbackKey = liveChatLinkedRecordFallbackLabelKey(moduleKey);
  const fallbackLabel = fallbackKey === 'liveChat.linkedCaseLabel'
    ? t(fallbackKey, { id: recordId.slice(-6) })
    : t(fallbackKey);
  const moduleLabelKey = liveChatLinkedRecordModuleLabelKey(moduleKey);
  const moduleLabel = moduleLabelKey && te(moduleLabelKey)
    ? t(moduleLabelKey)
    : t('liveChat.linkedRecordModuleFallback');

  return {
    moduleKey,
    recordId,
    moduleLabel,
    label: explicitLabel || fallbackLabel,
    status: entry?.status || null,
    route: liveChatLinkedRecordRoute(moduleKey, recordId),
  };
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

function journeyPageLabel(page) {
  const path = formatPagePath(String(page || '').trim());
  return path || String(page || '').trim() || '—';
}

function formatPagePath(url) {
  if (!url) return '';
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

function journeyEventMeta(event) {
  const action = liveChatJourneyActionLabel(event?.action, t);
  const when = formatDate(event?.createdAt);
  return [action, when].filter(Boolean).join(' · ');
}

function assignmentActionLabel(event) {
  return liveChatAssignmentActionLabel(event?.action, t);
}

function assignmentEventLine(event) {
  const agent = liveChatAgentLabel(event?.agent, t);
  const performer = liveChatAgentLabel(event?.performedBy, t);
  const assignedBy = liveChatAssignedByLabel(event?.assignedBy, t);
  const parts = [agent];
  if (assignedBy) parts.push(assignedBy);
  if (performer && performer !== agent) parts.push(performer);
  return parts.filter(Boolean).join(' · ');
}

function sessionNoteMeta(note) {
  const author = liveChatAgentLabel(note?.author, t);
  const when = formatDate(note?.createdAt);
  return [author, when].filter(Boolean).join(' · ');
}

function focusNotesTab() {
  activeTab.value = 'notes';
  nextTick(() => noteInputRef.value?.focus?.());
}

async function loadSession() {
  const res = await apiClient.get(`/live-chat/sessions/${props.sessionId}`);
  if (res?.success) {
    session.value = res.data || null;
    return session.value;
  }
  throw new Error(res?.message || t('liveChat.loadFailed'));
}

async function loadMessages() {
  messagesLoading.value = true;
  messagesError.value = '';
  try {
    const res = await apiClient.get(`/live-chat/sessions/${props.sessionId}/messages`, {
      params: { limit: 500 },
    });
    messages.value = res?.success && Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    messagesError.value = err?.message || t('liveChat.loadFailed');
    messages.value = [];
  } finally {
    messagesLoading.value = false;
  }
}

async function loadLinkedRecords() {
  try {
    const res = await apiClient.get(`/live-chat/sessions/${props.sessionId}/linked-records`);
    linkedRecords.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    linkedRecords.value = [];
  }
}

async function loadJourneyEvents() {
  try {
    const res = await apiClient.get(`/live-chat/sessions/${props.sessionId}/journey`);
    journeyEvents.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    journeyEvents.value = [];
  }
}

async function loadSessionNotes() {
  try {
    const res = await apiClient.get(`/live-chat/sessions/${props.sessionId}/notes`);
    sessionNotes.value = Array.isArray(res?.data) ? res.data : [];
    sessionNotesError.value = '';
  } catch {
    sessionNotes.value = [];
    sessionNotesError.value = t('liveChat.sessionNotesLoadFailed');
  }
}

async function loadAssignmentHistory() {
  try {
    const res = await apiClient.get(`/live-chat/sessions/${props.sessionId}/assignment-events`);
    assignmentEvents.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    assignmentEvents.value = [];
  }
}

async function submitSessionNote() {
  const body = String(noteDraft.value || '').trim();
  if (!body || !canReply.value) return;

  addingNote.value = true;
  sessionNotesError.value = '';
  try {
    const res = await apiClient.post(`/live-chat/sessions/${props.sessionId}/notes`, { body });
    if (res?.data) {
      sessionNotes.value = [res.data, ...sessionNotes.value];
      noteDraft.value = '';
    }
  } catch (err) {
    sessionNotesError.value = err?.message || t('liveChat.sessionNoteAddFailed');
  } finally {
    addingNote.value = false;
  }
}

function downloadBlob(blob, filename, mime) {
  const url = URL.createObjectURL(new Blob([blob], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportTranscript() {
  if (!canAdmin.value) return;

  exporting.value = true;
  try {
    const res = await fetch(`/api/live-chat/sessions/${encodeURIComponent(props.sessionId)}/export`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(t('liveChat.exportTranscriptFailed'));
    const text = await res.text();
    const fileKey = String(session.value?.sessionKey || props.sessionId).replace(/[^\w.-]+/g, '_');
    downloadBlob(text, `live-chat-${fileKey}.json`, 'application/json');
    await loadSession();
  } catch {
    // export errors are non-blocking in closed detail view
  } finally {
    exporting.value = false;
  }
}

async function load() {
  const sessionId = String(props.sessionId || '').trim();
  if (!sessionId) return;

  loading.value = true;
  error.value = '';
  session.value = null;
  activeTab.value = 'transcript';

  try {
    await loadSession();
    await Promise.all([
      loadMessages(),
      loadLinkedRecords(),
      loadJourneyEvents(),
      loadSessionNotes(),
      loadAssignmentHistory(),
    ]);
  } catch (err) {
    error.value = err?.message || t('liveChat.loadFailed');
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.sessionId,
  () => load(),
  { immediate: true },
);
</script>

<!--
  InboxContextPanel — CRM context rail for the inbox split view.
  Shows contact/record summary, quick actions, and AI insights placeholders.
-->
<template>
  <aside
    class="inbox-context-panel hidden h-full min-h-0 w-[min(100%,320px)] shrink-0 flex-col overflow-hidden border-l border-neutral-200/90 bg-white dark:border-gray-700 dark:bg-gray-900 xl:flex"
    :aria-label="t('inbox.inboxContextPanelTitle')"
  >
    <header class="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-gray-800">
      <button
        v-if="recordPath"
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:text-gray-400 dark:hover:bg-gray-800"
        :title="t('inbox.inboxContextPanelOpenRecord')"
        @click="emit('open-record')"
      >
        <ArrowTopRightOnSquareIcon class="h-4 w-4" />
      </button>
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
          {{ displayName }}
        </h3>
        <p v-if="subtitle" class="truncate text-xs text-neutral-500 dark:text-gray-400">
          {{ subtitle }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:text-gray-400 dark:hover:bg-gray-800"
        :title="t('settings.roleDrawerCloseSr')"
        :aria-label="t('settings.roleDrawerCloseSr')"
        @click="emit('close')"
      >
        <XMarkIcon class="h-4 w-4" />
      </button>
    </header>

    <div class="arivu-scrollbar flex-1 overflow-y-auto">
      <div v-if="!hasRecord" class="px-4 py-8 text-center">
        <UserCircleIcon class="mx-auto h-12 w-12 text-neutral-300 dark:text-gray-600" />
        <p class="mt-3 text-sm font-medium text-neutral-800 dark:text-gray-200">
          {{ t('inbox.inboxContextPanelNoContact') }}
        </p>
        <p class="mt-1 text-xs text-neutral-500 dark:text-gray-400">
          {{ t('inbox.inboxContextPanelNoContactHint') }}
        </p>
      </div>

      <template v-else>
        <div class="border-b border-neutral-100 px-4 py-5 text-center dark:border-gray-800">
          <span
            class="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-semibold uppercase shadow-sm ring-1 ring-neutral-200/80 dark:ring-gray-600"
            :class="avatarClass"
          >
            {{ avatarInitial }}
          </span>
          <h4 class="mt-3 text-base font-semibold text-neutral-900 dark:text-white">
            {{ displayName }}
          </h4>
          <p v-if="recordKindLabel" class="mt-0.5 text-xs font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400">
            {{ recordKindLabel }}
          </p>
          <p v-if="participantEmail" class="mt-1 truncate text-sm text-neutral-500 dark:text-gray-400">
            {{ participantEmail }}
          </p>

          <div class="mt-4 flex items-center justify-center gap-1">
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              :title="t('records.activityReply')"
              @click="emit('reply')"
            >
              <ChatBubbleLeftIcon class="h-4 w-4" />
            </button>
            <button
              v-if="recordPath"
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              :title="t('inbox.inboxContextPanelOpenRecord')"
              @click="emit('open-record')"
            >
              <ArrowTopRightOnSquareIcon class="h-4 w-4" />
            </button>
          </div>
        </div>

        <section class="border-b border-neutral-100 px-4 py-4 dark:border-gray-800">
          <div class="flex items-center justify-between gap-2">
            <h5 class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-gray-500">
              {{ t('inbox.inboxContextPanelDetails') }}
            </h5>
            <button
              v-if="recordPath"
              type="button"
              class="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
              @click="emit('open-record')"
            >
              {{ t('actions.edit') }}
            </button>
          </div>
          <dl class="mt-3 space-y-2.5">
            <div v-if="recordKindLabel" class="flex justify-between gap-3 text-sm">
              <dt class="text-neutral-500 dark:text-gray-400">{{ t('inbox.inboxContextPanelType') }}</dt>
              <dd class="truncate font-medium text-neutral-900 dark:text-white">{{ recordKindLabel }}</dd>
            </div>
            <div v-if="threadRow?.recordLabel" class="flex justify-between gap-3 text-sm">
              <dt class="text-neutral-500 dark:text-gray-400">{{ t('inbox.inboxContextPanelRecord') }}</dt>
              <dd class="truncate font-medium text-neutral-900 dark:text-white">{{ threadRow.recordLabel }}</dd>
            </div>
            <div v-if="threadRow?.assignedToDisplay" class="flex justify-between gap-3 text-sm">
              <dt class="text-neutral-500 dark:text-gray-400">{{ t('common.formAssignToMe') }}</dt>
              <dd class="truncate font-medium text-neutral-900 dark:text-white">{{ threadRow.assignedToDisplay }}</dd>
            </div>
          </dl>
        </section>

        <section class="border-b border-neutral-100 px-4 py-4 dark:border-gray-800">
          <div class="flex items-center justify-between gap-2">
            <h5 class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-gray-500">
              {{ t('inbox.inboxContextPanelDeals') }}
            </h5>
          </div>
          <p class="mt-3 text-xs text-neutral-500 dark:text-gray-400">
            {{ t('inbox.inboxContextPanelDealsHint') }}
          </p>
        </section>

        <section class="border-b border-neutral-100 px-4 py-4 dark:border-gray-800">
          <h5 class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-gray-500">
            {{ t('inbox.inboxContextPanelRecentActivity') }}
          </h5>
          <ul class="mt-3 space-y-3">
            <li
              v-for="(item, idx) in activityItems"
              :key="idx"
              class="flex gap-3"
            >
              <span
                class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-gray-800 dark:text-gray-300"
              >
                <component :is="item.icon" class="h-3.5 w-3.5" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-neutral-800 dark:text-gray-200">{{ item.label }}</p>
                <p class="text-xs text-neutral-500 dark:text-gray-400">{{ item.time }}</p>
              </div>
            </li>
          </ul>
        </section>
      </template>

      <section class="m-4 rounded-xl border border-primary-200/80 bg-primary-50/60 p-4 dark:border-primary-900/50 dark:bg-primary-950/30">
        <div class="flex items-center gap-2">
          <SparklesIcon class="h-4 w-4 text-primary-600 dark:text-primary-400" />
          <h5 class="text-sm font-semibold text-primary-900 dark:text-primary-100">
            {{ t('inbox.inboxContextPanelAiInsights') }}
          </h5>
          <span class="rounded-md bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700 dark:bg-primary-900/60 dark:text-primary-300">
            {{ t('inbox.inboxContextPanelBeta') }}
          </span>
        </div>
        <dl class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between gap-2">
            <dt class="text-neutral-600 dark:text-gray-400">{{ t('inbox.inboxContextPanelSentiment') }}</dt>
            <dd class="font-medium text-success-600 dark:text-success-400">{{ t('inbox.inboxContextPanelSentimentPositive') }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt class="text-neutral-600 dark:text-gray-400">{{ t('inbox.inboxContextPanelUrgency') }}</dt>
            <dd class="font-medium text-danger-600 dark:text-danger-400">{{ t('inbox.inboxContextPanelUrgencyMedium') }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt class="text-neutral-600 dark:text-gray-400">{{ t('inbox.inboxContextPanelIntent') }}</dt>
            <dd class="truncate font-medium text-neutral-800 dark:text-gray-200">{{ t('inbox.inboxContextPanelIntentFollowUp') }}</dd>
          </div>
        </dl>
        <button
          type="button"
          class="mt-4 w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500"
          @click="emit('suggest-reply')"
        >
          {{ t('inbox.inboxContextPanelSuggestReply') }}
        </button>
      </section>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftIcon,
  EnvelopeIcon,
  SparklesIcon,
  UserCircleIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { threadListSenderLine } from '@/utils/emailParticipantDisplay';

const props = defineProps({
  threadRow: { type: Object, default: null },
  recordPath: { type: String, default: '' }
});

const emit = defineEmits(['close', 'open-record', 'reply', 'suggest-reply']);

const { t } = useI18n();

const hasRecord = computed(() => Boolean(props.threadRow?.relatedTo?.recordId && props.recordPath));

const displayName = computed(() => {
  const name = threadListSenderLine(props.threadRow?.participantDisplay, {
    recordLabel: props.threadRow?.recordLabel,
    relatedModuleKey: props.threadRow?.relatedTo?.moduleKey
  });
  if (name && name !== 'Unknown') return name;
  return t('inbox.inboxContextPanelUnknownContact');
});

const subtitle = computed(() => {
  const mk = props.threadRow?.relatedTo?.moduleKey;
  if (!mk) return '';
  const m = String(mk).toLowerCase();
  if (m === 'workspace') return t('inbox.inboxSurfaceWorkspaceMail');
  return String(mk);
});

const recordKindLabel = computed(() => {
  const mk = props.threadRow?.relatedTo?.moduleKey;
  if (!mk) return '';
  const m = String(mk).toLowerCase();
  if (m === 'people') return t('inbox.inboxContextPanelKindPerson');
  if (m === 'organizations') return t('inbox.inboxContextPanelKindOrganization');
  if (m === 'deals') return t('inbox.inboxContextPanelKindDeal');
  if (m === 'tasks') return t('inbox.inboxContextPanelKindTask');
  if (m === 'cases') return t('inbox.inboxContextPanelKindCase');
  return String(mk);
});

const participantEmail = computed(() => {
  const p = String(props.threadRow?.participantDisplay || '');
  const emailMatch = p.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return emailMatch ? emailMatch[0] : '';
});

const avatarInitial = computed(() => {
  const ch = displayName.value.trim().charAt(0);
  return /[a-z0-9]/i.test(ch) ? ch.toUpperCase() : '?';
});

const avatarClass = computed(() => {
  const palette = [
    'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200',
    'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
  ];
  let hash = 0;
  const s = displayName.value;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
});

const activityItems = computed(() => {
  const items = [];
  if (props.threadRow?.lastActivityAt) {
    items.push({
      icon: EnvelopeIcon,
      label: t('inbox.inboxContextPanelActivityEmail'),
      time: formatShortTime(props.threadRow.lastActivityAt)
    });
  }
  if (props.threadRow?.messageCount > 1) {
    items.push({
      icon: ChatBubbleLeftIcon,
      label: t('inbox.inboxContextPanelActivityThread', { count: props.threadRow.messageCount }),
      time: ''
    });
  }
  return items.length ? items : [{
    icon: EnvelopeIcon,
    label: t('inbox.inboxContextPanelActivityNone'),
    time: ''
  }];
});

function formatShortTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
</script>

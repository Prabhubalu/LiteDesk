<!--
  InboxContextPanel — CRM context rail beside the inbox reader.
-->
<template>
  <aside
    class="inbox-context-panel flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden bg-[#FAFAF8] dark:bg-gray-900"
    :class="embedded ? '' : 'hidden w-[min(100%,320px)] xl:flex'"
    :aria-label="t('inbox.inboxContextPanelTitle')"
  >
    <header class="flex items-center gap-2 border-b border-[#EBEBEB] px-3 py-2.5 dark:border-gray-800">
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-[13px] font-semibold text-[#37352F] dark:text-white">
          {{ t('inbox.inboxContextPanelTitle') }}
        </h3>
        <p v-if="subtitle" class="truncate text-[11px] text-[#9B9A97] dark:text-gray-500">
          {{ subtitle }}
        </p>
      </div>
      <button
        v-if="recordPath"
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
        :title="t('inbox.inboxContextPanelOpenRecord')"
        @click="emit('open-record')"
      >
        <ArrowTopRightOnSquareIcon class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
        :title="t('inbox.inboxContextPanelCollapse')"
        :aria-label="t('inbox.inboxContextPanelCollapse')"
        @click="emit('close')"
      >
        <ChevronRightIcon class="h-4 w-4" />
      </button>
    </header>

    <div class="arivu-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div v-if="!hasRecord" class="px-4 py-8 text-center">
        <UserCircleIcon class="mx-auto h-10 w-10 text-[#D3D1CB] dark:text-gray-600" />
        <p class="mt-3 text-sm font-medium text-[#37352F] dark:text-gray-200">
          {{ t('inbox.inboxContextPanelNoContact') }}
        </p>
        <p class="mt-1 text-xs text-[#9B9A97] dark:text-gray-500">
          {{ t('inbox.inboxContextPanelNoContactHint') }}
        </p>
      </div>

      <template v-else>
        <div class="border-b border-[#EBEBEB] px-4 py-4 text-center dark:border-gray-800">
          <span
            class="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-semibold uppercase ring-1 ring-[#EBEBEB] dark:ring-gray-700"
            :class="avatarClass"
          >
            {{ avatarInitial }}
          </span>
          <h4 class="mt-3 text-[15px] font-semibold text-[#37352F] dark:text-white">
            {{ displayName }}
          </h4>
          <p v-if="recordKindLabel" class="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[#2383E2] dark:text-blue-400">
            {{ recordKindLabel }}
          </p>
          <p v-if="participantEmail" class="mt-1 truncate text-sm text-[#9B9A97] dark:text-gray-500">
            {{ participantEmail }}
          </p>

          <div class="mt-3 flex items-center justify-center gap-1.5">
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#EBEBEB] text-[#787774] hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              :title="t('records.activityReply')"
              @click="emit('reply')"
            >
              <ChatBubbleLeftIcon class="h-4 w-4" />
            </button>
            <button
              v-if="recordPath"
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#EBEBEB] text-[#787774] hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              :title="t('inbox.inboxContextPanelOpenRecord')"
              @click="emit('open-record')"
            >
              <ArrowTopRightOnSquareIcon class="h-4 w-4" />
            </button>
          </div>
        </div>

        <section class="border-b border-[#EBEBEB] px-4 py-3 dark:border-gray-800">
          <div class="flex items-center justify-between gap-2">
            <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
              {{ t('inbox.inboxContextPanelDetails') }}
            </h5>
            <button
              v-if="recordPath"
              type="button"
              class="text-[11px] font-medium text-[#2383E2] hover:underline dark:text-blue-400"
              @click="emit('open-record')"
            >
              {{ t('actions.edit') }}
            </button>
          </div>
          <dl class="mt-2.5 space-y-2">
            <div v-if="recordKindLabel" class="flex justify-between gap-3 text-[13px]">
              <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('inbox.inboxContextPanelType') }}</dt>
              <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ recordKindLabel }}</dd>
            </div>
            <div v-if="threadRow?.recordLabel" class="flex justify-between gap-3 text-[13px]">
              <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('inbox.inboxContextPanelRecord') }}</dt>
              <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ threadRow.recordLabel }}</dd>
            </div>
            <div v-if="threadRow?.assignedToDisplay" class="flex justify-between gap-3 text-[13px]">
              <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('common.formAssignToMe') }}</dt>
              <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ threadRow.assignedToDisplay }}</dd>
            </div>
          </dl>
        </section>

        <section class="border-b border-[#EBEBEB] px-4 py-3 dark:border-gray-800">
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('inbox.inboxContextPanelDeals') }}
          </h5>
          <p class="mt-2 text-[12px] text-[#9B9A97] dark:text-gray-500">
            {{ t('inbox.inboxContextPanelDealsHint') }}
          </p>
        </section>

        <section class="border-b border-[#EBEBEB] px-4 py-3 dark:border-gray-800">
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('inbox.inboxContextPanelRecentActivity') }}
          </h5>
          <ul class="mt-2.5 space-y-2.5">
            <li
              v-for="(item, idx) in activityItems"
              :key="idx"
              class="flex gap-2.5"
            >
              <span
                class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F1EF] text-[#787774] dark:bg-gray-800 dark:text-gray-300"
              >
                <component :is="item.icon" class="h-3.5 w-3.5" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-[13px] text-[#37352F] dark:text-gray-200">{{ item.label }}</p>
                <p v-if="item.time" class="text-[11px] text-[#9B9A97] dark:text-gray-500">{{ item.time }}</p>
              </div>
            </li>
          </ul>
        </section>
      </template>

      <section class="m-3 rounded-xl border border-[#EBEBEB] bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
        <div class="flex items-center gap-2">
          <SparklesIcon class="h-4 w-4 text-[#2383E2] dark:text-blue-400" />
          <h5 class="text-[13px] font-semibold text-[#37352F] dark:text-white">
            {{ t('inbox.inboxContextPanelAiInsights') }}
          </h5>
          <span class="rounded-md bg-[#F1F1EF] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#787774] dark:bg-gray-800 dark:text-gray-400">
            {{ t('inbox.inboxContextPanelBeta') }}
          </span>
        </div>
        <dl class="mt-2.5 space-y-2 text-[13px]">
          <div class="flex justify-between gap-2">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('inbox.inboxContextPanelSentiment') }}</dt>
            <dd class="font-medium text-emerald-600 dark:text-emerald-400">{{ t('inbox.inboxContextPanelSentimentPositive') }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('inbox.inboxContextPanelUrgency') }}</dt>
            <dd class="font-medium text-amber-600 dark:text-amber-400">{{ t('inbox.inboxContextPanelUrgencyMedium') }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('inbox.inboxContextPanelIntent') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-gray-200">{{ t('inbox.inboxContextPanelIntentFollowUp') }}</dd>
          </div>
        </dl>
        <button
          type="button"
          class="mt-3 w-full rounded-lg bg-[#2383E2] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#1a6ec2] dark:bg-blue-600 dark:hover:bg-blue-500"
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
  ChevronRightIcon,
  EnvelopeIcon,
  SparklesIcon,
  UserCircleIcon
} from '@heroicons/vue/24/outline';
import { threadListSenderLine } from '@/utils/emailParticipantDisplay';
import { formatDate } from '@/utils/localeFormat';

const props = defineProps({
  threadRow: { type: Object, default: null },
  recordPath: { type: String, default: '' },
  embedded: { type: Boolean, default: false }
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
  return props.threadRow?.recordLabel && props.threadRow.recordLabel !== '—'
    ? props.threadRow.recordLabel
    : t('inbox.inboxContextPanelUnknownContact');
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
    'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
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
  return formatDate(d, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
</script>

<template>
  <div v-if="columnKey === 'visitor'" class="flex min-w-0 items-center gap-3">
    <Avatar :user="visitorUser(row)" size="md" />
    <div class="min-w-0 flex-1">
      <div class="truncate font-semibold text-gray-900 dark:text-white">
        {{ visitorLabel(row) }}
      </div>
      <div
        v-if="visitorSubtitle(row)"
        class="truncate text-sm text-gray-500 dark:text-gray-400"
      >
        {{ visitorSubtitle(row) }}
      </div>
    </div>
  </div>

  <span
    v-else-if="columnKey === 'sessionKey'"
    class="font-mono text-sm text-gray-700 dark:text-gray-300"
  >
    {{ sessionKeyLabel(row) }}
  </span>

  <BadgeCell
    v-else-if="columnKey === 'channel'"
    :value="channelLabel(row)"
    variant="info"
  />

  <BadgeCell
    v-else-if="columnKey === 'lifecycleStatus'"
    :value="lifecycleLabel(row)"
    :variant-map="LIVE_CHAT_LIFECYCLE_BADGE_VARIANTS"
  />

  <BadgeCell
    v-else-if="columnKey === 'outcome'"
    :value="outcomeLabel(row) || '—'"
    :variant="outcomeLabel(row) ? outcomeBadgeVariant(row) : 'default'"
  />

  <BadgeCell
    v-else-if="columnKey === 'priority'"
    :value="priorityLabel(row) || '—'"
    :variant-map="LIVE_CHAT_PRIORITY_BADGE_VARIANTS"
  />

  <BadgeCell
    v-else-if="columnKey === 'sentiment'"
    :value="sentimentLabel(row) || '—'"
    :variant-map="LIVE_CHAT_SENTIMENT_BADGE_VARIANTS"
  />

  <BadgeCell
    v-else-if="columnKey === 'visitorType'"
    :value="visitorTypeLabel(row) || '—'"
    variant="default"
  />

  <div v-else-if="columnKey === 'assignedAgent'" class="flex min-w-0 items-center gap-2">
    <template v-if="hasAgent(row.assignedAgent)">
      <Avatar :user="agentUser(row.assignedAgent)" size="sm" />
      <span class="truncate text-sm text-gray-700 dark:text-gray-300">
        {{ agentDisplayName(row.assignedAgent) }}
      </span>
    </template>
    <span v-else class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.editableUnassigned') }}
    </span>
  </div>

  <div v-else-if="columnKey === 'handledBy'" class="flex min-w-0 items-center gap-2">
    <template v-if="hasAgent(row.handledBy)">
      <Avatar :user="agentUser(row.handledBy)" size="sm" />
      <span class="truncate text-sm text-gray-700 dark:text-gray-300">
        {{ agentDisplayName(row.handledBy) }}
      </span>
    </template>
    <span v-else class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.editableUnassigned') }}
    </span>
  </div>

  <DateCell
    v-else-if="columnKey === 'startedAt'"
    :value="row.createdAt"
    format="short"
  />

  <DateCell
    v-else-if="columnKey === 'endedAt'"
    :value="row.endedAt || row.lastMessageAt"
    format="short"
  />

  <span v-else-if="columnKey === 'tags'" class="inline-flex min-w-0 flex-wrap items-center gap-1">
    <template v-if="tagsLabel(row).length">
      <span
        v-for="tag in tagsLabel(row).slice(0, 3)"
        :key="tag"
        class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
      >
        {{ tag }}
      </span>
      <span
        v-if="tagsLabel(row).length > 3"
        class="text-[11px] text-gray-400 dark:text-gray-500"
      >
        +{{ tagsLabel(row).length - 3 }}
      </span>
    </template>
    <span v-else class="text-sm text-gray-400">—</span>
  </span>

  <span
    v-else-if="columnKey === 'summary'"
    class="line-clamp-2 text-sm text-gray-700 dark:text-gray-300"
  >
    {{ summaryLabel(row) || '—' }}
  </span>

  <span
    v-else-if="columnKey === 'csatScore'"
    class="text-sm tabular-nums text-gray-700 dark:text-gray-300"
  >
    {{ csatLabel(row) ? `${csatLabel(row)}/5` : '—' }}
  </span>

  <span v-else class="truncate text-sm text-gray-700 dark:text-gray-300">
    {{ textLabel }}
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Avatar from '@/components/common/Avatar.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import {
  LIVE_CHAT_LIFECYCLE_BADGE_VARIANTS,
  LIVE_CHAT_PRIORITY_BADGE_VARIANTS,
  LIVE_CHAT_SENTIMENT_BADGE_VARIANTS,
  liveChatAgentLabel,
  liveChatChannelLabel,
  liveChatIntentLabel,
  liveChatLifecycleLabel,
  liveChatOutcomeBadgeVariant,
  liveChatOutcomeLabel,
  liveChatCsatLabel,
  liveChatQueueLabel,
  liveChatSentimentLabel,
  liveChatSessionDuration,
  liveChatSessionFirstResponseTime,
  liveChatSessionHandleTime,
  liveChatSessionKeyLabel,
  liveChatSessionSummaryLabel,
  liveChatSessionTagsLabel,
  liveChatSessionWaitTime,
  liveChatVisitorLabel,
  liveChatVisitorTypeLabel,
  liveChatSessionPriorityLabel,
  liveChatYesNoLabel,
  liveChatUserRefForAvatar,
} from '@/utils/liveChatSessionDisplay';

const props = defineProps({
  columnKey: { type: String, required: true },
  row: { type: Object, required: true },
});

const { t } = useI18n();

function visitorLabel(row) {
  return liveChatVisitorLabel(row, t);
}

function visitorUser(row) {
  return liveChatUserRefForAvatar(row?.visitor);
}

function visitorSubtitle(row) {
  const email = String(row?.visitor?.email || '').trim();
  if (email) return email;
  return sessionKeyLabel(row);
}

function sessionKeyLabel(row) {
  return liveChatSessionKeyLabel(row);
}

function channelLabel(row) {
  return liveChatChannelLabel(row?.channel, t);
}

function lifecycleLabel(row) {
  return liveChatLifecycleLabel(row?.lifecycleStatus, t);
}

function outcomeLabel(row) {
  return liveChatOutcomeLabel(row?.outcome, t);
}

function outcomeBadgeVariant(row) {
  return liveChatOutcomeBadgeVariant(row?.outcome);
}

function priorityLabel(row) {
  return liveChatSessionPriorityLabel(row?.priority, t);
}

function sentimentLabel(row) {
  return liveChatSentimentLabel(row?.sentiment, t);
}

function visitorTypeLabel(row) {
  return liveChatVisitorTypeLabel(row?.visitorType, t);
}

function hasAgent(agent) {
  return Boolean(agent?._id || String(agent?.displayName || '').trim());
}

function agentUser(agent) {
  return liveChatUserRefForAvatar(agent);
}

function agentDisplayName(agent) {
  return liveChatAgentLabel(agent, t);
}

function queueLabel(row) {
  return liveChatQueueLabel(row, t);
}

function summaryLabel(row) {
  return liveChatSessionSummaryLabel(row);
}

function tagsLabel(row) {
  return liveChatSessionTagsLabel(row);
}

function csatLabel(row) {
  return liveChatCsatLabel(row);
}

const textLabel = computed(() => {
  const row = props.row;
  switch (props.columnKey) {
    case 'queue':
      return queueLabel(row);
    case 'duration':
      return liveChatSessionDuration(row) || '—';
    case 'messageCount':
      return String(row?.messageCount ?? 0);
    case 'visitorMessageCount':
      return String(row?.visitorMessageCount ?? 0);
    case 'agentMessageCount':
      return String(row?.agentMessageCount ?? 0);
    case 'transferCount':
      return String(row?.transferCount ?? 0);
    case 'waitTime':
      return liveChatSessionWaitTime(row) || '—';
    case 'firstResponseTime':
      return liveChatSessionFirstResponseTime(row) || '—';
    case 'handleTime':
      return liveChatSessionHandleTime(row) || '—';
    case 'intent':
      return liveChatIntentLabel(row?.intent, t) || '—';
    case 'botInvolved':
      return liveChatYesNoLabel(Boolean(row?.botInvolved), t);
    case 'consentGiven':
      return liveChatYesNoLabel(Boolean(row?.consentGiven), t);
    case 'sessionArchived':
      return liveChatYesNoLabel(Boolean(row?.sessionArchived), t);
    case 'exported':
      return liveChatYesNoLabel(Boolean(row?.exported), t);
    default:
      return '—';
  }
});
</script>

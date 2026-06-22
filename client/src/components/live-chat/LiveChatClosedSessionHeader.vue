<template>
  <header class="shrink-0 border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
    <div class="flex items-center gap-2.5">
      <button
        type="button"
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        :title="t('liveChat.closedSessionBack')"
        :aria-label="t('liveChat.closedSessionBack')"
        @click="emit('back')"
      >
        <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
      </button>

      <div class="relative shrink-0">
        <AvatarInitials
          :first-name="visitorFirstName"
          :last-name="visitorLastName"
          :email="visitorEmail"
          size="sm"
        />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {{ titleLabel }}
          </p>
          <span class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {{ t('liveChat.filterClosed') }}
          </span>
        </div>
        <p class="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
          {{ metaLine }}
        </p>
      </div>

      <BadgeCell
        v-if="outcomeLabel"
        :value="outcomeLabel"
        :variant="outcomeBadgeVariant"
        class="shrink-0"
      />
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeftIcon } from '@heroicons/vue/24/outline';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import {
  liveChatChannelLabel,
  liveChatOutcomeBadgeVariant,
  liveChatOutcomeLabel,
  liveChatQueueLabel,
  liveChatSessionDuration,
  liveChatSessionKeyLabel,
  liveChatSessionSummaryLabel,
  liveChatVisitorLabel,
} from '@/utils/liveChatSessionDisplay';

const props = defineProps({
  session: { type: Object, default: null },
});

const emit = defineEmits(['back']);

const { t } = useI18n();

const sessionKeyLabel = computed(() => liveChatSessionKeyLabel(props.session));

const summaryLabel = computed(() => liveChatSessionSummaryLabel(props.session));

const visitorLabel = computed(() => liveChatVisitorLabel(props.session, t));

const titleLabel = computed(() => summaryLabel.value || visitorLabel.value);

const visitor = computed(() => props.session?.visitor || {});

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

const visitorEmail = computed(() => String(visitor.value?.email || '').trim());

const channelLabel = computed(() => liveChatChannelLabel(props.session?.channel, t));

const queueLabel = computed(() => {
  const label = liveChatQueueLabel(props.session, t);
  return label && label !== '—' ? label : '';
});

const durationLabel = computed(() => liveChatSessionDuration(props.session) || '');

const outcomeLabel = computed(() => liveChatOutcomeLabel(props.session?.outcome, t));

const outcomeBadgeVariant = computed(() => liveChatOutcomeBadgeVariant(props.session));

const metaLine = computed(() => {
  const parts = [sessionKeyLabel.value];
  if (queueLabel.value) parts.push(queueLabel.value);
  else if (channelLabel.value) parts.push(channelLabel.value);
  if (durationLabel.value) parts.push(durationLabel.value);
  return parts.filter(Boolean).join(' · ');
});
</script>

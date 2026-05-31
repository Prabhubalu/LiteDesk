<template>
  <div ref="feedRef" class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
    <div v-if="!activities.length" class="flex flex-col items-center justify-center py-16 text-center">
      <ChatBubbleLeftRightIcon class="h-12 w-12 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ emptyTitle }}</p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ emptyMessage }}</p>
    </div>

    <template v-for="(activity, index) in activities" :key="activity._id || activity.id || `act-${index}`">
      <!-- System event -->
      <div v-if="isSystem(activity)" class="flex justify-center py-0.5">
        <p
          class="max-w-full truncate px-2 text-center text-[11px] leading-tight"
          :class="isResponseSlaMet(activity)
            ? 'font-medium text-emerald-600 dark:text-emerald-400'
            : 'text-gray-500 dark:text-gray-500'"
        >
          {{ formatSystemEventLine(activity) }}
        </p>
      </div>

      <div v-else-if="isInternalComment(activity)" class="py-1">
        <CaseInternalCommentTimelineCard :activity="activity" :created-at="activity.createdAt" />
      </div>

      <!-- Message bubble -->
      <div
        v-else
        class="flex gap-3"
        :class="isInbound(activity) ? '' : 'flex-row-reverse'"
      >
        <Avatar
          :user="avatarUser(activity)"
          size="sm"
          class="mt-1 shrink-0"
        />
        <div
          class="min-w-0 max-w-[min(100%,42rem)]"
          :class="isInbound(activity) ? '' : 'items-end flex flex-col'"
        >
          <div
            class="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
            :class="isInbound(activity) ? '' : 'justify-end'"
          >
            <span class="font-semibold text-gray-800 dark:text-gray-200">
              {{ displayName(activity) }}
            </span>
            <span>{{ formatTime(activity.createdAt) }}</span>
            <span
              v-if="activity.channel || caseRecord?.channel"
              class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800"
            >
              <component :is="channelIcon(activity.channel || caseRecord?.channel)" class="h-3 w-3" />
              {{ t('cases.recordViaChannel', { channel: formatChannel(activity.channel || caseRecord?.channel) }) }}
            </span>
            <span
              v-if="activity.internal"
              class="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            >
              {{ t('cases.recordInternalComment') }}
            </span>
          </div>
          <div
            class="mt-1.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm"
            :class="
              isInbound(activity)
                ? 'border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
                : 'border-indigo-200 bg-indigo-50 text-gray-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-50'
            "
          >
            <p class="whitespace-pre-wrap break-words">{{ activity.message || '—' }}</p>
            <CaseMailroomAttachments
              v-if="mailroomAttachments(activity).length"
              :attachments="mailroomAttachments(activity)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  BuildingOfficeIcon
} from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import CaseMailroomAttachments from '@/components/cases/CaseMailroomAttachments.vue';
import CaseInternalCommentTimelineCard from '@/components/cases/CaseInternalCommentTimelineCard.vue';
import { formatRelativeTime } from '@/utils/relativeTime';
import {
  isCaseSystemActivity,
  isCaseInternalComment,
  isCaseInboundMessage,
  getCaseActivityDisplayName,
  getCaseActivityAvatarUser,
  formatCaseChannelLabel,
  formatCaseSystemActivityLine,
  isCaseResponseSlaMetActivity
} from '@/utils/caseTimeline';

const props = defineProps({
  activities: { type: Array, default: () => [] },
  caseRecord: { type: Object, default: null },
  emptyTitle: { type: String, default: '' },
  emptyMessage: { type: String, default: '' }
});

const { t } = useI18n();
const feedRef = ref(null);

function isSystem(activity) {
  return isCaseSystemActivity(activity);
}
function isInbound(activity) {
  return isCaseInboundMessage(activity);
}
function isInternalComment(activity) {
  return isCaseInternalComment(activity);
}
function displayName(activity) {
  return getCaseActivityDisplayName(activity, props.caseRecord);
}
function avatarUser(activity) {
  return getCaseActivityAvatarUser(activity, props.caseRecord);
}
function formatTime(date) {
  return formatRelativeTime(date, t) || '';
}
function formatChannel(ch) {
  return formatCaseChannelLabel(ch);
}

function mailroomAttachments(activity) {
  const list = activity?.metadata?.mailroomAttachments;
  return Array.isArray(list) ? list : [];
}

function channelIcon(channel) {
  const c = String(channel || '').toLowerCase();
  if (c.includes('email')) return EnvelopeIcon;
  if (c.includes('phone')) return PhoneIcon;
  if (c.includes('portal')) return GlobeAltIcon;
  if (c.includes('partner')) return BuildingOfficeIcon;
  return ChatBubbleLeftRightIcon;
}

function formatSystemEventLine(activity) {
  return formatCaseSystemActivityLine(activity, {
    t,
    formatTime: (date) => formatRelativeTime(date, t) || ''
  });
}

function isResponseSlaMet(activity) {
  return isCaseResponseSlaMetActivity(activity);
}

watch(
  () => props.activities.length,
  async () => {
    await nextTick();
    const el = feedRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  }
);
</script>

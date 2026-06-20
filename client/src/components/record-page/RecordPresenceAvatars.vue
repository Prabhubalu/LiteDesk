<template>
  <div
    v-if="visibleSessions.length"
    class="inline-flex items-center"
    role="group"
    :aria-label="t('records.presenceAvatarsLabel')"
  >
    <div class="flex items-center pl-1">
      <div
        v-for="(session, index) in displayedSessions"
        :key="sessionKey(session)"
        class="relative transition-transform hover:z-10 hover:scale-105"
        :class="index > 0 ? '-ml-2.5' : ''"
        :title="sessionTooltip(session)"
      >
        <div
          class="rounded-full p-0.5 ring-2 ring-white dark:ring-gray-900"
          :class="activityRingClass(session.activityType)"
        >
          <Avatar
            :user="sessionUser(session)"
            size="sm"
            class="record-presence-avatar"
          />
        </div>
        <span
          v-if="session.activityType === 'editing'"
          class="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-900"
          aria-hidden="true"
        />
      </div>
      <div
        v-if="overflowCount > 0"
        class="-ml-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 ring-2 ring-white dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-900"
        :title="overflowTooltip"
      >
        +{{ overflowCount }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Avatar from '@/components/common/Avatar.vue';
import { formatRelativeMinutes, formatUserName } from '@/utils/recordPresence';

const MAX_VISIBLE = 4;

const props = defineProps({
  sessions: { type: Array, default: () => [] }
});

const { t } = useI18n();

const visibleSessions = computed(() =>
  (props.sessions || []).filter((session) => session?.userId)
);

const displayedSessions = computed(() => visibleSessions.value.slice(0, MAX_VISIBLE));

const overflowCount = computed(() =>
  Math.max(visibleSessions.value.length - MAX_VISIBLE, 0)
);

const overflowTooltip = computed(() => {
  if (!overflowCount.value) return '';
  const names = visibleSessions.value
    .slice(MAX_VISIBLE)
    .map((session) => sessionName(session))
    .join(', ');
  return t('records.presenceAvatarsOverflow', { count: overflowCount.value, names });
});

function sessionUser(session) {
  const user = session?.userId;
  return typeof user === 'object' ? user : null;
}

function sessionUserId(session) {
  const user = session?.userId;
  if (!user) return '';
  if (typeof user === 'object') return String(user._id || '');
  return String(user);
}

function sessionKey(session) {
  return `${sessionUserId(session)}:${session.activityType || 'viewing'}`;
}

function sessionName(session) {
  const user = session?.userId;
  if (typeof user === 'object') {
    return formatUserName(user) || t('records.presenceUnknownUser');
  }
  return t('records.presenceUnknownUser');
}

function presenceActivityLabel(activityType) {
  if (activityType === 'editing') return t('records.presenceActivityEditing');
  if (activityType === 'idle') return t('records.presenceActivityIdle');
  return t('records.presenceActivityViewing');
}

function sessionTooltip(session) {
  const name = sessionName(session);
  const activity = presenceActivityLabel(session.activityType);
  const joinedAt = session.createdAt || session.lastSeenAt;
  const ago = formatRelativeMinutes(joinedAt);
  if (ago) {
    return t('records.presenceAvatarTooltipWithTime', { name, activity, time: ago });
  }
  return t('records.presenceAvatarTooltip', { name, activity });
}

function activityRingClass(activityType) {
  if (activityType === 'editing') {
    return 'bg-green-100 dark:bg-green-900/50';
  }
  if (activityType === 'idle') {
    return 'bg-amber-100 dark:bg-amber-900/50';
  }
  return 'bg-gray-100 dark:bg-gray-800';
}
</script>

<style scoped>
.record-presence-avatar :deep(> div),
.record-presence-avatar :deep(img) {
  border-radius: 9999px;
}
</style>

<template>
  <section :class="['flex flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]">
    <div :class="['flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
      <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
        {{ t('platform.platformHomeInboxTitle') }}
      </h3>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          v-if="notificationsUnread > 0"
          type="button"
          class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          @click="$emit('open-notifications')"
        >
          {{ notificationsLabel }}
          <ArrowRightIcon class="h-3 w-3" />
        </button>
        <button
          v-if="unreadMail > 0"
          type="button"
          class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          @click="$emit('open-inbox')"
        >
          {{ mailLabel }}
          <ArrowRightIcon class="h-3 w-3" />
        </button>
      </div>
    </div>

    <div v-if="!hasItems" class="flex items-center justify-center px-5 py-8 text-center">
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('platform.platformHomeInboxEmpty') }}
      </p>
    </div>

    <div
      v-else
      :class="[
        'flex flex-col divide-y divide-neutral-100 dark:divide-white/[0.06]',
        PLATFORM_HOME_LIST_SCROLL_CLASS
      ]"
    >
      <div v-if="notificationPreview.length" class="px-1.5 py-0.5">
        <p class="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {{ t('platform.platformHomeInboxNotifications') }}
        </p>
        <PlatformHomeInboxRow
          v-for="item in notificationPreview"
          :key="`notification-${item.id}`"
          :item="item"
          @select="$emit('select-notification', item)"
        />
      </div>

      <div v-if="mailPreview.length" class="px-1.5 py-0.5">
        <p class="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {{ t('platform.platformHomeInboxEmail') }}
        </p>
        <PlatformHomeInboxRow
          v-for="item in mailPreview"
          :key="`mail-${item.id}`"
          :item="item"
          @select="$emit('select-mail', item)"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowRightIcon } from '@heroicons/vue/24/outline';
import PlatformHomeInboxRow from '@/components/platform/PlatformHomeInboxRow.vue';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
  PLATFORM_HOME_LIST_SCROLL_CLASS
} from '@/utils/platformHomeLayout';

const props = defineProps({
  notificationPreview: {
    type: Array,
    default: () => []
  },
  mailPreview: {
    type: Array,
    default: () => []
  },
  notificationsUnread: {
    type: Number,
    default: 0
  },
  unreadMail: {
    type: Number,
    default: 0
  }
});

defineEmits(['open-notifications', 'open-inbox', 'select-notification', 'select-mail']);

const { t } = useI18n();

const hasItems = computed(() =>
  props.notificationPreview.length > 0 || props.mailPreview.length > 0
);

const notificationsLabel = computed(() =>
  t(
    props.notificationsUnread === 1
      ? 'platform.platformHomeNotificationCountOne'
      : 'platform.platformHomeNotificationCountMany',
    { count: props.notificationsUnread }
  )
);

const mailLabel = computed(() =>
  t(
    props.unreadMail === 1
      ? 'platform.platformHomeUnreadCountOne'
      : 'platform.platformHomeUnreadCountMany',
    { count: props.unreadMail }
  )
);
</script>

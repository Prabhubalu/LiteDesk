<template>
  <button
    type="button"
    class="relative inline-flex items-center justify-center rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-150 min-h-[44px] min-w-[44px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
    :aria-label="ariaLabel"
    :title="tooltipText"
    @click.stop.prevent="handleClick"
  >
    <svg
      class="w-6 h-6 text-neutral-600 dark:text-neutral-300 transition-transform duration-200"
      :class="{ 'notification-bell--ring': justReceived }"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>

    <!-- Dot badge (mobile / fallback) — nudged onto the bell -->
    <span
      v-if="hasUnread"
      class="absolute top-0.5 right-0.5 block w-2 h-2 rounded-full bg-danger-500 ring-2 ring-white dark:ring-gray-900 notification-bell-badge md:hidden z-10"
      aria-hidden="true"
    ></span>

    <!-- Numeric badge (desktop) — overlaps upper-right of the bell -->
    <span
      v-if="hasUnread && showCountOnDesktop"
      class="hidden md:flex items-center justify-center absolute top-0 right-0 min-w-[18px] h-[18px] rounded-full bg-danger-500 text-[10px] font-semibold text-white px-1 notification-bell-badge ring-2 ring-white dark:ring-gray-900 z-10 translate-x-px -translate-y-px"
      aria-hidden="true"
    >
      {{ displayCount }}
    </span>
  </button>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { useNotificationStore } from '@/stores/notifications';
import { connectNotificationStream } from '@/composables/useNotificationStream';
import { useAuthStore } from '@/stores/authRegistry';
import { useOffline } from '@/composables/useOffline';
import { resolveNotificationAppKeyFromPath } from '@/utils/notificationAppKey';

const props = defineProps({
  showCountOnDesktop: {
    type: Boolean,
    default: true
  },
  /** When false, only reads the store (another instance should own the SSE connection). */
  connectStream: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['toggle']);

const store = useNotificationStore();
const authStore = useAuthStore();
const { isOnline } = useOffline();

// Ring animation when new notification arrives via SSE
const justReceived = ref(false);
let justReceivedTimer = null;

const currentAppKey = () => resolveNotificationAppKeyFromPath();

const hasUnread = computed(() => store.hasUnread);
const displayCount = computed(() => {
  if (store.unreadCount > 9) return '9+';
  return store.unreadCount;
});

const ariaLabel = computed(() =>
  hasUnread.value ? t('notifications.bellAriaUnread') : t('notifications.bellAria')
);

const tooltipText = computed(() => {
  if (!hasUnread.value) return t('notifications.bellAria');
  const count = store.unreadCount;
  const key = count === 1
    ? 'notifications.bellTooltipUnreadOne'
    : 'notifications.bellTooltipUnreadMany';
  return t(key, { count });
});

let streamDisconnect = null;

function connectStreamForCurrentRoute() {
  if (streamDisconnect) {
    streamDisconnect();
    streamDisconnect = null;
  }
  if (!props.connectStream || !isOnline.value) return;
  const appKey = currentAppKey();
  streamDisconnect = connectNotificationStream(
    appKey,
    (notification) => {
      store.handleIncomingNotification(notification);
      justReceived.value = true;
      if (justReceivedTimer) clearTimeout(justReceivedTimer);
      justReceivedTimer = setTimeout(() => {
        justReceived.value = false;
        justReceivedTimer = null;
      }, 800);
    },
    { isOnline: isOnline.value, authStore }
  );
}

onMounted(() => {
  store.primeUnreadPreviewFromCache();
  store.fetchUnreadPreview();
  connectStreamForCurrentRoute();
});

watch(
  () => (typeof window !== 'undefined' ? window.location.pathname : ''),
  () => {
    store.fetchUnreadPreview();
    connectStreamForCurrentRoute();
  }
);

onBeforeUnmount(() => {
  if (streamDisconnect) streamDisconnect();
  if (justReceivedTimer) clearTimeout(justReceivedTimer);
});

function handleClick(e) {
  e.preventDefault();
  e.stopPropagation();
  emit('toggle');
}
</script>

<style scoped>
.notification-bell-badge {
  animation: notification-bell-pulse 2s ease-in-out infinite;
}

.notification-bell--ring {
  animation: notification-bell-ring 0.5s ease-in-out;
}

@keyframes notification-bell-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.05);
  }
}

@keyframes notification-bell-ring {
  0%, 100% {
    transform: rotate(0);
  }
  10%, 30% {
    transform: rotate(-15deg);
  }
  20%, 40% {
    transform: rotate(15deg);
  }
  50% {
    transform: rotate(0);
  }
}
</style>


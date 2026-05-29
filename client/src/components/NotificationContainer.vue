<template>
  <Teleport to="body">
    <div
      v-show="notifications.length > 0"
      class="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
      style="max-width: 400px;"
    >
    <TransitionGroup
      name="notification"
      tag="div"
      class="flex flex-col gap-3"
    >
      <component
        :is="isToastClickable(notification) ? 'button' : 'div'"
        v-for="notification in notifications"
        :key="notification.id"
        type="button"
        class="pointer-events-auto rounded-lg shadow-lg border p-4 flex items-start gap-3 animate-slide-in text-left w-full"
        :class="[
          getNotificationClasses(notification.type),
          isToastClickable(notification)
            ? 'cursor-pointer hover:shadow-xl transition-shadow focus:outline-none focus:ring-2 focus:ring-primary-500/30'
            : ''
        ]"
        :aria-label="isToastClickable(notification) ? t('notifications.toastOpenRecordAria') : undefined"
        @click="isToastClickable(notification) ? handleToastClick(notification) : undefined"
      >
        <!-- Icon -->
        <div class="flex-shrink-0 mt-0.5">
          <component :is="getIcon(notification.type)" class="w-5 h-5" :class="getIconClasses(notification.type)" />
        </div>

        <!-- Message -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium" :class="getTextClasses(notification.type)">
            {{ notification.message }}
          </p>
        </div>

        <!-- Close Button -->
        <button
          type="button"
          @click.stop="remove(notification.id)"
          class="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </component>
    </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { onMounted } from 'vue';
import { useNotifications, setGlobalNotificationFn } from '@/composables/useNotifications';
import { useNotificationStore } from '@/stores/notifications';
import { useTabs } from '@/composables/useTabs';
import {
  buildNotificationOpenTabOptions,
  canNavigateFromNotification,
  getNotificationPath
} from '@/utils/navigateFromNotification';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/vue/24/solid';

const { notifications, remove, show } = useNotifications();
const notificationStore = useNotificationStore();
const { openTab } = useTabs();

function isToastClickable(notification) {
  if (!notification) return false;
  if (typeof notification.onClick === 'function') return true;
  return canNavigateFromNotification(notification.appKey, notification.entity);
}

async function handleToastClick(notification) {
  if (typeof notification.onClick === 'function') {
    notification.onClick();
    remove(notification.id);
    return;
  }

  const path = getNotificationPath(notification.appKey, notification.entity);
  if (!path) return;

  if (notification.notificationId) {
    await notificationStore.markRead(notification.notificationId);
  }

  openTab(path, buildNotificationOpenTabOptions(notification.entity));
  remove(notification.id);
}

onMounted(() => {
  setGlobalNotificationFn((message, options = {}) => {
    show(message, options);
  });
});

const getNotificationClasses = (type) => {
  const baseClasses = 'bg-white dark:bg-gray-800';
  const typeClasses = {
    success: 'border-green-200 dark:border-green-800',
    error: 'border-red-200 dark:border-red-800',
    warning: 'border-yellow-200 dark:border-yellow-800',
    info: 'border-blue-200 dark:border-blue-800'
  };
  return `${baseClasses} ${typeClasses[type] || typeClasses.info}`;
};

const getTextClasses = (type) => {
  const typeClasses = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    warning: 'text-yellow-800 dark:text-yellow-200',
    info: 'text-blue-800 dark:text-blue-200'
  };
  return typeClasses[type] || typeClasses.info;
};

const getIcon = (type) => {
  const icons = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon
  };
  return icons[type] || InformationCircleIcon;
};

const getIconClasses = (type) => {
  const typeClasses = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400'
  };
  return typeClasses[type] || typeClasses.info;
};
</script>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease;
}
</style>


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
        <ToastNotificationCard
          v-for="notification in notifications"
          :key="notification.id"
          :toast="notification"
          :clickable="isToastClickable(notification)"
          @activate="handleToastClick(notification)"
          @dismiss="remove(notification.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted } from 'vue';
import ToastNotificationCard from '@/components/notifications/ToastNotificationCard.vue';
import { useNotifications, setGlobalNotificationFn } from '@/composables/useNotifications';
import {
  buildNotificationOpenTabOptions,
  canNavigateFromNotification,
  getNotificationPath
} from '@/utils/navigateFromNotification';

const { notifications, remove, show } = useNotifications();

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
    const { useNotificationStore } = await import('@/stores/notifications');
    const notificationStore = useNotificationStore();
    await notificationStore.markRead(notification.notificationId);
  }

  const { useTabs } = await import('@/composables/useTabs');
  const { openTab } = useTabs();
  openTab(path, buildNotificationOpenTabOptions(notification.entity));
  remove(notification.id);
}

onMounted(() => {
  setGlobalNotificationFn((presentation) => {
    show(presentation);
  });
});
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
</style>

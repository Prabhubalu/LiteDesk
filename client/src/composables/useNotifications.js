import { ref } from 'vue';

const notifications = ref([]);

// Global function to show notification that persists across component unmounts
// This ensures notifications work even when called from components that are about to unmount
let globalShowFn = null;

export function setGlobalNotificationFn(fn) {
  globalShowFn = fn;
}

/**
 * @param {string} message
 * @param {{ type?: 'success'|'error'|'warning'|'info', duration?: number, appKey?: string, entity?: object, notificationId?: string, onClick?: () => void }|number} [options]
 *   Pass a number for backward-compatible duration-only calls.
 */
export function showGlobalNotification(message, options = {}) {
  const normalized =
    typeof options === 'number'
      ? { type: 'info', duration: options }
      : { type: 'info', duration: 5000, ...options };

  if (globalShowFn) {
    globalShowFn(message, normalized);
    return;
  }

  const id = Date.now() + Math.random();
  const notification = {
    id,
    message,
    type: normalized.type || 'info',
    duration: normalized.duration ?? 5000,
    appKey: normalized.appKey,
    entity: normalized.entity,
    notificationId: normalized.notificationId,
    onClick: normalized.onClick
  };
  notifications.value.push(notification);

  const duration = notification.duration;
  if (duration > 0) {
    setTimeout(() => {
      const index = notifications.value.findIndex((n) => n.id === id);
      if (index > -1) {
        notifications.value.splice(index, 1);
      }
    }, duration);
  }
}

export function useNotifications() {
  const remove = (id) => {
    const index = notifications.value.findIndex(n => n.id === id);
    if (index > -1) {
      notifications.value.splice(index, 1);
    }
  };

  /**
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'|{ type?: string, duration?: number, appKey?: string, entity?: object, notificationId?: string, onClick?: () => void }} [typeOrOptions]
   * @param {number} [duration]
   */
  const show = (message, typeOrOptions = 'info', duration = 3000) => {
    const opts =
      typeof typeOrOptions === 'object' && typeOrOptions !== null
        ? { type: 'info', duration: 3000, ...typeOrOptions }
        : { type: typeOrOptions, duration };

    const id = Date.now() + Math.random();
    const notification = {
      id,
      message,
      type: opts.type || 'info',
      duration: opts.duration ?? 3000,
      appKey: opts.appKey,
      entity: opts.entity,
      notificationId: opts.notificationId,
      onClick: opts.onClick
    };

    notifications.value.push(notification);

    if (notification.duration > 0) {
      setTimeout(() => {
        remove(id);
      }, notification.duration);
    }

    return id;
  };

  const success = (message, duration = 3000) => {
    console.log('📢 useNotifications.success called with:', message);
    const result = show(message, 'success', duration);
    console.log('📢 useNotifications.success returned:', result);
    return result;
  };

  const error = (message, duration = 4000) => {
    return show(message, 'error', duration);
  };

  const warning = (message, duration = 3500) => {
    return show(message, 'warning', duration);
  };

  const info = (message, duration = 3000) => {
    return show(message, 'info', duration);
  };

  return {
    notifications,
    show,
    remove,
    success,
    error,
    warning,
    info
  };
}


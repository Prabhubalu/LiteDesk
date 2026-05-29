import { ref } from 'vue';
import { buildToastPresentation } from '@/utils/toastPresentation';
import { i18n } from '@/i18n';

const notifications = ref([]);

const t = i18n.global.t.bind(i18n.global);

let globalShowFn = null;

export function setGlobalNotificationFn(fn) {
  globalShowFn = fn;
}

function scheduleRemoval(id, duration) {
  if (duration <= 0) return;
  setTimeout(() => {
    removeToast(id);
  }, duration);
}

export function removeToast(id) {
  const index = notifications.value.findIndex((n) => n.id === id);
  if (index > -1) {
    notifications.value.splice(index, 1);
  }
}

/**
 * @param {import('@/utils/toastPresentation').ToastPresentation} presentation
 */
export function pushToast(presentation) {
  const toast = {
    ...presentation,
    id: presentation.id || `${Date.now()}-${Math.random()}`
  };
  notifications.value.push(toast);
  scheduleRemoval(toast.id, toast.duration ?? 5000);
  return toast.id;
}

function resolvePresentation(messageOrPresentation, typeOrOptions, duration) {
  if (
    messageOrPresentation &&
    typeof messageOrPresentation === 'object' &&
    messageOrPresentation.primary != null &&
    messageOrPresentation.variant
  ) {
    return messageOrPresentation;
  }

  const opts =
    typeof typeOrOptions === 'object' && typeOrOptions !== null
      ? { type: 'info', duration: 3000, ...typeOrOptions }
      : { type: typeOrOptions, duration };

  if (
    typeof duration === 'number' &&
    (typeof typeOrOptions !== 'object' || typeOrOptions === null || !('duration' in typeOrOptions))
  ) {
    opts.duration = duration;
  }

  return buildToastPresentation(messageOrPresentation, opts, t);
}

/**
 * @param {string} message
 * @param {{ type?: string, duration?: number, appKey?: string, entity?: object, notificationId?: string, onClick?: () => void, eventType?: string, title?: string, body?: string, category?: string, secondary?: string, meta?: string }|number} [options]
 */
export function showGlobalNotification(message, options = {}) {
  const normalized =
    typeof options === 'number'
      ? { type: 'info', duration: options }
      : { type: 'info', duration: 5000, ...options };

  const presentation = resolvePresentation(message, normalized);

  if (globalShowFn) {
    globalShowFn(presentation);
    return presentation.id;
  }

  return pushToast(presentation);
}

export function useNotifications() {
  const remove = removeToast;

  /**
   * @param {string|import('@/utils/toastPresentation').ToastPresentation} messageOrPresentation
   * @param {'success'|'error'|'warning'|'info'|object} [typeOrOptions]
   * @param {number} [duration]
   */
  const show = (messageOrPresentation, typeOrOptions = 'info', duration = 3000) => {
    const presentation = resolvePresentation(messageOrPresentation, typeOrOptions, duration);
    return pushToast(presentation);
  };

  const success = (message, durationOrOptions = 3000) => {
    if (typeof durationOrOptions === 'object') {
      return show(message, { type: 'success', ...durationOrOptions });
    }
    return show(message, 'success', durationOrOptions);
  };

  const error = (message, durationOrOptions = 4000) => {
    if (typeof durationOrOptions === 'object') {
      return show(message, { type: 'error', ...durationOrOptions });
    }
    return show(message, 'error', durationOrOptions);
  };

  const warning = (message, durationOrOptions = 3500) => {
    if (typeof durationOrOptions === 'object') {
      return show(message, { type: 'warning', ...durationOrOptions });
    }
    return show(message, 'warning', durationOrOptions);
  };

  const info = (message, durationOrOptions = 3000) => {
    if (typeof durationOrOptions === 'object') {
      return show(message, { type: 'info', ...durationOrOptions });
    }
    return show(message, 'info', durationOrOptions);
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

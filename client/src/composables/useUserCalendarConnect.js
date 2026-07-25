import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { useI18n } from 'vue-i18n';
import { useNotifications } from '@/composables/useNotifications';

const calendarConnectLoading = ref(false);
let oauthPopupRef = null;
let oauthPollTimer = null;
let oauthMessageHandler = null;

function cleanupCalendarOAuthPopup() {
  if (oauthPollTimer) {
    clearInterval(oauthPollTimer);
    oauthPollTimer = null;
  }
  if (oauthMessageHandler) {
    window.removeEventListener('message', oauthMessageHandler);
    oauthMessageHandler = null;
  }
  oauthPopupRef = null;
}

/**
 * User-level calendar connector OAuth (popup + postMessage).
 */
export function useUserCalendarConnect() {
  const notifications = useNotifications();
  const { t } = useI18n();

  async function fetchConnections() {
    const res = await apiClient.get('/user/calendar-connections');
    if (!res?.success) {
      throw new Error(res?.message || t('events.calendarSyncLoadFailed'));
    }
    return res.data?.connectors || [];
  }

  async function startOAuth(provider, callbacks = {}) {
    const p = String(provider || '').toLowerCase();
    if (p !== 'google' && p !== 'microsoft') return;

    calendarConnectLoading.value = true;
    try {
      const res = await apiClient.get(`/user/calendar-connections/${p}/oauth/start`);
      if (!res?.success || !res?.data?.url) {
        notifications.error(res?.message || t('events.calendarSyncConnectFailed'));
        calendarConnectLoading.value = false;
        return;
      }

      const w = 520;
      const h = 720;
      const screenLeft = typeof window.screen.availLeft === 'number' ? window.screen.availLeft : 0;
      const screenTop = typeof window.screen.availTop === 'number' ? window.screen.availTop : 0;
      const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2 + screenLeft));
      const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2 + screenTop));
      const features = `popup=yes,width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`;
      const popup = window.open(res.data.url, 'user-calendar-oauth', features);

      if (!popup) {
        window.location.href = res.data.url;
        return;
      }

      cleanupCalendarOAuthPopup();
      oauthPopupRef = popup;
      try {
        popup.focus();
      } catch {
        /* ignore */
      }

      oauthMessageHandler = (event) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || data.type !== 'user-calendar-oauth-result') return;
        if (data.status === 'connected') {
          notifications.success(
            t('events.calendarSyncConnectedToast', {
              provider: data.provider === 'microsoft' ? 'Microsoft 365' : 'Google'
            })
          );
          callbacks.onConnected?.(data);
        } else if (data.status === 'error') {
          const msg = String(data.message || t('events.calendarSyncConnectFailed'));
          notifications.error(msg);
          callbacks.onError?.(msg);
        }
        try {
          popup.close();
        } catch {
          /* ignore */
        }
        cleanupCalendarOAuthPopup();
        calendarConnectLoading.value = false;
      };
      window.addEventListener('message', oauthMessageHandler);

      oauthPollTimer = setInterval(() => {
        if (popup.closed) {
          cleanupCalendarOAuthPopup();
          calendarConnectLoading.value = false;
          callbacks.onPopupClosed?.();
        }
      }, 500);
    } catch (err) {
      notifications.error(
        err?.response?.data?.message || err?.message || t('events.calendarSyncConnectFailed')
      );
      calendarConnectLoading.value = false;
    }
  }

  async function disconnect(provider) {
    const p = String(provider || '').toLowerCase();
    if (p !== 'google' && p !== 'microsoft') return false;
    calendarConnectLoading.value = true;
    try {
      const res = await apiClient.delete(`/user/calendar-connections/${p}`);
      if (!res?.success) {
        notifications.error(res?.message || t('events.calendarSyncDisconnectFailed'));
        return false;
      }
      notifications.success(t('events.calendarSyncDisconnectedToast'));
      return true;
    } catch (err) {
      notifications.error(
        err?.response?.data?.message || err?.message || t('events.calendarSyncDisconnectFailed')
      );
      return false;
    } finally {
      calendarConnectLoading.value = false;
    }
  }

  return {
    calendarConnectLoading,
    fetchConnections,
    startOAuth,
    disconnect,
    cleanupCalendarOAuthPopup
  };
}

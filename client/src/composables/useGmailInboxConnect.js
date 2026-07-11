import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const gmailSyncLoading = ref(false);
let gmailOAuthPopupRef = null;
let gmailOAuthPollTimer = null;
let gmailOAuthMessageHandler = null;

function cleanupGmailOAuthPopup() {
  if (gmailOAuthPollTimer) {
    clearInterval(gmailOAuthPollTimer);
    gmailOAuthPollTimer = null;
  }
  if (gmailOAuthMessageHandler) {
    window.removeEventListener('message', gmailOAuthMessageHandler);
    gmailOAuthMessageHandler = null;
  }
  gmailOAuthPopupRef = null;
}

/**
 * Start Gmail OAuth for a personal mailbox (popup + postMessage callback).
 */
export function useGmailInboxConnect() {
  const notifications = useNotifications();

  async function startGmailOAuth(mailboxId, loginHint = '', callbacks = {}) {
    const mbId = String(mailboxId || '').trim();
    if (!mbId) return;

    gmailSyncLoading.value = true;
    try {
      const hint = String(loginHint || '').trim();
      const options = hint ? { params: { login_hint: hint } } : {};
      const res = await apiClient.get(`/mailboxes/${mbId}/inbox-sync/google/start`, options);
      if (!res?.success || !res?.data?.url) {
        notifications.error(res?.message || 'Could not start Gmail connection');
        gmailSyncLoading.value = false;
        return;
      }

      const w = 520;
      const h = 720;
      const screenLeft = typeof window.screen.availLeft === 'number' ? window.screen.availLeft : 0;
      const screenTop = typeof window.screen.availTop === 'number' ? window.screen.availTop : 0;
      const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2 + screenLeft));
      const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2 + screenTop));
      const features = `popup=yes,width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`;
      const popup = window.open(res.data.url, 'gmail-oauth', features);

      if (!popup) {
        window.location.href = res.data.url;
        return;
      }

      cleanupGmailOAuthPopup();
      gmailOAuthPopupRef = popup;
      try {
        popup.focus();
      } catch {
        /* ignore */
      }

      gmailOAuthMessageHandler = (event) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || data.type !== 'gmail-oauth-result') return;
        if (data.status === 'connected') {
          notifications.success('Gmail connected. You can send and receive mail in Arivu.');
          callbacks.onConnected?.();
        } else if (data.status === 'error') {
          const msg = String(data.message || 'Connection failed');
          notifications.error(msg);
          callbacks.onError?.(msg);
        }
        try {
          popup.close();
        } catch {
          /* ignore */
        }
        cleanupGmailOAuthPopup();
        gmailSyncLoading.value = false;
      };
      window.addEventListener('message', gmailOAuthMessageHandler);

      gmailOAuthPollTimer = setInterval(() => {
        if (popup.closed) {
          cleanupGmailOAuthPopup();
          gmailSyncLoading.value = false;
        }
      }, 500);
    } catch (err) {
      notifications.error(err?.response?.data?.message || err?.message || 'Could not start Gmail connection');
      gmailSyncLoading.value = false;
    }
  }

  return {
    gmailSyncLoading,
    startGmailOAuth,
    cleanupGmailOAuthPopup
  };
}

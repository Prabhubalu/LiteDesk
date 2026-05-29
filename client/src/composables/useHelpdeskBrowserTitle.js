import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import {
  resolveTabTitleWithHelpdeskAlerts,
  sumHelpdeskChatAlertCount
} from '@/utils/helpdeskTabAlerts';

const DEFAULT_TITLE = 'Arivu';

let installed = false;
let baseTitle = DEFAULT_TITLE;

/**
 * Prefix browser tab title with unread helpdesk chat count, e.g. "(3) Case #12 · Arivu".
 */
export function useHelpdeskBrowserTitle() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  const { t, te } = useI18n();
  const route = useRoute();
  const { tabs, activeTabId } = useTabs();

  if (document.title) {
    baseTitle = document.title.replace(/^\(\d+\)\s+/, '');
  }

  watch(
    [() => tabs.value, () => activeTabId.value, () => route.path],
    () => {
      const chatUnread = sumHelpdeskChatAlertCount(tabs.value);
      const active = tabs.value.find((tab) => tab.id === activeTabId.value);
      const activeLabel = active
        ? resolveTabTitleWithHelpdeskAlerts(active, t, te)
        : '';

      if (chatUnread > 0 && String(route.path || '').startsWith('/helpdesk')) {
        const segment = activeLabel || t('navigation.helpdesk');
        document.title = `(${chatUnread}) ${segment} · ${DEFAULT_TITLE}`;
        return;
      }

      if (activeLabel && String(route.path || '').startsWith('/helpdesk')) {
        document.title = `${activeLabel} · ${DEFAULT_TITLE}`;
        return;
      }

      document.title = baseTitle;
    },
    { deep: true, immediate: true }
  );
}

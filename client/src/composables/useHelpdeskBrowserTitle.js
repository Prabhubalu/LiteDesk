import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import {
  resolveTabTitleWithHelpdeskAlerts,
  sumHelpdeskChatAlertCount,
} from '@/utils/helpdeskTabAlerts';
import {
  resolveTabTitleWithLiveChatAlerts,
  sumLiveChatAlertCount,
} from '@/utils/liveChatTabAlerts';
import { resolveTabTitle } from '@/utils/navigationLabels';

const DEFAULT_TITLE = 'Arivu';

let installed = false;
let baseTitle = DEFAULT_TITLE;

function resolveActiveTabLabel(active, t, te) {
  if (!active) return '';
  const base = resolveTabTitle(active, t, te);
  const withHelpdesk = resolveTabTitleWithHelpdeskAlerts(active, t, te);
  if (withHelpdesk !== base) return withHelpdesk;
  return resolveTabTitleWithLiveChatAlerts(active, t, te);
}

/**
 * Prefix browser tab title with unread helpdesk / live chat counts.
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
      const path = String(route.path || '');
      const chatUnread = sumHelpdeskChatAlertCount(tabs.value) + sumLiveChatAlertCount(tabs.value);
      const active = tabs.value.find((tab) => tab.id === activeTabId.value);
      const activeLabel = resolveActiveTabLabel(active, t, te);

      if (chatUnread > 0 && (path.startsWith('/helpdesk') || path.startsWith('/live-chat'))) {
        const segment = activeLabel || (path.startsWith('/live-chat')
          ? t('navigation.liveChat')
          : t('navigation.helpdesk'));
        document.title = `(${chatUnread}) ${segment} · ${DEFAULT_TITLE}`;
        return;
      }

      if (activeLabel && (path.startsWith('/helpdesk') || path.startsWith('/live-chat'))) {
        document.title = `${activeLabel} · ${DEFAULT_TITLE}`;
        return;
      }

      document.title = baseTitle;
    },
    { deep: true, immediate: true },
  );
}

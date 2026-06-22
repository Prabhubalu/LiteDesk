import { resolveTabTitle } from '@/utils/navigationLabels';
import { formatHelpdeskTabAlertLabel } from '@/utils/helpdeskTabAlerts';
import {
  LIVE_CHAT_MAIN_TAB_PATH,
  isLiveChatSessionsRoute,
  normalizeLiveChatPath,
} from '@/utils/liveChatTabPaths';

const LIVE_CHAT_ALERT_KINDS = ['chat', 'session'];

export function liveChatAlertKindFromNotification(notification) {
  const eventType = String(notification?.eventType || '');
  if (eventType === 'LIVE_CHAT_MESSAGE_RECEIVED') return 'chat';
  if (eventType === 'LIVE_CHAT_SESSION_STARTED') return 'session';
  return null;
}

export function sessionIdFromLiveChatNotification(notification) {
  const entity = notification?.entity;
  if (!entity?.id) return null;
  const type = String(entity.type || '').toLowerCase().replace(/\s/g, '');
  if (type !== 'livechatsession' && type !== 'live_chat_session') return null;
  return String(entity.id);
}

export function sumLiveChatAlertCount(tabs) {
  if (!Array.isArray(tabs)) return 0;
  let total = 0;
  for (const tab of tabs) {
    const segments = tab?.alertSegments;
    if (!Array.isArray(segments)) continue;
    for (const seg of segments) {
      if (seg.kind === 'chat' || seg.kind === 'session') {
        total += Math.max(0, Number(seg.count) || 0);
      }
    }
  }
  return total;
}

export function resolveTabTitleWithLiveChatAlerts(tab, t, te = () => false) {
  const base = tab?.alertBaseTitle || resolveTabTitle(tab, t, te);
  const segments = Array.isArray(tab?.alertSegments) ? tab.alertSegments : [];
  const liveSegments = segments.filter((seg) => seg.kind === 'chat' || seg.kind === 'session');
  if (!liveSegments.length) {
    return resolveTabTitle(tab, t, te);
  }

  const prefixes = liveSegments.map((seg) => {
    const count = Math.max(1, Number(seg.count) || 1);
    if (seg.kind === 'session') {
      return count > 1
        ? t('liveChat.tabNewSessions', { count })
        : t('liveChat.tabNewSession');
    }
    return formatHelpdeskTabAlertLabel('chat', count, t);
  });

  return [...prefixes, base].join(' · ');
}

/**
 * @param {import('vue').Ref<Array>} tabsRef
 * @param {import('vue').Ref<string|null>} activeTabIdRef
 */
export function createLiveChatTabAlertController(tabsRef, activeTabIdRef) {
  function findLiveChatMainTab() {
    return (
      tabsRef.value.find((tab) => {
        const base = normalizeLiveChatPath(String(tab.path || '').split('?')[0]);
        if (base === LIVE_CHAT_MAIN_TAB_PATH) return true;
        if (isLiveChatSessionsRoute(base)) return true;
        return tab.titleKey === 'navigation.liveChat';
      }) || null
    );
  }

  function ensureAlertBaseTitle(tab, t, te) {
    if (!tab.alertBaseTitle) {
      tab.alertBaseTitle = resolveTabTitle(tab, t, te);
    }
  }

  function markTabAlert(tab, kind, { t, te } = {}) {
    if (!tab || !LIVE_CHAT_ALERT_KINDS.includes(kind)) return;
    if (t) ensureAlertBaseTitle(tab, t, te);

    if (!Array.isArray(tab.alertSegments)) {
      tab.alertSegments = [];
    }

    const existing = tab.alertSegments.find((s) => s.kind === kind);
    if (existing) {
      existing.count = Math.max(1, Number(existing.count) || 1) + 1;
    } else {
      tab.alertSegments.push({ kind, count: 1 });
    }

    tab.hasAlert = true;
    tab.alertKind = kind;
  }

  function clearTabAlert(tab) {
    if (!tab) return;
    delete tab.alertSegments;
    delete tab.hasAlert;
    delete tab.alertKind;
    delete tab.alertBaseTitle;
  }

  function clearTabAlertKind(tab, kind) {
    if (!tab || !kind || !Array.isArray(tab.alertSegments)) return;
    tab.alertSegments = tab.alertSegments.filter((s) => s.kind !== kind);
    if (!tab.alertSegments.length) {
      clearTabAlert(tab);
    } else {
      tab.alertKind = tab.alertSegments[tab.alertSegments.length - 1]?.kind || null;
      tab.hasAlert = true;
    }
  }

  function markLiveChatTabAlert(kind, options = {}) {
    const tab = findLiveChatMainTab();
    if (!tab || tab.id === activeTabIdRef.value) return null;
    markTabAlert(tab, kind, options);
    return tab;
  }

  function clearLiveChatMainTabAlert() {
    const tab = findLiveChatMainTab();
    clearTabAlert(tab);
  }

  function tabShowsAlertHighlight(tab, activeTabId) {
    if (!tab?.alertSegments?.length) return false;
    const hasLiveSegment = tab.alertSegments.some(
      (seg) => seg.kind === 'chat' || seg.kind === 'session',
    );
    if (!hasLiveSegment) return false;
    return tab.id !== activeTabId;
  }

  return {
    findLiveChatMainTab,
    markLiveChatTabAlert,
    clearLiveChatMainTabAlert,
    clearTabAlert,
    tabShowsAlertHighlight,
  };
}

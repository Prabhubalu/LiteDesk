import { resolveTabTitle } from '@/utils/navigationLabels';
import { INTERNAL_CHAT_ROUTE } from '@/utils/internalChatConstants';

const INTERNAL_CHAT_ALERT_KINDS = ['internal', 'mention'];

export function internalChatAlertKindFromNotification(notification) {
  const eventType = String(notification?.eventType || '');
  if (eventType === 'INTERNAL_CHAT_MENTIONED') return 'mention';
  if (eventType === 'INTERNAL_CHAT_MESSAGE_POSTED') return 'internal';
  return null;
}

export function isInternalChatTabPath(path) {
  const base = String(path || '').split('?')[0].split('#')[0];
  return base === INTERNAL_CHAT_ROUTE || base.startsWith(`${INTERNAL_CHAT_ROUTE}/`);
}

export function resolveTabTitleWithInternalChatAlerts(tab, t, te = () => false) {
  const base = tab?.alertBaseTitle || resolveTabTitle(tab, t, te);
  const segments = Array.isArray(tab?.alertSegments) ? tab.alertSegments : [];
  const chatSegments = segments.filter((seg) => INTERNAL_CHAT_ALERT_KINDS.includes(seg.kind));
  if (!chatSegments.length) {
    return resolveTabTitle(tab, t, te);
  }

  const prefixes = chatSegments.map((seg) => {
    const count = Math.max(1, Number(seg.count) || 1);
    if (seg.kind === 'mention') {
      // Prefer dedicated keys; fall back to navigation strings if catalog is stale.
      if (te('internalChat.tabMentions') || te('internalChat.tabMention')) {
        return count > 1
          ? t('internalChat.tabMentions', { count })
          : t('internalChat.tabMention');
      }
      return count > 1
        ? t('navigation.tabNewMessages', { count })
        : t('navigation.tabNewMessage');
    }
    if (te('internalChat.tabUnread') || te('internalChat.tabUnreadOne')) {
      return count > 1
        ? t('internalChat.tabUnread', { count })
        : t('internalChat.tabUnreadOne');
    }
    return count > 1
      ? t('navigation.tabNewMessages', { count })
      : t('navigation.tabNewMessage');
  });

  return [...prefixes, base].join(' · ');
}

/**
 * @param {import('vue').Ref<Array>} tabsRef
 * @param {import('vue').Ref<string|null>} activeTabIdRef
 */
export function createInternalChatTabAlertController(tabsRef, activeTabIdRef) {
  function findInternalChatTab() {
    return (
      tabsRef.value.find((tab) => {
        if (isInternalChatTabPath(tab.path)) return true;
        return tab.titleKey === 'navigation.internalChat';
      }) || null
    );
  }

  function ensureAlertBaseTitle(tab, t, te) {
    if (!tab.alertBaseTitle) {
      tab.alertBaseTitle = resolveTabTitle(tab, t, te);
    }
  }

  function markTabAlert(tab, kind, { t, te } = {}) {
    if (!tab || !INTERNAL_CHAT_ALERT_KINDS.includes(kind)) return;
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

    // Force TabBar refresh (in-place nested mutations can miss some computed paths).
    const idx = tabsRef.value.findIndex((row) => row && row.id === tab.id);
    if (idx >= 0) {
      tabsRef.value.splice(idx, 1, { ...tabsRef.value[idx] });
    }
  }

  function clearTabAlert(tab) {
    if (!tab) return;
    if (!Array.isArray(tab.alertSegments)) {
      delete tab.hasAlert;
      delete tab.alertKind;
      delete tab.alertBaseTitle;
      return;
    }
    const kept = tab.alertSegments.filter((s) => !INTERNAL_CHAT_ALERT_KINDS.includes(s.kind));
    if (!kept.length) {
      delete tab.alertSegments;
      delete tab.hasAlert;
      delete tab.alertKind;
      delete tab.alertBaseTitle;
      return;
    }
    tab.alertSegments = kept;
    tab.alertKind = kept[kept.length - 1]?.kind || null;
    tab.hasAlert = true;
  }

  function markInternalChatTabAlert(kind, options = {}) {
    const tab = findInternalChatTab();
    if (!tab || tab.id === activeTabIdRef.value) return null;
    markTabAlert(tab, kind, options);
    return tab;
  }

  function clearInternalChatMainTabAlert() {
    clearTabAlert(findInternalChatTab());
  }

  function tabShowsAlertHighlight(tab, activeTabId) {
    if (!tab?.alertSegments?.length) return false;
    const hasSeg = tab.alertSegments.some((seg) => INTERNAL_CHAT_ALERT_KINDS.includes(seg.kind));
    if (!hasSeg) return false;
    return tab.id !== activeTabId;
  }

  return {
    findInternalChatTab,
    markInternalChatTabAlert,
    clearInternalChatMainTabAlert,
    clearTabAlert,
    tabShowsAlertHighlight,
  };
}

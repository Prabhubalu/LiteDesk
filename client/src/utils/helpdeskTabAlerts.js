import { resolveTabTitle } from '@/utils/navigationLabels';

export const HELPDESK_TAB_ALERT_KINDS = ['email', 'chat', 'case'];

/**
 * @param {'email'|'chat'|'case'} kind
 * @param {number} count
 * @param {(key: string) => string} t
 */
export function formatHelpdeskTabAlertLabel(kind, count, t) {
  const key =
    kind === 'chat'
      ? 'navigation.tabNewMessage'
      : kind === 'case'
        ? 'navigation.tabNewCase'
        : 'navigation.tabNewEmail';
  const label = t(key);
  return count > 1 ? `${label} (${count})` : label;
}

/**
 * Gmail-style stacked prefix segments before the case title.
 * @param {{ alertSegments?: { kind: string, count: number }[], alertBaseTitle?: string, title?: string, titleKey?: string, path?: string }} tab
 */
export function resolveTabTitleWithHelpdeskAlerts(tab, t, te = () => false) {
  const base =
    tab?.alertBaseTitle ||
    resolveTabTitle(tab, t, te);

  const segments = Array.isArray(tab?.alertSegments) ? tab.alertSegments : [];
  if (!segments.length) {
    return resolveTabTitle(tab, t, te);
  }

  const prefixes = [];
  for (const seg of segments) {
    const kind =
      seg.kind === 'chat' ? 'chat' : seg.kind === 'case' ? 'case' : 'email';
    const count = Math.max(1, Number(seg.count) || 1);
    const single = formatHelpdeskTabAlertLabel(kind, 1, t);
    for (let i = 0; i < count; i += 1) {
      prefixes.push(single);
    }
  }

  return [...prefixes, base].join(' · ');
}

/**
 * @param {import('vue').Ref<Array>} tabsRef
 * @param {import('vue').Ref<string|null>} activeTabIdRef
 */
export function createHelpdeskTabAlertController(tabsRef, activeTabIdRef) {
  function findTabByCaseId(caseId) {
    const id = String(caseId || '').trim();
    if (!id) return null;
    const expected = `/helpdesk/cases/${id}`;
    return (
      tabsRef.value.find((tab) => {
        const base = String(tab.path || '').split('?')[0].split('#')[0];
        return base === expected;
      }) || null
    );
  }

  function ensureAlertBaseTitle(tab, t, te) {
    if (!tab.alertBaseTitle) {
      tab.alertBaseTitle = resolveTabTitle(tab, t, te);
    }
  }

  function markTabAlert(tab, kind, { t, te } = {}) {
    if (!tab || !HELPDESK_TAB_ALERT_KINDS.includes(kind)) return;
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

  function findHelpdeskCasesListTab() {
    return (
      tabsRef.value.find((tab) => {
        const base = String(tab.path || '').split('?')[0].split('#')[0];
        return base === '/helpdesk/cases';
      }) || null
    );
  }

  function markTabAlertForCase(caseId, kind, options = {}) {
    const tab = findTabByCaseId(caseId);
    if (!tab) return null;
    if (tab.id === activeTabIdRef.value) return tab;
    markTabAlert(tab, kind, options);
    return tab;
  }

  /** Prefer an open case tab; otherwise highlight the Cases list tab (typical for CASE_CREATED). */
  function markTabAlertForNewCase(caseId, kind, options = {}) {
    const caseTab = findTabByCaseId(caseId);
    const listTab = findHelpdeskCasesListTab();
    const target =
      caseTab && caseTab.id !== activeTabIdRef.value
        ? caseTab
        : listTab && listTab.id !== activeTabIdRef.value
          ? listTab
          : null;
    if (!target) return null;
    markTabAlert(target, kind, options);
    return target;
  }

  function clearTabAlertById(tabId) {
    const tab = tabsRef.value.find((t) => t.id === tabId);
    clearTabAlert(tab);
  }

  function tabShowsAlertHighlight(tab, activeTabId) {
    if (!tab?.alertSegments?.length) return false;
    return tab.id !== activeTabId;
  }

  return {
    findTabByCaseId,
    markTabAlert,
    clearTabAlert,
    markTabAlertForCase,
    markTabAlertForNewCase,
    clearTabAlertById,
    tabShowsAlertHighlight
  };
}

/**
 * @param {{ eventType?: string, entity?: { type?: string, id?: string } }} notification
 */
export function helpdeskAlertKindFromNotification(notification) {
  const eventType = String(notification?.eventType || '');
  if (eventType === 'CASE_EMAIL_RECEIVED') return 'email';
  if (eventType === 'CASE_CHAT_MESSAGE_RECEIVED') return 'chat';
  if (eventType === 'CASE_CREATED') return 'case';
  return null;
}

export function caseIdFromHelpdeskNotification(notification) {
  const entity = notification?.entity;
  if (!entity || entity.type !== 'Case' || !entity.id) return null;
  return String(entity.id);
}

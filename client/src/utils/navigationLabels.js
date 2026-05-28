/**
 * Stable i18n keys for sidebar items and tab titles (navigation.* namespace).
 */

import { resolveModuleDisplayName } from '@/utils/configurableLabelResolver';

/** @type {Record<string, string>} */
export const SURFACE_LABEL_KEYS = {
  home: 'navigation.home',
  inbox: 'navigation.inbox',
  approvals: 'navigation.approvals',
  attention: 'navigation.attention',
  search: 'navigation.search',
  trash: 'navigation.trash',
};

/** Core / platform module keys → navigation.* */
/** @type {Record<string, string>} */
export const MODULE_LABEL_KEYS = {
  people: 'navigation.modulePeople',
  contacts: 'navigation.moduleContacts',
  organizations: 'navigation.moduleOrganizations',
  tasks: 'navigation.moduleTasks',
  events: 'navigation.moduleEvents',
  forms: 'navigation.moduleForms',
  items: 'navigation.moduleItems',
  deals: 'navigation.moduleDeals',
  quotes: 'navigation.moduleQuotes',
  responses: 'navigation.moduleResponses',
  imports: 'navigation.moduleImports',
  import: 'navigation.moduleImports',
  cases: 'navigation.moduleCases',
  findings: 'navigation.moduleFindings',
  audits: 'navigation.moduleAudits',
  dashboard: 'navigation.dashboard',
};

/** App registry appKey → navigation.* */
/** @type {Record<string, string>} */
export const APP_NAME_KEYS = {
  SALES: 'navigation.appSales',
  AUDIT: 'navigation.appAudit',
  HELPDESK: 'navigation.appHelpdesk',
  PROJECTS: 'navigation.appProjects',
  PORTAL: 'navigation.appPortal',
};

/** Exact path → titleKey (optional titleParams in resolver) */
/** @type {Record<string, string>} */
export const ROUTE_TITLE_KEYS = {
  '/platform/home': 'navigation.home',
  '/sales/dashboard': 'navigation.salesDashboard',
  '/dashboard': 'navigation.dashboard',
  '/inbox': 'navigation.inbox',
  '/approvals': 'navigation.approvals',
  '/contacts': 'navigation.moduleContacts',
  '/people': 'navigation.modulePeople',
  '/organizations': 'navigation.moduleOrganizations',
  '/deals': 'navigation.moduleDeals',
  '/quotes': 'navigation.moduleQuotes',
  '/tasks': 'navigation.moduleTasks',
  '/events': 'navigation.moduleEvents',
  '/forms': 'navigation.moduleForms',
  '/calendar': 'navigation.moduleEvents',
  '/imports': 'navigation.moduleImports',
  '/items': 'navigation.moduleItems',
  '/helpdesk/cases': 'navigation.moduleCases',
  '/helpdesk/cases/': 'navigation.moduleCases',
  '/trash': 'navigation.userTrash',
  '/demo-requests': 'navigation.tabDemoRequests',
  '/instances': 'navigation.tabInstances',
  '/settings': 'navigation.settings',
  '/appointments/pages': 'navigation.tabBookingPages',
  '/appointments/configure': 'navigation.tabPersonalBooking',
  '/control': 'navigation.userControlPanel',
  '/control/demo-requests': 'navigation.tabDemoRequests',
  '/control/instances': 'navigation.tabInstances',
  '/settings/automation/automation-rules': 'navigation.tabAutomationRules',
  '/settings/automation/processes': 'navigation.tabProcesses',
  '/settings/automation/flows': 'navigation.tabBusinessFlows',
  '/audit/dashboard': 'navigation.auditDashboard',
  '/audit/audits': 'navigation.tabMyAudits',
  '/platform/attention': 'navigation.attention',
};

/**
 * @param {string} moduleKey
 * @returns {string|undefined}
 */
export function getModuleLabelKey(moduleKey) {
  const k = String(moduleKey || '').toLowerCase();
  return MODULE_LABEL_KEYS[k];
}

/**
 * @param {string} surfaceId
 * @returns {string|undefined}
 */
export function getSurfaceLabelKey(surfaceId) {
  return SURFACE_LABEL_KEYS[surfaceId];
}

/**
 * @param {string} appKey
 * @returns {string|undefined}
 */
export function getAppNameKey(appKey) {
  return APP_NAME_KEYS[String(appKey || '').toUpperCase()];
}

/**
 * @param {{ labelKey?: string, label?: string }} item
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} [te]
 */
export function resolveSidebarItemLabel(item, t) {
  if (item?.labelKey) {
    return t(item.labelKey);
  }
  return item?.label || '';
}

/**
 * Tab title metadata for a route. Dynamic record names keep plain `title`.
 * @param {string} path
 * @param {Record<string, unknown>} [params]
 * @returns {{ titleKey?: string, titleParams?: Record<string, unknown>, title?: string }}
 */
export function getTabTitleMetaForPath(path, params = {}) {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  const segments = pathOnly.split('/').filter(Boolean);

  if (ROUTE_TITLE_KEYS[pathOnly]) {
    return { titleKey: ROUTE_TITLE_KEYS[pathOnly] };
  }

  if (pathOnly.startsWith('/sales/dashboard')) {
    return { titleKey: 'navigation.salesDashboard' };
  }

  if (pathOnly.startsWith('/control/')) {
    const sub = segments[1];
    if (sub && ROUTE_TITLE_KEYS[`/control/${sub}`]) {
      return { titleKey: ROUTE_TITLE_KEYS[`/control/${sub}`] };
    }
    return { titleKey: 'navigation.userControlPanel' };
  }

  if (pathOnly.startsWith('/settings/automation/')) {
    const sub = segments[2];
    if (sub === 'flows' && segments[3]) {
      if (segments[4] === 'health') return { titleKey: 'navigation.tabFlowHealth' };
      if (segments[4] === 'edit') return { titleKey: 'navigation.tabEditBusinessFlow' };
      if (segments[3] === 'create') return { titleKey: 'navigation.tabCreateBusinessFlow' };
      return { titleKey: 'navigation.tabBusinessFlow' };
    }
    const key = ROUTE_TITLE_KEYS[`/settings/automation/${sub}`];
    if (key) return { titleKey: key };
    return { titleKey: 'navigation.tabAutomation' };
  }

  if (pathOnly.startsWith('/audit/')) {
    if (pathOnly.startsWith('/audit/dashboard')) return { titleKey: 'navigation.auditDashboard' };
    if (pathOnly.startsWith('/audit/audits')) {
      if (segments.length > 2) return { titleKey: 'navigation.tabAuditDetail' };
      return { titleKey: 'navigation.tabMyAudits' };
    }
    return { titleKey: 'navigation.appAudit' };
  }

  if (pathOnly.startsWith('/appointments/')) {
    if (pathOnly.includes('/team/configure')) {
      return segments[2] ? { titleKey: 'navigation.tabTeamBooking' } : { titleKey: 'navigation.tabNewTeamPage' };
    }
    if (pathOnly.startsWith('/appointments/configure/user/')) {
      return { titleKey: 'navigation.tabBookingPage' };
    }
    return { titleKey: 'navigation.tabBookingPages' };
  }

  if (pathOnly.startsWith('/helpdesk/cases')) {
    if (segments[2] === 'new' || segments.length <= 2) {
      return { titleKey: 'navigation.moduleCases' };
    }
    return { titleKey: 'navigation.tabCaseDetail' };
  }

  if (segments[0] === 'dashboard' && segments[1]) {
    const appKey = segments[1];
    const appKeyUpper = appKey.toUpperCase();
    const appNameKey = getAppNameKey(appKeyUpper);
    if (appNameKey) {
      return { titleKey: 'navigation.appDashboard', titleParams: { app: appKey } };
    }
    return { titleKey: 'navigation.dashboard' };
  }

  if (segments[0] === 'forms' && segments[2] === 'responses' && segments[3]) {
    return { titleKey: 'navigation.tabFormResponseDetail', titleParams: { id: segments[3] } };
  }

  // Record detail: use dynamic title when name is known
  if (segments.length > 2 && !pathOnly.startsWith('/audit/') && segments[0] !== 'dashboard') {
    const moduleKey = segments[0];
    const moduleLabelKey = getModuleLabelKey(moduleKey);
    if (params?.name) {
      return {
        titleKey: 'navigation.tabRecordNamed',
        titleParams: { moduleRoute: moduleKey, name: params.name },
      };
    }
    if (moduleLabelKey) {
      return { titleKey: 'navigation.tabRecordDetail', titleParams: { moduleRoute: moduleKey } };
    }
  }

  const basePath = `/${segments[0] || ''}`;
  if (ROUTE_TITLE_KEYS[basePath]) {
    return { titleKey: ROUTE_TITLE_KEYS[basePath] };
  }

  return { titleKey: 'navigation.tabPage' };
}

/**
 * @param {string} titleKey
 * @param {Record<string, unknown>} [params]
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 * @param {(key: string) => boolean} te
 */
function localizedTabTitleParams(titleKey, params, t, te) {
  if (
    params &&
    (titleKey === 'navigation.tabRecordNamed' || titleKey === 'navigation.tabRecordDetail')
  ) {
    const moduleRoute = params.moduleRoute || params.module;
    if (moduleRoute && getModuleLabelKey(String(moduleRoute))) {
      return {
        ...params,
        module: resolveModuleDisplayName(String(moduleRoute), t, te),
      };
    }
  }
  return params || {};
}

/**
 * Display title for a tab object.
 * @param {{ titleKey?: string, titleParams?: Record<string, unknown>, title?: string, path?: string }} tab
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 * @param {(key: string) => boolean} [te]
 */
export function resolveTabTitle(tab, t, te = () => false) {
  if (tab?.titleKey) {
    const params = localizedTabTitleParams(tab.titleKey, tab.titleParams, t, te);
    return t(tab.titleKey, params);
  }
  if (tab?.title) return tab.title;
  if (tab?.path) {
    const meta = getTabTitleMetaForPath(tab.path, tab.params || {});
    if (meta.titleKey) {
      const params = localizedTabTitleParams(meta.titleKey, meta.titleParams, t, te);
      return t(meta.titleKey, params);
    }
  }
  return t('navigation.tabPage');
}

/**
 * Infer titleKey from path when loading legacy tabs from storage.
 * @param {{ path?: string, params?: Record<string, unknown>, title?: string, titleKey?: string }} tab
 */
export function enrichTabWithTitleKey(tab) {
  if (!tab.path) return tab;
  const meta = getTabTitleMetaForPath(tab.path, tab.params || {});
  if (!meta.titleKey) return tab;
  const segments = String(tab.path).split('/').filter(Boolean);
  const pathOnly = String(tab.path).split('?')[0];
  const isNamedRecord =
    (meta.titleKey === 'navigation.tabRecordNamed' || meta.titleKey === 'navigation.tabRecordDetail') &&
    segments.length > 2 &&
    tab.title &&
    !ROUTE_TITLE_KEYS[pathOnly];
  if (isNamedRecord && tab.titleKey) return tab;
  if (isNamedRecord && !tab.titleKey) return tab;
  return { ...tab, titleKey: meta.titleKey, titleParams: meta.titleParams };
}

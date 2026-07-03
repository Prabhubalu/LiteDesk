/**
 * Analytics Platform — permission module keys, actions, and legacy mapping.
 * Authoritative matrix: docs/ANALYTICS_PERMISSION_MATRIX.md
 */

const ANALYTICS_MODULE_KEYS = Object.freeze({
  REPORTS: 'analytics_reports',
  WIDGETS: 'analytics_widgets',
  DASHBOARDS: 'analytics_dashboards',
  ADMIN: 'analytics_admin',
});

/** @deprecated transitional — maps to analytics_reports */
const LEGACY_REPORTS_MODULE_KEY = 'reports';

const ANALYTICS_REPORT_ACTIONS = Object.freeze([
  'read',
  'create',
  'update',
  'delete',
  'publish',
  'execute',
  'export',
  'schedule',
  'share',
]);

const ANALYTICS_WIDGET_ACTIONS = Object.freeze([
  'read',
  'create',
  'update',
  'delete',
  'publish',
  'share',
]);

const ANALYTICS_DASHBOARD_ACTIONS = Object.freeze([
  'read',
  'create',
  'update',
  'delete',
  'publish',
  'share',
  'export',
]);

const ANALYTICS_ADMIN_ACTIONS = Object.freeze([
  'certify',
  'manageSettings',
  'viewMetrics',
]);

/**
 * Legacy reports envelope → analytics_reports action.
 * Used during RBAC catalog migration (A1).
 */
const LEGACY_REPORTS_ACTION_MAP = Object.freeze({
  read: 'read',
  view: 'read',
  create: 'create',
  update: 'update',
  edit: 'update',
  delete: 'delete',
  export: 'export',
  exportData: 'export',
});

/**
 * Default persona grants — seed reference for role templates.
 * Not enforced at runtime; applied during role seed / migration.
 */
const ANALYTICS_PERSONA_DEFAULTS = Object.freeze({
  tenantAdmin: {
    analytics_reports: {
      read: true,
      create: true,
      update: true,
      delete: true,
      publish: true,
      execute: true,
      export: true,
      schedule: true,
      share: true,
    },
    analytics_widgets: {
      read: true,
      create: true,
      update: true,
      delete: true,
      publish: true,
      share: true,
    },
    analytics_dashboards: {
      read: true,
      create: true,
      update: true,
      delete: true,
      publish: true,
      share: true,
      export: true,
    },
    analytics_admin: {
      certify: true,
      manageSettings: true,
      viewMetrics: true,
    },
  },
  manager: {
    analytics_reports: {
      read: true,
      create: true,
      update: true,
      delete: true,
      publish: true,
      execute: true,
      export: true,
      schedule: true,
      share: true,
    },
    analytics_widgets: {
      read: true,
      create: true,
      update: true,
      delete: true,
      publish: true,
      share: true,
    },
    analytics_dashboards: {
      read: true,
      create: true,
      update: true,
      delete: true,
      publish: true,
      share: true,
      export: true,
    },
  },
  rep: {
    analytics_reports: {
      read: true,
      create: true,
      update: true,
      delete: true,
      publish: false,
      execute: true,
      export: true,
      schedule: false,
      share: false,
    },
    analytics_widgets: { read: true },
    analytics_dashboards: { read: true },
  },
  viewer: {
    analytics_reports: { read: true, execute: true, export: true },
    analytics_widgets: { read: true },
    analytics_dashboards: { read: true },
  },
});

/**
 * Resolve analytics permission from user envelope with legacy fallback.
 * @param {object} userPermissions - user.permissions plain object
 * @param {string} moduleKey - analytics module key
 * @param {string} action - analytics action
 * @returns {boolean}
 */
function hasAnalyticsPermission(userPermissions, moduleKey, action) {
  if (!userPermissions || typeof userPermissions !== 'object') return false;

  const mod = userPermissions[moduleKey];
  if (mod && typeof mod === 'object' && mod[action] === true) return true;

  if (moduleKey === ANALYTICS_MODULE_KEYS.REPORTS) {
    const legacy = userPermissions[LEGACY_REPORTS_MODULE_KEY];
    if (!legacy || typeof legacy !== 'object') return false;
    const legacyAction = LEGACY_REPORTS_ACTION_MAP[action] || action;
    if (action === 'execute' || action === 'publish' || action === 'schedule') {
      if (action === 'execute') return legacy.read === true || legacy.view === true;
      return false;
    }
    const mapped = LEGACY_REPORTS_ACTION_MAP[legacyAction] || legacyAction;
    return legacy[mapped] === true || legacy[action] === true;
  }

  return false;
}

/**
 * Map checkPermission-style action to analytics action.
 * @param {string} action - view|create|edit|delete|export|run|publish
 * @returns {string}
 */
function normalizeAnalyticsAction(action) {
  const map = {
    view: 'read',
    edit: 'update',
    run: 'execute',
  };
  return map[action] || action;
}

module.exports = {
  ANALYTICS_MODULE_KEYS,
  LEGACY_REPORTS_MODULE_KEY,
  ANALYTICS_REPORT_ACTIONS,
  ANALYTICS_WIDGET_ACTIONS,
  ANALYTICS_DASHBOARD_ACTIONS,
  ANALYTICS_ADMIN_ACTIONS,
  LEGACY_REPORTS_ACTION_MAP,
  ANALYTICS_PERSONA_DEFAULTS,
  hasAnalyticsPermission,
  normalizeAnalyticsAction,
};

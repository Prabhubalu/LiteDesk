/** UI-only helpers for the role permission editor (no API/schema changes). */

export const CRUD_ACTIONS = ['read', 'create', 'update', 'delete'];

export const ADVANCED_ACTION_KEYS = [
  'export',
  'import',
  'viewAll',
  'execution',
  'review',
  'approve',
  'manageRoles',
  'manageBilling'
];

export const SENSITIVE_ACTION_KEYS = new Set([
  'delete',
  'manageRoles',
  'manageBilling',
  'approve',
  'execution'
]);

export const ADVANCED_LABELS = {
  export: 'Export',
  import: 'Import',
  viewAll: 'View all',
  execution: 'Execute',
  review: 'Review',
  approve: 'Approve',
  manageRoles: 'Manage roles',
  manageBilling: 'Billing'
};

export const ACCESS_MODE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'readOnly', label: 'Read only' },
  { value: 'full', label: 'Full' },
  { value: 'custom', label: 'Custom' }
];

export function hasAction(module, action) {
  if (!Array.isArray(module?.actions)) return false;
  if (module.actions.includes(action)) return true;
  if (action === 'read' && module.actions.includes('view')) return true;
  if (action === 'update' && module.actions.includes('edit')) return true;
  return false;
}

export function getCrudActionsForModule(module) {
  return CRUD_ACTIONS.filter((a) => hasAction(module, a));
}

export function getAdvancedActionsForModule(module) {
  const fromActions = (module?.actions || []).filter((a) => ADVANCED_ACTION_KEYS.includes(a));
  if (module.supportsViewAll && hasAction(module, 'read') && !fromActions.includes('viewAll')) {
    fromActions.push('viewAll');
  }
  return fromActions;
}

export function hasAnyAdvancedEnabled(perms, module) {
  return getAdvancedActionsForModule(module).some((a) => perms?.[a] === true);
}

/** @returns {'none'|'readOnly'|'full'|'custom'} */
export function getModuleAccessMode(module, perms = {}) {
  if (!perms || typeof perms !== 'object') return 'none';

  const crud = getCrudActionsForModule(module);
  const readOn = hasAction(module, 'read') && perms.read === true;
  const anyCrudBesidesRead = crud
    .filter((a) => a !== 'read')
    .some((a) => perms[a] === true);

  if (!readOn && !anyCrudBesidesRead && !hasAnyAdvancedEnabled(perms, module)) {
    return 'none';
  }

  if (hasAnyAdvancedEnabled(perms, module)) return 'custom';

  const allCrudOn = crud.every((a) => perms[a] === true);
  const onlyRead =
    readOn && crud.filter((a) => a !== 'read').every((a) => perms[a] !== true);

  if (onlyRead) return 'readOnly';
  if (allCrudOn && crud.length > 0) return 'full';
  return 'custom';
}

export function applyModuleAccessMode(module, perms, mode) {
  if (!perms) return;

  const crud = getCrudActionsForModule(module);
  const advanced = getAdvancedActionsForModule(module);

  const clearAdvanced = () => {
    advanced.forEach((a) => {
      if (perms[a] !== undefined) perms[a] = false;
    });
  };

  if (mode === 'none') {
    crud.forEach((a) => {
      if (perms[a] !== undefined) perms[a] = false;
    });
    clearAdvanced();
    return;
  }

  if (mode === 'readOnly') {
    crud.forEach((a) => {
      if (perms[a] !== undefined) perms[a] = a === 'read';
    });
    clearAdvanced();
    return;
  }

  if (mode === 'full') {
    crud.forEach((a) => {
      if (perms[a] !== undefined) perms[a] = true;
    });
    clearAdvanced();
    return;
  }

  // custom — no bulk apply
}

export function applyPermissionSideEffects(perms, action) {
  if (perms[action]) perms.read = true;
}

export function applyPermissionUncheck(perms, action) {
  if (!perms) return;
  if (action === 'read') {
    perms.create = false;
    perms.update = false;
    perms.delete = false;
    perms.export = false;
    perms.import = false;
    perms.viewAll = false;
    if (perms.manageRoles !== undefined) perms.manageRoles = false;
    if (perms.manageBilling !== undefined) perms.manageBilling = false;
    if (perms.execution !== undefined) perms.execution = false;
    if (perms.review !== undefined) perms.review = false;
    if (perms.approve !== undefined) perms.approve = false;
  } else if (action === 'create') {
    perms.update = false;
    perms.delete = false;
    perms.import = false;
  } else if (action === 'update') {
    perms.delete = false;
  }
}

function moduleAccessLabel(module, perms) {
  const mode = getModuleAccessMode(module, perms);
  if (mode === 'full') return 'full';
  if (mode === 'readOnly') return 'read-only';
  if (mode === 'none') return 'none';
  return 'partial';
}

function summarizeSection(section, modules, permissions) {
  const sectionModules = modules.filter((m) => (m.sectionId || 'default') === section.id);
  if (!sectionModules.length) return null;

  const labels = { full: 0, readOnly: 0, none: 0, partial: 0 };
  for (const mod of sectionModules) {
    const mode = getModuleAccessMode(mod, permissions[mod.key] || {});
    if (mode === 'full') labels.full += 1;
    else if (mode === 'readOnly') labels.readOnly += 1;
    else if (mode === 'none') labels.none += 1;
    else labels.partial += 1;
  }

  const total = sectionModules.length;
  const name = section.label || section.id;

  if (labels.none === total) {
    return { i18nKey: 'roleDrawerSummaryNoAccess', params: { section: name }, tone: 'muted' };
  }
  if (labels.full === total) {
    return { i18nKey: 'roleDrawerSummaryFullAccess', params: { section: name }, tone: 'positive' };
  }
  if (labels.readOnly === total) {
    return { i18nKey: 'roleDrawerSummaryReadOnlyAccess', params: { section: name }, tone: 'neutral' };
  }
  if (labels.full > 0 && labels.none === total - labels.full) {
    return { i18nKey: 'roleDrawerSummaryFullAccessTo', params: { section: name }, tone: 'positive' };
  }
  if (labels.readOnly > 0 && labels.none + labels.readOnly === total) {
    return { i18nKey: 'roleDrawerSummaryReadOnlyAccessTo', params: { section: name }, tone: 'neutral' };
  }
  const active = total - labels.none;
  return {
    i18nKey: 'roleDrawerSummaryLimitedAccess',
    params: { section: name, active, total },
    tone: 'neutral'
  };
}

/**
 * Human-readable access summary bullets for the role drawer.
 * @returns {{ text: string, tone: 'positive'|'neutral'|'muted'|'warning' }[]}
 */
export function buildRoleAccessSummary({ permissions, modules, sections, form }) {
  const lines = [];
  const perms = permissions || {};

  if (form?.canViewAllData) {
    lines.push({ i18nKey: 'roleDrawerSummaryViewAll', params: {}, tone: 'warning' });
  }
  if (form?.canManageTeam) {
    lines.push({ i18nKey: 'roleDrawerSummaryManageTeam', params: {}, tone: 'neutral' });
  }
  if (form?.canExportData) {
    lines.push({ i18nKey: 'roleDrawerSummaryExportData', params: {}, tone: 'neutral' });
  }

  const usersPerms = perms.users || perms.Users;
  const settingsPerms = perms.settings || perms.Settings;
  if (usersPerms?.manageRoles || settingsPerms?.manageRoles) {
    lines.push({ i18nKey: 'roleDrawerSummaryManageUsersRoles', params: {}, tone: 'warning' });
  }
  if (settingsPerms?.manageBilling) {
    lines.push({ i18nKey: 'roleDrawerSummaryManageBilling', params: {}, tone: 'warning' });
  }

  const reportsPerms = perms.reports;
  if (reportsPerms?.read && !usersPerms?.manageRoles) {
    lines.push({ i18nKey: 'roleDrawerSummaryViewReports', params: {}, tone: 'neutral' });
  }

  for (const section of sections || []) {
    const line = summarizeSection(section, modules, perms);
    if (line) lines.push(line);
  }

  if (!lines.length) {
    lines.push({ i18nKey: 'roleDrawerSummaryNoneConfigured', params: {}, tone: 'muted' });
  }

  const deduped = [];
  const seen = new Set();
  for (const line of lines) {
    const dedupeKey = `${line.i18nKey}:${JSON.stringify(line.params || {})}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(line);
  }

  return deduped.slice(0, 8);
}

export function chipVariantForAction(action) {
  if (SENSITIVE_ACTION_KEYS.has(action)) return 'sensitive';
  if (ADVANCED_ACTION_KEYS.includes(action)) return 'advanced';
  return 'crud';
}

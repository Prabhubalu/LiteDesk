/**
 * ============================================================================
 * PLATFORM MODULE LIST: Builder Function
 * ============================================================================
 * 
 * Builds module list definition from app registry and user permissions.
 * 
 * Rules:
 * - Registry-driven: All structure comes from appRegistry
 * - Permission-aware: Filters columns/actions by permissions
 * - Standard structure: Columns, Actions, Filters, Empty State
 * - Never leaves UI guessing
 * 
 * ============================================================================
 */

import type {
  ModuleListDefinition,
  ListColumn,
  ListAction,
  ListFilter,
  AppRegistryModuleEntry,
  ColumnDataType,
  ActionType,
} from '@/types/module-list.types';
import { PermissionOutcome } from '@/types/permission-visibility.types';
import type { EmptyStateDefinition } from '@/types/empty-state.types';
import { EmptyStateType } from '@/types/empty-state.types';
import type { AppRegistry } from '@/types/sidebar.types';
import type { PermissionSnapshot } from '@/types/permission-snapshot.types';
import { hasPermission as checkPermission } from '@/types/permission-snapshot.types';
import { memoizeBuilder } from '@/utils/builderCache';
import { PEOPLE_FIELD_METADATA } from '@/platform/fields/peopleFieldModel';
import { hasModuleListConfig } from '@/platform/modules/moduleListRegistry';

/**
 * Get fallback columns for common modules when list config is missing
 */
function getFallbackColumns(moduleKey: string): Array<{
  key: string;
  label: string;
  dataType: ColumnDataType;
  sortable?: boolean;
  filterable?: boolean;
  permission?: string;
  fieldPath?: string;
  order?: number;
}> {
  const fallbacks: Record<string, Array<any>> = {
    people: [
      { key: 'name', label: 'Name', dataType: 'text', sortable: true, order: 1 }, // Computed from first_name + last_name
      { key: 'email', label: 'Email', dataType: 'text', sortable: true, order: 2 },
      { key: 'phone', label: 'Phone', dataType: 'text', sortable: false, order: 3 },
      { key: 'organization', label: 'Organization', dataType: 'text', sortable: true, order: 4 },
      { key: 'sales_type', label: 'Type', dataType: 'status', sortable: true, order: 5 },
      { key: 'assignedTo', label: 'Assigned To', dataType: 'user', sortable: true, order: 6 },
    ],
    deals: [
      { key: 'name', label: 'Deal Name', dataType: 'text', sortable: true, order: 1 },
      { key: 'amount', label: 'Amount', dataType: 'currency', sortable: true, order: 2 },
      { key: 'stage', label: 'Stage', dataType: 'status', sortable: true, order: 3 },
      { key: 'contact', label: 'Contact', dataType: 'text', sortable: true, order: 4 },
      { key: 'owner_id', label: 'Owner', dataType: 'user', sortable: true, order: 5 },
    ],
    tasks: [
      { key: 'title', label: 'Title', dataType: 'text', sortable: true, order: 1 },
      { key: 'status', label: 'Status', dataType: 'status', sortable: true, order: 2 },
      { key: 'priority', label: 'Priority', dataType: 'status', sortable: true, order: 3 },
      { key: 'dueDate', label: 'Due Date', dataType: 'date', sortable: true, order: 4 },
      { key: 'assignedTo', label: 'Assigned To', dataType: 'user', sortable: true, order: 5 },
    ],
    campaigns: [
      { key: 'name', label: 'Name', dataType: 'text', sortable: true, order: 1 },
      { key: 'subject', label: 'Subject', dataType: 'text', sortable: true, order: 2 },
      { key: 'status', label: 'Status', dataType: 'status', sortable: true, order: 3 },
      { key: 'recipientCount', label: 'Recipients', dataType: 'number', sortable: false, order: 4 },
      { key: 'updatedAt', label: 'Updated', dataType: 'date', sortable: true, order: 5 },
    ],
  };
  
  return fallbacks[moduleKey] || [];
}

/**
 * Analytics list modules share the reports permission namespace.
 */
function resolveListPermissionModule(moduleKey: string): string {
  if (moduleKey === 'reports' || moduleKey === 'widgets' || moduleKey === 'dashboards') {
    return 'reports';
  }
  return moduleKey;
}

/**
 * Get fallback actions for common modules when list config is missing
 */
function getFallbackActions(moduleKey: string, appKey?: string): Array<{
  key: string;
  label: string;
  type: ActionType;
  route?: string;
  permission?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  order?: number;
}> {
  const permissionModule = resolveListPermissionModule(moduleKey);
  const createLabel = moduleKey === 'people' ? 'New Person' : 
                     moduleKey === 'deals' ? 'New Deal' :
                     moduleKey === 'tasks' ? 'New Task' :
                     `New ${moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1)}`;
  
  const actions: Array<{
    key: string;
    label: string;
    type: ActionType;
    route?: string;
    permission?: string;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'outline';
    order?: number;
  }> = [
    {
      key: 'create',
      label: createLabel,
      type: 'create' as ActionType,
      route: getCreateRoute(moduleKey, appKey),
      permission: `${permissionModule}.create`,
      variant: 'primary',
      order: 1,
    },
    ...(CSV_IMPORT_MODULE_KEYS.has(moduleKey)
      ? [{
          key: 'import',
          label: 'Import',
          type: 'import' as ActionType,
          permission: `${permissionModule}.import`,
          variant: 'secondary' as const,
          order: 2,
        }]
      : []),
    ...(moduleKey === 'campaigns' || moduleKey === 'reports' || moduleKey === 'widgets' || moduleKey === 'dashboards'
      ? []
      : [{
          key: 'export',
          label: 'Export',
          type: 'export' as ActionType,
          permission: `${permissionModule}.exportData`,
          variant: 'secondary' as const,
          order: 3,
        }]),
  ];

  return actions;
}

function getCreateRoute(moduleKey: string, appKey?: string): string {
  const key = String(moduleKey || '').toLowerCase().trim();
  const app = String(appKey || '').toUpperCase().trim();
  if (key === 'cases' && app === 'HELPDESK') {
    return '/helpdesk/cases/new';
  }
  if (key === 'campaigns') {
    return '/marketing/campaigns/new';
  }
  if (key === 'reports') {
    return '/analytics/reports/new';
  }
  if (key === 'widgets') {
    return '/analytics/widgets/new';
  }
  if (key === 'dashboards') {
    return '/analytics/dashboards/new';
  }
  return `/${key}/new`;
}

const CSV_IMPORT_MODULE_KEYS = new Set(['people', 'contacts', 'deals', 'tasks', 'organizations']);

/**
 * Check if user has a specific permission (using snapshot)
 */
function hasPermission(
  permission: string | undefined,
  snapshot: PermissionSnapshot
): boolean {
  return checkPermission(snapshot, permission);
}

/**
 * Determine permission outcome
 */
function getPermissionOutcome(
  permission: string | undefined,
  snapshot: PermissionSnapshot
): PermissionOutcome {
  if (!permission) {
    return PermissionOutcome.ENABLED;
  }
  return hasPermission(permission, snapshot) ? PermissionOutcome.ENABLED : PermissionOutcome.HIDDEN;
}

/**
 * Check if a field is eligible for table display based on field metadata
 * For People module: filters system fields and enforces participation rules
 */
function isFieldTableEligible(
  fieldKey: string,
  moduleKey: string
): boolean {
  // Only apply People-specific filtering for people module
  if (moduleKey !== 'people') {
    return true; // For other modules, allow all fields
  }

  // Known computed/virtual fields that don't exist in metadata but are valid
  // These are computed from actual fields (e.g., "name" = first_name + last_name)
  const computedFields = new Set(['name']);
  
  if (computedFields.has(fieldKey)) {
    // Computed fields are always eligible (they're derived from metadata fields)
    return true;
  }

  // Get field metadata (fail-safe: if field not in metadata, allow it)
  const metadata = PEOPLE_FIELD_METADATA[fieldKey];
  if (!metadata) {
    // Field not in metadata - log warning but allow it (graceful degradation)
    // Only warn in dev mode to reduce noise
    if (import.meta.env.DEV) {
      console.warn(`[buildModuleListFromRegistry] Field "${fieldKey}" not found in PEOPLE_FIELD_METADATA`);
    }
    return true;
  }

  // System fields never appear in table
  if (metadata.owner === 'system') {
    return false;
  }

  // Core identity fields - eligible if showInTable is true (already filtered by registry)
  // We just need to ensure they're not system fields (already checked above)
  if (metadata.owner === 'core') {
    return true; // showInTable filtering happens in registry/field settings
  }

  // Participation fields - eligible if showInTable is true (already filtered by registry)
  // We just need to ensure they're not system fields (already checked above)
  // Note: Per-row participation checking happens at render time, not column filtering time
  if (metadata.owner === 'participation') {
    return true; // showInTable filtering happens in registry/field settings
  }

  return true;
}

function dedupeListColumnsByKey<T extends { key: string }>(cols: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of cols) {
    const k = String(c.key || '').trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/**
 * Build list columns from registry
 */
function buildColumns(
  columns: NonNullable<AppRegistryModuleEntry['list']>['columns'] = [],
  snapshot: PermissionSnapshot,
  moduleKey?: string
): ListColumn[] {
  if (!columns) return [];

  let mapped = columns.map((col) => {
    const isLegacyPeopleType = moduleKey === 'people' && String(col.key || '').trim() === 'type';
    const key = isLegacyPeopleType ? 'sales_type' : col.key;
    const fieldPath =
      isLegacyPeopleType && (!col.fieldPath || String(col.fieldPath).trim() === 'type')
        ? undefined
        : col.fieldPath;
    return {
      key,
      label: col.label,
      dataType: col.dataType,
      sortable: col.sortable ?? false,
      filterable: col.filterable ?? false,
      permission: col.permission,
      visibility: getPermissionOutcome(col.permission, snapshot),
      order: col.order ?? 999,
      fieldPath,
    };
  });

  if (moduleKey === 'people') {
    mapped = dedupeListColumnsByKey(mapped);
  }

  return mapped
    .filter((col) => {
      // Filter by permission visibility
      if (col.visibility === PermissionOutcome.HIDDEN) {
        return false;
      }
      // Filter by field eligibility (People-specific rules)
      if (moduleKey && !isFieldTableEligible(col.key, moduleKey)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Build primary actions from registry
 */
function buildPrimaryActions(
  actions: NonNullable<AppRegistryModuleEntry['list']>['primaryActions'] = [],
  snapshot: PermissionSnapshot,
  moduleKey?: string,
  appKey?: string
): ListAction[] {
  if (!actions) return [];
  
  return actions
    .map((action) => {
      const normalizedRoute =
        action.type === 'create' &&
        moduleKey &&
        appKey &&
        (!action.route || String(action.route).trim() === '/cases/new')
          ? getCreateRoute(moduleKey, appKey)
          : action.route;
      return {
        key: action.key,
        label: action.label,
        type: action.type,
        route: normalizedRoute,
        permission: action.permission,
        visibility: getPermissionOutcome(action.permission, snapshot),
        icon: action.icon,
        variant: action.variant || 'primary',
        order: action.order ?? 999,
        bulk: false,
      };
    })
    .filter((action) => {
      if (action.type === 'import' && moduleKey && !CSV_IMPORT_MODULE_KEYS.has(moduleKey)) {
        return false;
      }
      return action.visibility !== PermissionOutcome.HIDDEN;
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Build bulk actions from registry
 */
function buildBulkActions(
  actions: NonNullable<AppRegistryModuleEntry['list']>['bulkActions'] = [],
  snapshot: PermissionSnapshot
): ListAction[] {
  if (!actions) return [];
  
  return actions
    .map((action) => ({
      key: action.key,
      label: action.label,
      type: action.type,
      permission: action.permission,
      visibility: getPermissionOutcome(action.permission, snapshot),
      icon: action.icon,
      variant: 'secondary' as const,
      order: action.order ?? 999,
      bulk: true,
    }))
    .filter((action) => action.visibility !== PermissionOutcome.HIDDEN)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Build row actions from registry
 */
function buildRowActions(
  actions: NonNullable<AppRegistryModuleEntry['list']>['rowActions'] = [],
  snapshot: PermissionSnapshot
): ListAction[] {
  if (!actions) return [];
  
  return actions
    .map((action) => ({
      key: action.key,
      label: action.label,
      type: action.type,
      route: action.route,
      permission: action.permission,
      visibility: getPermissionOutcome(action.permission, snapshot),
      icon: action.icon,
      variant: 'secondary' as const,
      order: action.order ?? 999,
      bulk: false,
    }))
    .filter((action) => action.visibility !== PermissionOutcome.HIDDEN)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Build filters from registry
 */
function buildFilters(
  filters: NonNullable<AppRegistryModuleEntry['list']>['filters'] = [],
  snapshot: PermissionSnapshot
): ListFilter[] {
  if (!filters) return [];
  
  return filters
    .map((filter) => ({
      key: filter.key,
      label: filter.label,
      type: filter.type,
      fieldPath: filter.fieldPath,
      permission: filter.permission,
      visibility: getPermissionOutcome(filter.permission, snapshot),
      options: filter.options,
      order: filter.order ?? 999,
    }))
    .filter((filter) => filter.visibility !== PermissionOutcome.HIDDEN)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Get human-friendly name for a module key
 */
function getModuleDisplayName(moduleKey: string): string {
  const nameMap: Record<string, string> = {
    people: 'People',
    contacts: 'People',
    deals: 'Deals',
    tasks: 'Tasks',
    tickets: 'Cases',
    cases: 'Cases',
    organizations: 'Organizations',
    companies: 'Organizations',
    items: 'Items',
    products: 'Items',
    forms: 'Forms',
    events: 'Events',
    audits: 'Audits',
    responses: 'Responses',
    reports: 'Reports',
    widgets: 'Widgets',
    dashboards: 'Dashboards',
    campaigns: 'Campaigns',
  };
  
  return nameMap[moduleKey.toLowerCase()] || moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
}

/**
 * Determine empty state for module list
 */
function determineListEmptyState(
  moduleKey: string,
  appKey: string,
  hasColumns: boolean,
  hasPrimaryActions: boolean,
  snapshot: PermissionSnapshot,
  modulePermission?: string,
  options?: { isFirstModuleVisit?: boolean }
): EmptyStateDefinition {
  const displayName = getModuleDisplayName(moduleKey);
  
  // NO_ACCESS: User can see module but has no access
  if (modulePermission && !hasPermission(modulePermission, snapshot)) {
    return {
      type: EmptyStateType.NO_ACCESS,
      title: `You don't have access to ${displayName}`,
      description: `Your current role doesn't allow you to view ${displayName.toLowerCase()}. Contact your administrator if you believe this is a mistake.`,
    };
  }
  
  // NOT_CONFIGURED: Module has no columns configured
  if (!hasColumns) {
    return {
      type: EmptyStateType.NOT_CONFIGURED,
      title: `${displayName} isn't set up yet`,
      description: `This list needs to be configured before you can use it. Enable columns and settings to get started.`,
      primaryAction: {
        label: 'Set up list',
        route: `/settings/modules?module=${moduleKey}`,
        permission: 'settings.configure',
      },
    };
  }

  const createRoute = getCreateRoute(moduleKey, appKey);
  const firstTimeByModule: Record<string, { titleKey: string; descriptionKey: string; actionLabelKey: string }> = {
    people: {
      titleKey: 'onboarding.firstTimePeopleTitle',
      descriptionKey: 'onboarding.firstTimePeopleDescription',
      actionLabelKey: 'onboarding.firstTimePeopleAction',
    },
    deals: {
      titleKey: 'onboarding.firstTimeDealsTitle',
      descriptionKey: 'onboarding.firstTimeDealsDescription',
      actionLabelKey: 'onboarding.firstTimeDealsAction',
    },
    tasks: {
      titleKey: 'onboarding.firstTimeTasksTitle',
      descriptionKey: 'onboarding.firstTimeTasksDescription',
      actionLabelKey: 'onboarding.firstTimeTasksAction',
    },
    cases: {
      titleKey: 'onboarding.firstTimeCasesTitle',
      descriptionKey: 'onboarding.firstTimeCasesDescription',
      actionLabelKey: 'onboarding.firstTimeCasesAction',
    },
    organizations: {
      titleKey: 'onboarding.firstTimeOrganizationsTitle',
      descriptionKey: 'onboarding.firstTimeOrganizationsDescription',
      actionLabelKey: 'onboarding.firstTimeOrganizationsAction',
    },
    documents: {
      titleKey: 'onboarding.firstTimeDocumentsTitle',
      descriptionKey: 'onboarding.firstTimeDocumentsDescription',
      actionLabelKey: 'onboarding.firstTimeDocumentsAction',
    },
    reports: {
      titleKey: 'onboarding.firstTimeReportsTitle',
      descriptionKey: 'onboarding.firstTimeReportsDescription',
      actionLabelKey: 'onboarding.firstTimeReportsAction',
    },
  };

  if (options?.isFirstModuleVisit && firstTimeByModule[moduleKey]) {
    const copy = firstTimeByModule[moduleKey];
    return {
      type: EmptyStateType.FIRST_TIME,
      title: '',
      description: '',
      titleKey: copy.titleKey,
      descriptionKey: copy.descriptionKey,
      primaryAction: hasPrimaryActions
        ? {
            label: '',
            labelKey: copy.actionLabelKey,
            route: createRoute,
          }
        : undefined,
    };
  }
  
  // NO_DATA: Module configured but no data
  // Distinguish between first-run (reassuring) and operational (action-oriented)
  const createActionLabel = moduleKey === 'people' ? 'Add your first person' :
                           moduleKey === 'deals' ? 'Create your first deal' :
                           moduleKey === 'tasks' ? 'Create a task' :
                           moduleKey === 'tickets' ? 'Create a ticket' :
                           moduleKey === 'organizations' ? 'Add an organization' :
                           moduleKey === 'items' ? 'Add an item' :
                           moduleKey === 'forms' ? 'Create a form' :
                           `Create ${displayName.toLowerCase()}`;
  
  return {
    type: EmptyStateType.NO_DATA,
    title: `No ${displayName.toLowerCase()} yet`,
    description: hasPrimaryActions
      ? `${displayName} will appear here as you add them. Get started by creating your first one.`
      : `${displayName} will appear here when they're added to the system.`,
    primaryAction: hasPrimaryActions
      ? {
          label: createActionLabel,
          route: getCreateRoute(moduleKey, appKey),
        }
      : undefined,
  };
}

/**
 * Build complete module list definition from registry and permissions
 * 
 * @param moduleKey - The module key (e.g., 'contacts', 'deals', 'tickets')
 * @param appKey - The application key (e.g., 'SALES', 'HELPDESK')
 * @param appRegistry - The app registry containing all apps and their modules
 * @param snapshot - Permission snapshot (use createPermissionSnapshot to create)
 * @returns Complete module list definition
 */
export function buildModuleListFromRegistry(
  moduleKey: string,
  appKey: string,
  appRegistry: AppRegistry,
  snapshot: PermissionSnapshot,
  options?: { isFirstModuleVisit?: boolean }
): ModuleListDefinition | null {
  // Find app in registry
  const app = appRegistry[appKey];
  
  if (!app) {
    console.warn(`App ${appKey} not found in registry`);
    return null;
  }
  
  // Find module in app
  const module = app.modules?.find((m) => m.moduleKey === moduleKey);

  if (!module && !hasModuleListConfig(moduleKey)) {
    console.warn(`Module ${moduleKey} not found in app ${appKey}`);
    return null;
  }

  const resolvedModule = module ?? {
    moduleKey,
    label: getModuleDisplayName(moduleKey),
    permission: `${resolveListPermissionModule(moduleKey)}.view`,
  };
  
  // Use memoization for performance
  return memoizeBuilder(
    `buildModuleListFromRegistry:${options?.isFirstModuleVisit === true ? 'first-visit' : 'returning'}`,
    appRegistry,
    snapshot,
    appKey,
    moduleKey,
    () => {
      // Get list configuration from module
      // Type assertion needed because AppRegistry module type doesn't include list
      const moduleWithList = resolvedModule as AppRegistryModuleEntry;
      const listConfig = moduleWithList.list;
      
      if (!listConfig) {
        // Modules in moduleListRegistry use ModuleDefinition fields + Customize View (see ModuleList).
        if (hasModuleListConfig(moduleKey)) {
          const fallbackActions = getFallbackActions(moduleKey, appKey);
          const displayName = getModuleDisplayName(moduleKey);
          const createActionLabel =
            moduleKey === 'people'
              ? 'Add your first person'
              : moduleKey === 'deals'
                ? 'Create your first deal'
                : moduleKey === 'tasks'
                  ? 'Create a task'
                  : moduleKey === 'tickets'
                    ? 'Create a ticket'
                    : moduleKey === 'organizations'
                      ? 'Add an organization'
                      : moduleKey === 'items'
                        ? 'Add an item'
                        : moduleKey === 'forms'
                          ? 'Create a form'
                          : moduleKey === 'campaigns'
                            ? 'Create your first campaign'
                          : moduleKey === 'reports'
                            ? 'Create your first report'
                          : `Create ${displayName.toLowerCase()}`;

          const emptyState: EmptyStateDefinition = moduleKey === 'campaigns'
            ? {
                type: EmptyStateType.NO_DATA,
                title: '',
                description: '',
                titleKey: 'marketing.campaignsEmptyTitle',
                descriptionKey: 'marketing.campaignsEmptyMessage',
                primaryAction: fallbackActions.find((a) => a.type === 'create')
                  ? {
                      label: '',
                      labelKey: 'marketing.campaignsNew',
                      route: getCreateRoute(moduleKey, appKey)
                    }
                  : undefined
              }
            : moduleKey === 'reports'
              ? {
                  type: options?.isFirstModuleVisit
                    ? EmptyStateType.FIRST_TIME
                    : EmptyStateType.NO_DATA,
                  title: '',
                  description: '',
                  titleKey: options?.isFirstModuleVisit
                    ? 'onboarding.firstTimeReportsTitle'
                    : 'analytics.emptyNoDataTitle',
                  descriptionKey: options?.isFirstModuleVisit
                    ? 'onboarding.firstTimeReportsDescription'
                    : 'analytics.emptyNoDataDescription',
                  primaryAction: fallbackActions.find((a) => a.type === 'create')
                    ? {
                        label: '',
                        labelKey: options?.isFirstModuleVisit
                          ? 'onboarding.firstTimeReportsAction'
                          : 'analytics.newReport',
                        route: getCreateRoute(moduleKey, appKey)
                      }
                    : undefined
                }
            : moduleKey === 'widgets'
              ? {
                  type: options?.isFirstModuleVisit
                    ? EmptyStateType.FIRST_TIME
                    : EmptyStateType.NO_DATA,
                  title: '',
                  description: '',
                  titleKey: options?.isFirstModuleVisit
                    ? 'analytics.widgetsFirstTimeTitle'
                    : 'analytics.widgetsEmptyTitle',
                  descriptionKey: options?.isFirstModuleVisit
                    ? 'analytics.widgetsFirstTimeDescription'
                    : 'analytics.widgetsEmptyDescription',
                  primaryAction: fallbackActions.find((a) => a.type === 'create')
                    ? {
                        label: '',
                        labelKey: options?.isFirstModuleVisit
                          ? 'analytics.widgetsFirstTimeAction'
                          : 'analytics.newWidget',
                        route: getCreateRoute(moduleKey, appKey)
                      }
                    : undefined
                }
            : moduleKey === 'dashboards'
              ? {
                  type: options?.isFirstModuleVisit
                    ? EmptyStateType.FIRST_TIME
                    : EmptyStateType.NO_DATA,
                  title: '',
                  description: '',
                  titleKey: options?.isFirstModuleVisit
                    ? 'analytics.dashboardsFirstTimeTitle'
                    : 'analytics.dashboardsEmptyTitle',
                  descriptionKey: options?.isFirstModuleVisit
                    ? 'analytics.dashboardsFirstTimeDescription'
                    : 'analytics.dashboardsEmptyDescription',
                  primaryAction: fallbackActions.find((a) => a.type === 'create')
                    ? {
                        label: '',
                        labelKey: options?.isFirstModuleVisit
                          ? 'analytics.dashboardsFirstTimeAction'
                          : 'analytics.newDashboard',
                        route: getCreateRoute(moduleKey, appKey)
                      }
                    : undefined
                }
            : {
                type: EmptyStateType.NO_DATA,
                title: `No ${displayName.toLowerCase()} yet`,
                description: `${displayName} will appear here as you add them. Get started by creating your first one.`,
                primaryAction: fallbackActions.find((a) => a.type === 'create')
                  ? {
                      label: createActionLabel,
                      route: getCreateRoute(moduleKey, appKey)
                    }
                  : undefined
              };

          return {
            version: 1,
            moduleKey,
            appKey,
            title: resolvedModule.label,
            layout: 'TABLE',
            columns: [],
            primaryActions: buildPrimaryActions(fallbackActions, snapshot, moduleKey, appKey),
            emptyState,
            defaultSort: ['campaigns', 'reports', 'widgets', 'dashboards'].includes(moduleKey)
              ? { column: 'updatedAt', order: 'desc' as const }
              : undefined
          };
        }

        // Legacy modules without registry config: minimal fallback columns
        const fallbackColumns = getFallbackColumns(moduleKey);
        const fallbackActions = getFallbackActions(moduleKey, appKey);
        
        const displayName = getModuleDisplayName(moduleKey);
        const createActionLabel = moduleKey === 'people' ? 'Add your first person' :
                                 moduleKey === 'deals' ? 'Create your first deal' :
                                 moduleKey === 'tasks' ? 'Create a task' :
                                 moduleKey === 'tickets' ? 'Create a ticket' :
                                 moduleKey === 'organizations' ? 'Add an organization' :
                                 moduleKey === 'items' ? 'Add an item' :
                                 moduleKey === 'forms' ? 'Create a form' :
                                 `Create ${displayName.toLowerCase()}`;
        
        return {
          version: 1,
          moduleKey,
          appKey,
          title: resolvedModule.label,
          layout: 'TABLE',
          columns: buildColumns(fallbackColumns, snapshot, moduleKey),
          primaryActions: buildPrimaryActions(fallbackActions, snapshot, moduleKey, appKey),
          emptyState: {
            type: EmptyStateType.NO_DATA,
            title: `No ${displayName.toLowerCase()} yet`,
            description: `${displayName} will appear here as you add them. Get started by creating your first one.`,
            primaryAction: fallbackActions.find(a => a.type === 'create') ? {
              label: createActionLabel,
              route: getCreateRoute(moduleKey, appKey),
            } : undefined,
          },
        };
      }
      
      // Build list definition
      const columns = buildColumns(listConfig.columns, snapshot, moduleKey);
      const primaryActions = buildPrimaryActions(listConfig.primaryActions, snapshot, moduleKey, appKey);
      const bulkActions = buildBulkActions(listConfig.bulkActions, snapshot);
      const rowActions = buildRowActions(listConfig.rowActions, snapshot);
      const filters = buildFilters(listConfig.filters, snapshot);
      
      // Determine empty state
      const emptyState = determineListEmptyState(
        moduleKey,
        appKey,
        columns.length > 0,
        primaryActions.length > 0,
        snapshot,
        resolvedModule.permission,
        options
      );
      
      const listDefinition: ModuleListDefinition = {
        version: 1,
        moduleKey,
        appKey,
        title: resolvedModule.label,
        description: undefined, // Can be added to registry if needed
        layout: listConfig.layout || 'TABLE',
        columns,
        primaryActions,
        bulkActions: bulkActions.length > 0 ? bulkActions : undefined,
        rowActions: rowActions.length > 0 ? rowActions : undefined,
        filters: filters.length > 0 ? filters : undefined,
        emptyState,
        defaultSort: listConfig.defaultSort,
        pagination: listConfig.pagination || {
          pageSize: 25,
          pageSizeOptions: [10, 25, 50, 100],
        },
      };
      
      return listDefinition;
    }
  );
}


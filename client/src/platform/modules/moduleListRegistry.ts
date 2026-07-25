/**
 * Module List Configuration Registry
 * 
 * Centralized configuration for all module list views.
 * This registry provides:
 * - Default column configurations
 * - Statistics computation functions
 * - System saved views
 * - API endpoint mappings
 * - Filter normalization logic
 * 
 * All module-specific logic is extracted here to make the list view components
 * fully reusable across all modules.
 */

import { getItemFieldMetadata } from '@/platform/fields/itemFieldModel';
import { dateFilterValueToParams } from '@/utils/dateFilterOptions';
import { applyInventoryCapabilityToModuleListConfig } from '@/utils/inventoryCapability';

export interface DefaultColumnConfig {
  /** Column keys in display order */
  defaultVisibleColumns: string[];
  /** Fields to exclude from default view (but available via Customize Columns) */
  excludedFromDefault?: string[];
  /** Field key that should be locked (frozen) - typically 'name' */
  lockedColumn?: string;
}

/** Passed from ModuleList after fetch — use totalRecords for headline counts when the list is paged */
export interface ModuleListStatisticsContext {
  totalRecords?: number;
}

export interface StatisticsConfig {
  /** Statistics to display */
  stats: Array<{
    name: string;
    key: string;
    formatter?: 'number' | 'currency' | 'percentage';
  }>;
  /**
   * `view` (default): refresh cards only for saved-view scope.
   * `query`: always recompute from the current list query (search/filters/views).
   */
  scope?: 'view' | 'query';
  /** Optional dynamic card set from active view + filters */
  resolveStats?: (
    filters: Record<string, any>,
    activeViewId?: string | null
  ) => StatisticsConfig['stats'];
  /** Function to compute statistics from currently loaded rows; pass totalRecords for full-query totals */
  computeFunction: (
    data: any[],
    currentUserId?: string,
    context?: ModuleListStatisticsContext
  ) => Record<string, number>;
}

export type PeopleListAppContext = 'ALL' | 'SALES' | 'HELPDESK';

export interface SystemView {
  id: string;
  name: string;
  filters: Record<string, any>;
  isDefault?: boolean;
  /** People list only: app scope for columns, field defs, and participation filtering. */
  peopleContext?: PeopleListAppContext;
}

export interface ModuleListConfig {
  /** Default column configuration */
  defaultColumns: DefaultColumnConfig;
  /** Extra list columns shown when appointment-only filter is active (events module) */
  appointmentListColumns?: string[];
  /** Statistics configuration */
  statistics?: StatisticsConfig;
  /** System saved views */
  systemViews?: SystemView[];
  /** API endpoint (relative to /api) */
  apiEndpoint: string;
  /** Function to normalize filters before sending to API */
  normalizeFilters?: (filters: Record<string, any>, currentUserId?: string) => Record<string, any>;
  /** Function to normalize filters from saved view before applying */
  normalizeViewFilters?: (filters: Record<string, any>, currentUserId?: string) => Record<string, any>;
}

/**
 * Build default columns for a module
 */
export function buildDefaultColumns(
  allAvailableColumns: any[],
  config: DefaultColumnConfig
): any[] {
  const { defaultVisibleColumns, excludedFromDefault = [], lockedColumn } = config;
  const processedColumns = [];
  const processedKeys = new Set();
  const excludedSet = new Set(excludedFromDefault);

  // Add locked column first if specified
  if (lockedColumn) {
    const lockedCol = allAvailableColumns.find(col => col.key === lockedColumn);
    if (lockedCol) {
      processedColumns.push({ ...lockedCol, visible: true, locked: true });
      processedKeys.add(lockedColumn);
    }
  }

  // Add other default visible columns in the specified order
  defaultVisibleColumns.forEach(key => {
    if (!processedKeys.has(key)) {
      const col = allAvailableColumns.find(c => c.key === key);
      if (col) {
        processedColumns.push({ ...col, visible: true });
        processedKeys.add(key);
      }
    }
  });

  // Add all other eligible columns as hidden by default
  allAvailableColumns.forEach(col => {
    if (!processedKeys.has(col.key)) {
      // Skip excluded fields
      if (excludedSet.has(col.key)) {
        processedColumns.push({ ...col, visible: false, locked: false });
        processedKeys.add(col.key);
        return;
      }

      // Skip fields that match exclusion patterns
      const isExcluded = excludedFromDefault.some(excluded => {
        if (excluded.includes('*')) {
          const pattern = excluded.replace(/\*/g, '.*');
          return new RegExp(pattern).test(col.key);
        }
        return col.key.includes(excluded);
      });

      if (isExcluded) {
        processedColumns.push({ ...col, visible: false, locked: false });
        processedKeys.add(col.key);
        return;
      }

      // Skip system/internal fields
      if (col.key.startsWith('_') || col.key === 'id' || col.key === 'slug') {
        processedColumns.push({ ...col, visible: false, locked: false });
        processedKeys.add(col.key);
        return;
      }

      processedColumns.push({ ...col, visible: false, locked: false });
      processedKeys.add(col.key);
    }
  });

  return processedColumns;
}

/**
 * Compute People statistics
 */
function computePeopleStatistics(
  data: any[],
  currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const total = context?.totalRecords ?? data.length;
  const stats = {
    totalPeople: total,
    myPeople: total,
    assignedToMe: 0,
    unassigned: 0,
    withOrganization: 0,
    withoutOrganization: 0
  };

  data.forEach(person => {
    const assignedToId = typeof person.assignedTo === 'object' && person.assignedTo?._id
      ? person.assignedTo._id
      : person.assignedTo;
    if (assignedToId === currentUserId) {
      stats.assignedToMe++;
    }

    if (!assignedToId || assignedToId === null) {
      stats.unassigned++;
    }

    if (person.organization) {
      stats.withOrganization++;
    } else {
      stats.withoutOrganization++;
    }
  });

  if (context?.totalRecords == null) {
    stats.myPeople = stats.assignedToMe;
  }

  return stats;
}

/**
 * Compute Marketing campaigns statistics
 */
function computeCampaignsStatistics(
  data: any[],
  _currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const stats = {
    totalCampaigns: context?.totalRecords ?? data.length,
    draft: 0,
    scheduled: 0,
    running: 0,
    completed: 0
  };

  data.forEach((row) => {
    const status = String(row?.status || '');
    if (status === 'draft') stats.draft += 1;
    else if (status === 'scheduled') stats.scheduled += 1;
    else if (status === 'running') stats.running += 1;
    else if (status === 'completed') stats.completed += 1;
  });

  return stats;
}

/**
 * Compute Analytics reports statistics
 */
function computeReportsStatistics(
  data: any[],
  _currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const stats = {
    totalReports: context?.totalRecords ?? data.length,
    draft: 0,
    published: 0,
    archived: 0,
  };

  data.forEach((row) => {
    const status = String(row?.status || '');
    if (status === 'draft') stats.draft += 1;
    else if (status === 'published') stats.published += 1;
    else if (status === 'archived') stats.archived += 1;
  });

  return stats;
}

/**
 * Compute Analytics widgets statistics
 */
function computeWidgetsStatistics(
  data: any[],
  _currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const stats = {
    totalWidgets: context?.totalRecords ?? data.length,
    draft: 0,
    published: 0,
    archived: 0,
  };

  data.forEach((row) => {
    const status = String(row?.status || '');
    if (status === 'draft') stats.draft += 1;
    else if (status === 'published') stats.published += 1;
    else if (status === 'archived') stats.archived += 1;
  });

  return stats;
}

/**
 * Compute Analytics dashboards statistics
 */
function computeDashboardsStatistics(
  data: any[],
  _currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const stats = {
    totalDashboards: context?.totalRecords ?? data.length,
    draft: 0,
    published: 0,
    archived: 0,
  };

  data.forEach((row) => {
    const status = String(row?.status || '');
    if (status === 'draft') stats.draft += 1;
    else if (status === 'published') stats.published += 1;
    else if (status === 'archived') stats.archived += 1;
  });

  return stats;
}

/**
 * Compute Organizations statistics
 */
function computeOrganizationsStatistics(
  data: any[],
  currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const total = context?.totalRecords ?? data.length;
  const stats = {
    totalOrganizations: total,
    myOrganizations: total,
    assignedToMe: 0,
    unassigned: 0,
    activeOrganizations: 0,
    trialOrganizations: 0
  };

  data.forEach(org => {
    const assignedToId = typeof org.assignedTo === 'object' && org.assignedTo?._id
      ? org.assignedTo._id
      : org.assignedTo;
    if (assignedToId === currentUserId) {
      stats.assignedToMe++;
    }

    if (!assignedToId || assignedToId === null) {
      stats.unassigned++;
    }

    if (org.isActive === true) {
      stats.activeOrganizations++;
    }

    const tier = org.subscription?.tier || org.subscription?.status;
    if (tier === 'trial') {
      stats.trialOrganizations++;
    }
  });

  if (context?.totalRecords == null) {
    stats.myOrganizations = stats.assignedToMe;
  }

  return stats;
}

/**
 * Generic filter normalizer using schema-driven approach
 * Uses filterType from field definitions to normalize filters
 */
function createGenericFilterNormalizer(_moduleKey: string) {
  return (filters: Record<string, any>, currentUserId?: string): Record<string, any> => {
    // Try to get filter configs from field definitions
    // For now, use known filter types based on common patterns
    const filterConfigs: Array<{ key: string; filterType: string }> = [];
    
    // Common filter patterns across modules
    if (filters.assignedTo !== undefined) {
      filterConfigs.push({ key: 'assignedTo', filterType: 'user' });
    }
    if (filters.do_not_contact !== undefined || filters.doNotContact !== undefined) {
      filterConfigs.push({ 
        key: filters.do_not_contact !== undefined ? 'do_not_contact' : 'doNotContact', 
        filterType: 'boolean' 
      });
    }
    
    // Use generic normalizer
    try {
      const { normalizeFiltersForAPI } = require('@/platform/filters/filterNormalizer');
      return normalizeFiltersForAPI(filters, filterConfigs, currentUserId);
    } catch {
      // Fallback to basic normalization
      const normalized = { ...filters };
      if ('assignedTo' in normalized) {
        if (normalized.assignedTo === 'me' && currentUserId) {
          normalized.assignedTo = currentUserId;
        } else if (normalized.assignedTo === 'unassigned') {
          normalized.assignedTo = 'null';
        }
      }
      return normalized;
    }
  };
}

/**
 * Generic view filter normalizer
 */
function createGenericViewFilterNormalizer(_moduleKey: string) {
  return (filters: Record<string, any>, currentUserId?: string): Record<string, any> => {
    const filterConfigs: Array<{ key: string; filterType: string }> = [];
    
    if (filters.assignedTo !== undefined) {
      filterConfigs.push({ key: 'assignedTo', filterType: 'user' });
    }
    if (filters.do_not_contact !== undefined || filters.doNotContact !== undefined) {
      filterConfigs.push({ 
        key: filters.do_not_contact !== undefined ? 'do_not_contact' : 'doNotContact', 
        filterType: 'boolean' 
      });
    }
    
    try {
      const { normalizeFiltersForUI } = require('@/platform/filters/filterNormalizer');
      return normalizeFiltersForUI(filters, filterConfigs, currentUserId);
    } catch {
      // Fallback to basic normalization
      const normalized = { ...filters };
      if ('assignedTo' in normalized) {
        if (normalized.assignedTo === currentUserId) {
          normalized.assignedTo = 'me';
        } else if (normalized.assignedTo === null) {
          normalized.assignedTo = 'unassigned';
        }
      }
      return normalized;
    }
  };
}

/**
 * Normalize People filters (backward compatibility)
 */
function normalizePeopleFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = createGenericFilterNormalizer('people')(filters, currentUserId);
  const out = { ...normalized };
  // Saved views / legacy UI may still store `type`; API accepts `sales_type` only
  if (out.type !== undefined && out.sales_type === undefined) {
    out.sales_type = out.type;
  }
  delete out.type;
  return out;
}

/**
 * Normalize Organizations filters (backward compatibility)
 */
function normalizeOrganizationsFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  return createGenericFilterNormalizer('organizations')(filters, currentUserId);
}

/**
 * Normalize People view filters (backward compatibility)
 */
function normalizePeopleViewFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  return createGenericViewFilterNormalizer('people')(filters, currentUserId);
}

/**
 * Normalize Organizations view filters (backward compatibility)
 */
function normalizeOrganizationsViewFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  return createGenericViewFilterNormalizer('organizations')(filters, currentUserId);
}

/**
 * Generate default system views for any module
 * All modules get at least "All {ModuleName}" and "My {ModuleName}" views
 */
export function generateDefaultSystemViews(
  moduleKey: string,
  moduleLabel: string,
  currentUserId?: string
): SystemView[] {
  const views: SystemView[] = [
    {
      id: 'all',
      name: `All ${moduleLabel}`,
      filters: {},
      isDefault: true
    }
  ];

  // Add "My {ModuleName}" view if module has assignedTo field
  // This is a common pattern across modules
  if (currentUserId) {
    views.push({
      id: 'assigned-to-me',
      name: `My ${moduleLabel}`,
      filters: { assignedTo: 'me' }
    });
  }

  return views;
}

/**
 * Get system views for a module
 * Returns explicit system views from registry, or generates default ones
 */
export type ModuleListConfigOptions = {
  inventoryEnabled?: boolean;
};

export function getSystemViews(
  moduleKey: string,
  moduleLabel: string,
  currentUserId?: string,
  options?: ModuleListConfigOptions
): SystemView[] {
  const config = getModuleListConfig(moduleKey, options);
  if (config?.systemViews) {
    return config.systemViews;
  }
  
  // Generate default views for modules without explicit config
  return generateDefaultSystemViews(moduleKey, moduleLabel, currentUserId);
}

/** Resolve People list app context from a system view id (defaults to ALL). */
export function resolvePeopleListAppContext(
  moduleKey: string,
  viewId: string | null | undefined,
  options?: ModuleListConfigOptions
): PeopleListAppContext {
  if (moduleKey !== 'people' || !viewId) return 'ALL';
  const config = getModuleListConfig(moduleKey, options);
  const view = config?.systemViews?.find((v) => v.id === viewId);
  return view?.peopleContext ?? 'ALL';
}

/**
 * Normalize Tasks filters
 * Expands date filter objects (dueDate / due_date) into API params: dueDatePreset, dueDateOp, dueDateFrom, dueDateTo, dueDateDays
 */
function normalizeTasksFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };

  // Normalize assignedTo
  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === 'me' && currentUserId) {
      normalized.assignedTo = currentUserId;
    }
  }

  // Expand date filter object for dueDate / due_date into API params (or remove when no filter)
  const dateFieldKeys = ['dueDate', 'due_date'] as const;
  for (const fieldKey of dateFieldKeys) {
    const value = normalized[fieldKey];
    if (value == null || value === '') {
      delete normalized[fieldKey];
    } else if (typeof value === 'object' && !Array.isArray(value) && (value.preset != null || value.op != null)) {
      const params = dateFilterValueToParams(fieldKey, value);
      delete normalized[fieldKey];
      Object.assign(normalized, params);
    }
  }

  return normalized;
}

/**
 * Normalize Tasks view filters (from saved views)
 */
function normalizeTasksViewFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };

  // Only normalize if assignedTo is actually present
  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === currentUserId) {
      normalized.assignedTo = 'me';
    }
  }

  return normalized;
}

/**
 * Task summary cards — All Tasks vs My Tasks (no redundant Assigned to Me).
 */
function resolveTasksStatsConfig(
  filters: Record<string, any> = {},
  activeViewId?: string | null
): StatisticsConfig['stats'] {
  const isMyTasks =
    activeViewId === 'assigned-to-me' ||
    filters?.assignedTo === 'me';

  return [
    isMyTasks
      ? { name: 'My Tasks', key: 'myTasks', formatter: 'number' as const }
      : { name: 'Total Tasks', key: 'totalTasks', formatter: 'number' as const },
    { name: 'Open', key: 'open', formatter: 'number' as const },
    { name: 'Due Today', key: 'dueToday', formatter: 'number' as const },
    { name: 'Overdue', key: 'overdue', formatter: 'number' as const }
  ];
}

function isMyAssigneeScope(
  filters: Record<string, any> = {},
  activeViewId?: string | null,
  myViewIds: string[] = []
): boolean {
  return myViewIds.includes(String(activeViewId || '')) || filters?.assignedTo === 'me';
}

/** People: drop Assigned to Me; hide Unassigned on My People. */
function resolvePeopleStatsConfig(
  filters: Record<string, any> = {},
  activeViewId?: string | null
): StatisticsConfig['stats'] {
  const isMy = isMyAssigneeScope(filters, activeViewId, ['assigned-to-me']);
  return [
    isMy
      ? { name: 'My People', key: 'myPeople', formatter: 'number' as const }
      : { name: 'Total People', key: 'totalPeople', formatter: 'number' as const },
    ...(isMy
      ? []
      : [{ name: 'Unassigned', key: 'unassigned', formatter: 'number' as const }]),
    { name: 'With Organization', key: 'withOrganization', formatter: 'number' as const },
    { name: 'Without Organization', key: 'withoutOrganization', formatter: 'number' as const }
  ];
}

/** Organizations: drop Assigned to Me; hide Unassigned on My Organizations. */
function resolveOrganizationsStatsConfig(
  filters: Record<string, any> = {},
  activeViewId?: string | null
): StatisticsConfig['stats'] {
  const isMy = isMyAssigneeScope(filters, activeViewId, ['assigned-to-me']);
  return [
    isMy
      ? { name: 'My Organizations', key: 'myOrganizations', formatter: 'number' as const }
      : { name: 'Total Organizations', key: 'totalOrganizations', formatter: 'number' as const },
    ...(isMy
      ? []
      : [{ name: 'Unassigned', key: 'unassigned', formatter: 'number' as const }]),
    { name: 'Active', key: 'activeOrganizations', formatter: 'number' as const },
    { name: 'Trial', key: 'trialOrganizations', formatter: 'number' as const }
  ];
}

/** Events: drop Past + My Events on All; My Events headline when scoped to me. */
function resolveEventsStatsConfig(
  filters: Record<string, any> = {},
  activeViewId?: string | null
): StatisticsConfig['stats'] {
  const isMy = isMyAssigneeScope(filters, activeViewId, ['my-events']);
  return [
    isMy
      ? { name: 'My Events', key: 'myEvents', formatter: 'number' as const }
      : { name: 'Total Events', key: 'totalEvents', formatter: 'number' as const },
    { name: 'Upcoming', key: 'upcoming', formatter: 'number' as const },
    { name: 'Today', key: 'today', formatter: 'number' as const },
    { name: 'This Week', key: 'thisWeek', formatter: 'number' as const }
  ];
}

/** Deals: pipeline-focused; same cards on My Deals (query-scoped). */
function resolveDealsStatsConfig(
  _filters: Record<string, any> = {},
  _activeViewId?: string | null
): StatisticsConfig['stats'] {
  return [
    { name: 'Pipeline Value', key: 'pipelineValue', formatter: 'currency' as const },
    { name: 'Open Deals', key: 'activeDeals', formatter: 'number' as const },
    { name: 'Won Value', key: 'wonValue', formatter: 'currency' as const },
    { name: 'Win Rate', key: 'winRate', formatter: 'percentage' as const }
  ];
}

/** Quotes: drop My Quotes card on All; headline My Quotes when scoped. */
function resolveQuotesStatsConfig(
  filters: Record<string, any> = {},
  activeViewId?: string | null
): StatisticsConfig['stats'] {
  const isMy = isMyAssigneeScope(filters, activeViewId, ['my-quotes']);
  return [
    isMy
      ? { name: 'My Quotes', key: 'myQuotes', formatter: 'number' as const }
      : { name: 'Total Quotes', key: 'totalQuotes', formatter: 'number' as const },
    { name: 'Open Quotes', key: 'openQuotes', formatter: 'number' as const },
    { name: 'Open Value', key: 'openValue', formatter: 'currency' as const },
    { name: 'Accepted Value', key: 'acceptedValue', formatter: 'currency' as const }
  ];
}

/** Sales orders: actionable fulfillment strip (not every status). */
function resolveSalesOrdersStatsConfig(
  filters: Record<string, any> = {},
  activeViewId?: string | null
): StatisticsConfig['stats'] {
  const isMy = isMyAssigneeScope(filters, activeViewId, ['my-orders']);
  return [
    isMy
      ? { name: 'My Orders', key: 'mySalesOrders', formatter: 'number' as const }
      : { name: 'Total Orders', key: 'totalSalesOrders', formatter: 'number' as const },
    { name: 'Open', key: 'open', formatter: 'number' as const },
    { name: 'In Fulfillment', key: 'inFulfillment', formatter: 'number' as const },
    { name: 'Completed', key: 'completed', formatter: 'number' as const }
  ];
}

/** Campaigns: drop Completed from strip. */
function resolveCampaignsStatsConfig(): StatisticsConfig['stats'] {
  return [
    { name: 'Total', key: 'totalCampaigns', formatter: 'number' as const },
    { name: 'Draft', key: 'draft', formatter: 'number' as const },
    { name: 'Scheduled', key: 'scheduled', formatter: 'number' as const },
    { name: 'Running', key: 'running', formatter: 'number' as const }
  ];
}

/** Analytics publishables: Total / Draft / Published (drop Archived). */
function resolvePublishableStatsConfig(
  totalKey: string,
  totalName: string
): StatisticsConfig['stats'] {
  return [
    { name: totalName, key: totalKey, formatter: 'number' as const },
    { name: 'Draft', key: 'draft', formatter: 'number' as const },
    { name: 'Published', key: 'published', formatter: 'number' as const }
  ];
}

/** Items: lifecycle strip (drop Product/Service type cards). */
function resolveItemsStatsConfig(): StatisticsConfig['stats'] {
  return [
    { name: 'Total Items', key: 'totalItems', formatter: 'number' as const },
    { name: 'Active', key: 'activeItems', formatter: 'number' as const },
    { name: 'Draft', key: 'draftItems', formatter: 'number' as const },
    { name: 'Discontinued', key: 'discontinuedItems', formatter: 'number' as const }
  ];
}

/** Invoices: actionable status strip. */
function resolveInvoicesStatsConfig(
  filters: Record<string, any> = {},
  activeViewId?: string | null
): StatisticsConfig['stats'] {
  const isMy = isMyAssigneeScope(filters, activeViewId, ['my-invoices']);
  return [
    isMy
      ? { name: 'My Invoices', key: 'myInvoices', formatter: 'number' as const }
      : { name: 'Total Invoices', key: 'totalInvoices', formatter: 'number' as const },
    { name: 'Draft', key: 'draft', formatter: 'number' as const },
    { name: 'Pending Approval', key: 'pendingApproval', formatter: 'number' as const },
    { name: 'Posted', key: 'posted', formatter: 'number' as const }
  ];
}

function computeTasksStatistics(
  data: any[],
  _currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const stats = {
    totalTasks: context?.totalRecords ?? data.length,
    myTasks: context?.totalRecords ?? data.length,
    open: 0,
    dueToday: 0,
    overdue: 0
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  endOfToday.setMilliseconds(-1);

  data.forEach(task => {
    const status = task.status;
    const isOpen = status !== 'completed' && status !== 'cancelled';
    if (isOpen) {
      stats.open++;
    }

    if (!task.dueDate || !isOpen) return;
    const due = new Date(task.dueDate);
    if (due >= startOfToday && due <= endOfToday) {
      stats.dueToday++;
    } else if (due < startOfToday) {
      stats.overdue++;
    }
  });

  return stats;
}

/**
 * Compute Events statistics
 */
function computeEventsStatistics(
  data: any[],
  currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const stats = {
    totalEvents: context?.totalRecords ?? data.length,
    upcoming: 0,
    past: 0,
    myEvents: 0,
    today: 0,
    thisWeek: 0
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  data.forEach(event => {
    const startDate = event.startDateTime ? new Date(event.startDateTime) : null;
    
    // Upcoming vs Past
    if (startDate) {
      if (startDate >= now) {
        stats.upcoming++;
      } else {
        stats.past++;
      }
    }

    // My Events
    const assignedTo = typeof event.assignedTo === 'object' && event.assignedTo?._id
      ? event.assignedTo._id
      : event.assignedTo;
    if (currentUserId && String(assignedTo) === String(currentUserId)) {
      stats.myEvents++;
    }

    // Today
    if (startDate) {
      const eventDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      if (eventDateOnly.getTime() === today.getTime()) {
        stats.today++;
      }
    }

    // This Week
    if (startDate && startDate >= startOfWeek && startDate <= endOfWeek) {
      stats.thisWeek++;
    }
  });

  return stats;
}

/**
 * Normalize Events filters
 */
function normalizeEventsFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };

  // Normalize assignedTo (similar to assignedTo)
  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === 'me' && currentUserId) {
      normalized.assignedTo = currentUserId;
    } else if (normalized.assignedTo === 'unassigned') {
      normalized.assignedTo = null;
    }
  }

  // Normalize date range filters
  if ('startDateTime' in normalized && normalized.startDateTime === '') {
    delete normalized.startDateTime;
  }
  if ('endDateTime' in normalized && normalized.endDateTime === '') {
    delete normalized.endDateTime;
  }

  // Normalize eventType filter
  if ('eventType' in normalized && normalized.eventType === '') {
    delete normalized.eventType;
  }

  // Normalize status filter
  if ('status' in normalized && normalized.status === '') {
    delete normalized.status;
  }

  return normalized;
}

/**
 * Normalize Events view filters (from saved views)
 */
function normalizeEventsViewFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };

  // Normalize assignedTo for UI display
  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === currentUserId) {
      normalized.assignedTo = 'me';
    } else if (normalized.assignedTo === null) {
      normalized.assignedTo = 'unassigned';
    }
  }

  // Handle date filters - ensure they're in the right format for API
  // The API expects startDateTime and endDateTime as ISO strings
  // startDateTime becomes $gte, endDateTime becomes $lte on startDateTime field
  if ('startDateTime' in normalized && normalized.startDateTime) {
    // Already in correct format (ISO string)
  }
  if ('endDateTime' in normalized && normalized.endDateTime) {
    // Already in correct format (ISO string)
  }

  return normalized;
}

/**
 * Compute Deals statistics (from list data; server may also return stats)
 */
function computeDealsStatistics(
  data: any[],
  currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const stats = {
    pipelineValue: 0,
    activeDeals: 0,
    wonValue: 0,
    winRate: 0,
    totalDeals: context?.totalRecords ?? data.length,
    myDeals: 0
  };

  let wonCount = 0;
  let lostCount = 0;

  data.forEach(deal => {
    const assignedTo = typeof deal.assignedTo === 'object' && deal.assignedTo?._id ? deal.assignedTo._id : deal.assignedTo;
    if (assignedTo === currentUserId) {
      stats.myDeals++;
    }
    if (deal.status !== 'Won' && deal.status !== 'Lost') {
      stats.activeDeals++;
      stats.pipelineValue += Number(deal.amount) || 0;
    } else if (deal.status === 'Won') {
      wonCount++;
      stats.wonValue += Number(deal.amount) || 0;
    } else if (deal.status === 'Lost') {
      lostCount++;
    }
  });

  const totalClosed = wonCount + lostCount;
  stats.winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;
  return stats;
}

/**
 * Normalize Deals filters
 */
function normalizeDealsFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };

  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === 'me' && currentUserId) {
      normalized.assignedTo = currentUserId;
    } else if (normalized.assignedTo === 'unassigned') {
      normalized.assignedTo = null;
    }
  }

  ['stage', 'status', 'priority'].forEach(key => {
    if (key in normalized && normalized[key] === '') {
      delete normalized[key];
    }
  });

  return normalized;
}

/**
 * Normalize Deals view filters (from saved views)
 */
function normalizeDealsViewFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };

  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === currentUserId) {
      normalized.assignedTo = 'me';
    } else if (normalized.assignedTo === null) {
      normalized.assignedTo = 'unassigned';
    }
  }

  return normalized;
}

const CLOSED_QUOTE_STATUSES = new Set(['Converted', 'Cancelled', 'Rejected', 'Expired']);
const ACCEPTED_QUOTE_STATUSES = new Set(['Accepted', 'Partially Accepted']);

/**
 * Compute Quotes statistics (from list data; uses totalRecords for headline count when paged)
 */
function computeQuotesStatistics(
  data: any[],
  currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const total = context?.totalRecords ?? data.length;
  const stats = {
    totalQuotes: total,
    myQuotes: total,
    openValue: 0,
    openQuotes: 0,
    acceptedValue: 0,
  };

  let myQuotesFromRows = 0;
  data.forEach((quote) => {
    const assignedTo =
      typeof quote.assignedTo === 'object' && quote.assignedTo?._id ? quote.assignedTo._id : quote.assignedTo;
    if (assignedTo === currentUserId) {
      myQuotesFromRows++;
    }

    const status = quote.status;
    const amount = Number(quote.grandTotal) || 0;

    if (!CLOSED_QUOTE_STATUSES.has(status)) {
      stats.openQuotes++;
      stats.openValue += amount;
    }

    if (ACCEPTED_QUOTE_STATUSES.has(status)) {
      stats.acceptedValue += amount;
    }
  });

  if (context?.totalRecords == null) {
    stats.myQuotes = myQuotesFromRows;
  }

  return stats;
}

/**
 * Normalize Quotes filters
 */
function normalizeCampaignsFilters(filters: Record<string, any>): Record<string, any> {
  const normalized = { ...filters };
  if ('status' in normalized && (normalized.status === '' || normalized.status == null)) {
    delete normalized.status;
  }
  return normalized;
}

function normalizeReportsFilters(filters: Record<string, any>): Record<string, any> {
  const normalized = { ...filters };

  if (normalized.mine === true || normalized.mine === 'true') {
    normalized.mine = 'true';
  } else {
    delete normalized.mine;
  }

  if (normalized.shared === true || normalized.shared === 'true') {
    normalized.shared = 'true';
  } else {
    delete normalized.shared;
  }

  if (normalized.scheduled === true || normalized.scheduled === 'true') {
    normalized.scheduled = 'true';
  } else {
    delete normalized.scheduled;
  }

  if ('status' in normalized && (normalized.status === '' || normalized.status == null)) {
    delete normalized.status;
  }
  if ('type' in normalized && (normalized.type === '' || normalized.type == null)) {
    delete normalized.type;
  }
  if ('primaryModule' in normalized && (normalized.primaryModule === '' || normalized.primaryModule == null)) {
    delete normalized.primaryModule;
  }
  if ('folderId' in normalized && (normalized.folderId === '' || normalized.folderId == null)) {
    delete normalized.folderId;
  }

  return normalized;
}

function normalizeWidgetsFilters(filters: Record<string, any>): Record<string, any> {
  const normalized = { ...filters };

  if (normalized.mine === true || normalized.mine === 'true') {
    normalized.mine = 'true';
  } else {
    delete normalized.mine;
  }

  if ('status' in normalized && (normalized.status === '' || normalized.status == null)) {
    delete normalized.status;
  }
  if ('chartType' in normalized && (normalized.chartType === '' || normalized.chartType == null)) {
    delete normalized.chartType;
  }

  return normalized;
}

function normalizeDashboardsFilters(filters: Record<string, any>): Record<string, any> {
  const normalized = { ...filters };

  if (normalized.mine === true || normalized.mine === 'true') {
    normalized.mine = 'true';
  } else {
    delete normalized.mine;
  }

  if ('status' in normalized && (normalized.status === '' || normalized.status == null)) {
    delete normalized.status;
  }
  if ('category' in normalized && (normalized.category === '' || normalized.category == null)) {
    delete normalized.category;
  }

  return normalized;
}

function normalizeQuotesFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };

  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === 'me' && currentUserId) {
      normalized.assignedTo = currentUserId;
    } else if (normalized.assignedTo === 'unassigned') {
      normalized.assignedTo = null;
    }
  }

  if ('status' in normalized && normalized.status === '') {
    delete normalized.status;
  }

  return normalized;
}

function normalizeSalesOrdersFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };
  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === 'me' && currentUserId) {
      normalized.assignedTo = currentUserId;
    } else if (normalized.assignedTo === 'unassigned') {
      normalized.assignedTo = null;
    }
  }
  if ('status' in normalized && normalized.status === '') {
    delete normalized.status;
  }
  return normalized;
}

function normalizeSalesOrdersViewFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };
  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === currentUserId) {
      normalized.assignedTo = 'me';
    } else if (normalized.assignedTo === null) {
      normalized.assignedTo = 'unassigned';
    }
  }
  return normalized;
}

/**
 * Sales order list statistics — prefer server listStatistics; fallback from page data.
 */
function computeSalesOrdersStatistics(
  data: any[],
  _currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const stats = {
    totalSalesOrders: context?.totalRecords ?? data.length,
    mySalesOrders: context?.totalRecords ?? data.length,
    open: 0,
    draft: 0,
    confirmed: 0,
    inFulfillment: 0,
    partiallyFulfilled: 0,
    completed: 0,
    cancelled: 0
  };

  data.forEach((order: any) => {
    const status = String(order.status || '');
    if (status === 'Draft') stats.draft++;
    else if (status === 'Confirmed') stats.confirmed++;
    else if (status === 'In Fulfillment') stats.inFulfillment++;
    else if (status === 'Partially Fulfilled') stats.partiallyFulfilled++;
    else if (status === 'Fulfilled') stats.completed++;
    else if (status === 'Cancelled') stats.cancelled++;

    if (
      status === 'Draft' ||
      status === 'Confirmed' ||
      status === 'In Fulfillment' ||
      status === 'Partially Fulfilled'
    ) {
      stats.open++;
    }
  });

  return stats;
}

function normalizeInvoicesFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };
  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === 'me' && currentUserId) {
      normalized.assignedTo = currentUserId;
    } else if (normalized.assignedTo === 'unassigned') {
      normalized.assignedTo = null;
    }
  }
  if ('status' in normalized && normalized.status === '') {
    delete normalized.status;
  }
  return normalized;
}

function normalizeInvoicesViewFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };
  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === currentUserId) {
      normalized.assignedTo = 'me';
    } else if (normalized.assignedTo === null) {
      normalized.assignedTo = 'unassigned';
    }
  }
  return normalized;
}

function computeInvoicesStatistics(
  data: any[],
  _currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const total = context?.totalRecords ?? data.length;
  const stats = {
    totalInvoices: total,
    myInvoices: total,
    draft: 0,
    pendingApproval: 0,
    approved: 0,
    posted: 0,
    void: 0
  };

  data.forEach((invoice: any) => {
    const status = String(invoice.status || '');
    if (status === 'Draft') stats.draft++;
    else if (status === 'Pending Approval') stats.pendingApproval++;
    else if (status === 'Approved') stats.approved++;
    else if (status === 'Posted') stats.posted++;
    else if (status === 'Void') stats.void++;
  });

  return stats;
}

/**
 * Normalize Quotes view filters (from saved views)
 */
function normalizeQuotesViewFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };

  if ('assignedTo' in normalized) {
    if (normalized.assignedTo === currentUserId) {
      normalized.assignedTo = 'me';
    } else if (normalized.assignedTo === null) {
      normalized.assignedTo = 'unassigned';
    }
  }

  return normalized;
}

/**
 * Compute Items statistics
 */
function computeItemsStatistics(
  data: any[],
  _currentUserId?: string,
  context?: ModuleListStatisticsContext
): Record<string, number> {
  const stats = {
    totalItems: context?.totalRecords ?? data.length,
    activeItems: 0,
    draftItems: 0,
    discontinuedItems: 0,
    products: 0,
    services: 0,
  };

  data.forEach(item => {
    const lifecycle = item.lifecycle_state
      || (item.status === 'Inactive' ? 'Discontinued' : 'Active');

    if (lifecycle === 'Active') {
      stats.activeItems++;
    } else if (lifecycle === 'Draft') {
      stats.draftItems++;
    } else if (lifecycle === 'Discontinued') {
      stats.discontinuedItems++;
    }

    if (item.item_type === 'Product') {
      stats.products++;
    } else if (item.item_type === 'Service') {
      stats.services++;
    }
  });

  return stats;
}

/**
 * Normalize Items filters
 */
function normalizeItemsFilters(filters: Record<string, any>, _currentUserId?: string): Record<string, any> {
  const normalized = { ...filters };

  // Normalize lifecycle_state filter
  if ('lifecycle_state' in normalized && normalized.lifecycle_state === '') {
    delete normalized.lifecycle_state;
  }

  // Normalize status filter
  if ('status' in normalized && normalized.status === '') {
    delete normalized.status;
  }

  // Normalize item_type filter
  if ('item_type' in normalized && normalized.item_type === '') {
    delete normalized.item_type;
  }

  // Normalize category filter
  if ('category' in normalized && normalized.category === '') {
    delete normalized.category;
  }

  // Normalize boolean filters
  if ('low_stock' in normalized && normalized.low_stock === false) {
    delete normalized.low_stock;
  }
  if ('out_of_stock' in normalized && normalized.out_of_stock === false) {
    delete normalized.out_of_stock;
  }

  return normalized;
}

/**
 * Normalize Items view filters (from saved views)
 */
function normalizeItemsViewFilters(filters: Record<string, any>, currentUserId?: string): Record<string, any> {
  // Same as normalizeItemsFilters for Items
  return normalizeItemsFilters(filters, currentUserId);
}

/**
 * Module List Configuration Registry
 */
export const MODULE_LIST_REGISTRY: Record<string, ModuleListConfig> = {
  people: {
    defaultColumns: {
      defaultVisibleColumns: [
        'name',
        'sales_type',
        'derivedStatus',
        'email',
        'mobile',
        'organization',
        'source',
        'lead_score',
        'assignedTo',
        'lastActivity',
        'createdAt',
      ],
      lockedColumn: 'name',
      excludedFromDefault: []
    },
    statistics: {
      scope: 'query',
      stats: resolvePeopleStatsConfig({}, 'all'),
      resolveStats: resolvePeopleStatsConfig,
      computeFunction: computePeopleStatistics
    },
    systemViews: [
      {
        id: 'assigned-to-me',
        name: 'My People',
        filters: { assignedTo: 'me' },
        peopleContext: 'ALL',
        isDefault: true,
      },
      {
        id: 'all',
        name: 'All People',
        filters: {},
        peopleContext: 'ALL',
      },
      {
        id: 'sales',
        name: 'Sales People',
        filters: {},
        peopleContext: 'SALES',
      },
      {
        id: 'helpdesk',
        name: 'Helpdesk People',
        filters: {},
        peopleContext: 'HELPDESK',
      },
    ],
    apiEndpoint: '/people',
    normalizeFilters: normalizePeopleFilters,
    normalizeViewFilters: normalizePeopleViewFilters
  },

  organizations: {
    defaultColumns: {
      defaultVisibleColumns: [
        'name',
        'types',
        'derivedStatus',
        'industry',
        'phone',
        'website',
        'assignedTo',
        'lastActivity',
        'createdAt',
      ],
      lockedColumn: 'name',
      excludedFromDefault: [
        'subscription.status',
        'subscription.tier',
        'subscription',
        'trialStartDate',
        'trialEndDate',
        'slug',
        '_id',
        'id',
        'legacyOrganizationId'
      ]
    },
    statistics: {
      scope: 'query',
      stats: resolveOrganizationsStatsConfig({}, 'all'),
      resolveStats: resolveOrganizationsStatsConfig,
      computeFunction: computeOrganizationsStatistics
    },
    systemViews: [
      {
        id: 'all',
        name: 'All Organizations',
        filters: {},
        isDefault: true
      },
      {
        id: 'assigned-to-me',
        name: 'My Organizations',
        filters: { assignedTo: 'me' }
      },
      {
        id: 'unassigned',
        name: 'Unassigned',
        filters: { assignedTo: 'unassigned' }
      },
      {
        id: 'active',
        name: 'Active',
        filters: { isActive: true }
      },
      {
        id: 'trial',
        name: 'Trial',
        filters: { tier: 'trial' }
      }
    ],
    apiEndpoint: '/v2/organization',
    normalizeFilters: normalizeOrganizationsFilters,
    normalizeViewFilters: normalizeOrganizationsViewFilters
  },

  tasks: {
    defaultColumns: {
      // Title, Task Type, Status, Priority, Due Date, Related To, Assigned To, Created On
      defaultVisibleColumns: [
        'title',
        'taskType',
        'status',
        'priority',
        'dueDate',
        'relatedTo',
        'assignedTo',
        'createdAt',
      ],
      lockedColumn: 'title',
      excludedFromDefault: []
    },
    statistics: {
      scope: 'query',
      stats: resolveTasksStatsConfig({}, 'all'),
      resolveStats: resolveTasksStatsConfig,
      computeFunction: computeTasksStatistics
    },
    systemViews: [
      {
        id: 'all',
        name: 'All Tasks',
        filters: {},
        isDefault: true
      },
      {
        id: 'assigned-to-me',
        name: 'My Tasks',
        filters: { assignedTo: 'me' }
      }
    ],
    apiEndpoint: '/tasks',
    normalizeFilters: normalizeTasksFilters,
    normalizeViewFilters: normalizeTasksViewFilters
  },

  events: {
    defaultColumns: {
      defaultVisibleColumns: ['eventName', 'eventType', 'startDateTime', 'endDateTime', 'status', 'assignedTo'],
      lockedColumn: 'eventName',
      excludedFromDefault: [
        'appointmentBookedBy',
        'appointmentBookingSource',
        'appointmentType',
        'appointmentMeetingLink'
      ]
    },
    appointmentListColumns: [
      'appointmentBookedBy',
      'appointmentBookingSource',
      'appointmentType',
      'appointmentMeetingLink'
    ],
    statistics: {
      scope: 'query',
      stats: resolveEventsStatsConfig({}, 'all'),
      resolveStats: resolveEventsStatsConfig,
      computeFunction: computeEventsStatistics
    },
    systemViews: [
      {
        id: 'all',
        name: 'All Events',
        filters: {},
        isDefault: true
      },
      {
        id: 'upcoming',
        name: 'Upcoming Events',
        filters: { _special: 'upcoming' } // Special marker for dynamic date filtering
      },
      {
        id: 'past',
        name: 'Past Events',
        filters: { _special: 'past' } // Special marker for dynamic date filtering
      },
      {
        id: 'my-events',
        name: 'My Events',
        filters: { assignedTo: 'me' }
      },
      {
        id: 'appointments',
        name: 'Appointments',
        filters: { appointmentOnly: 'true' }
      },
      {
        id: 'upcoming-appointments',
        name: 'Upcoming Appointments',
        filters: { appointmentOnly: 'true', _special: 'upcoming' }
      }
    ],
    apiEndpoint: '/events',
    normalizeFilters: normalizeEventsFilters,
    normalizeViewFilters: normalizeEventsViewFilters
  },

  deals: {
    defaultColumns: {
      // Deal Name, Organization, Stage, Amount, Expected Close Date, Probability, Assigned To, Last Activity, Created On
      defaultVisibleColumns: [
        'name',
        'accountId',
        'stage',
        'amount',
        'expectedCloseDate',
        'probability',
        'assignedTo',
        'lastActivityDate',
        'createdAt',
      ],
      lockedColumn: 'name',
      excludedFromDefault: []
    },
    statistics: {
      scope: 'query',
      stats: resolveDealsStatsConfig(),
      resolveStats: resolveDealsStatsConfig,
      computeFunction: computeDealsStatistics
    },
    systemViews: [
      { id: 'all', name: 'All Deals', filters: {}, isDefault: true },
      { id: 'my-deals', name: 'My Deals', filters: { assignedTo: 'me' } },
      { id: 'open', name: 'Open', filters: { status: 'Open' } },
      { id: 'won', name: 'Won', filters: { status: 'Won' } },
      { id: 'lost', name: 'Lost', filters: { status: 'Lost' } }
    ],
    apiEndpoint: '/deals',
    normalizeFilters: normalizeDealsFilters,
    normalizeViewFilters: normalizeDealsViewFilters
  },

  quotes: {
    defaultColumns: {
      defaultVisibleColumns: [
        'quoteTitle',
        'quoteNumber',
        'organizationRefId',
        'status',
        'grandTotal',
        'validUntil',
        'assignedTo',
        'updatedAt'
      ],
      lockedColumn: 'quoteTitle',
      excludedFromDefault: ['customFields', 'sourceRef']
    },
    statistics: {
      scope: 'query',
      stats: resolveQuotesStatsConfig({}, 'all'),
      resolveStats: resolveQuotesStatsConfig,
      computeFunction: computeQuotesStatistics
    },
    systemViews: [
      { id: 'all', name: 'All Quotes', filters: {}, isDefault: true },
      { id: 'my-quotes', name: 'My Quotes', filters: { assignedTo: 'me' } },
      { id: 'draft', name: 'Draft', filters: { status: 'Draft' } },
      { id: 'pending-approval', name: 'Pending Approval', filters: { status: 'Pending Approval' } },
      { id: 'approved', name: 'Approved', filters: { status: 'Approved' } },
      { id: 'sent', name: 'Sent', filters: { status: 'Sent' } },
      { id: 'accepted', name: 'Accepted', filters: { status: 'Accepted' } },
      { id: 'converted', name: 'Converted', filters: { status: 'Converted' } }
    ],
    apiEndpoint: '/quotes',
    normalizeFilters: normalizeQuotesFilters,
    normalizeViewFilters: normalizeQuotesViewFilters
  },

  sales_orders: {
    defaultColumns: {
      defaultVisibleColumns: [
        'salesOrderNumber',
        'orderTitle',
        'status',
        'fulfillmentStatus',
        'grandTotal',
        'updatedAt'
      ],
      lockedColumn: 'salesOrderNumber',
      excludedFromDefault: ['customFields']
    },
    statistics: {
      scope: 'query',
      stats: resolveSalesOrdersStatsConfig({}, 'all'),
      resolveStats: resolveSalesOrdersStatsConfig,
      computeFunction: computeSalesOrdersStatistics
    },
    systemViews: [
      { id: 'all', name: 'All Sales Orders', filters: {}, isDefault: true },
      { id: 'my-orders', name: 'My Orders', filters: { assignedTo: 'me' } },
      { id: 'draft', name: 'Draft', filters: { status: 'Draft' } },
      { id: 'confirmed', name: 'Confirmed', filters: { status: 'Confirmed' } },
      { id: 'in-fulfillment', name: 'In Fulfillment', filters: { status: 'In Fulfillment' } },
      { id: 'partially-fulfilled', name: 'Partially Fulfilled', filters: { status: 'Partially Fulfilled' } },
      { id: 'completed', name: 'Completed', filters: { status: 'Fulfilled' } },
      { id: 'cancelled', name: 'Cancelled', filters: { status: 'Cancelled' } },
      { id: 'from-quote', name: 'From Quote', filters: { sourceType: 'quote' } }
    ],
    apiEndpoint: '/sales-orders',
    normalizeFilters: normalizeSalesOrdersFilters,
    normalizeViewFilters: normalizeSalesOrdersViewFilters
  },

  campaigns: {
    defaultColumns: {
      defaultVisibleColumns: ['name', 'subject', 'status', 'recipientCount', 'updatedAt'],
      lockedColumn: 'name',
      excludedFromDefault: []
    },
    statistics: {
      scope: 'query',
      stats: resolveCampaignsStatsConfig(),
      resolveStats: resolveCampaignsStatsConfig,
      computeFunction: computeCampaignsStatistics
    },
    systemViews: [
      { id: 'all', name: 'All campaigns', filters: {}, isDefault: true },
      { id: 'draft', name: 'Draft', filters: { status: 'draft' } },
      { id: 'scheduled', name: 'Scheduled', filters: { status: 'scheduled' } },
      { id: 'running', name: 'Running', filters: { status: 'running' } },
      { id: 'completed', name: 'Completed', filters: { status: 'completed' } },
      { id: 'failed', name: 'Failed', filters: { status: 'failed' } },
      { id: 'archived', name: 'Archived', filters: { status: 'archived' } }
    ],
    apiEndpoint: '/marketing/campaigns',
    normalizeFilters: normalizeCampaignsFilters,
    normalizeViewFilters: normalizeCampaignsFilters
  },

  reports: {
    defaultColumns: {
      defaultVisibleColumns: ['name', 'type', 'primaryModule', 'status', 'ownerId', 'updatedAt'],
      lockedColumn: 'name',
      excludedFromDefault: []
    },
    statistics: {
      scope: 'query',
      stats: resolvePublishableStatsConfig('totalReports', 'Total Reports'),
      resolveStats: () => resolvePublishableStatsConfig('totalReports', 'Total Reports'),
      computeFunction: computeReportsStatistics
    },
    systemViews: [
      { id: 'all', name: 'All', filters: {}, isDefault: true },
      { id: 'mine', name: 'My reports', filters: { mine: true } },
      { id: 'shared', name: 'Shared with me', filters: { shared: true } },
      { id: 'scheduled', name: 'Scheduled', filters: { scheduled: true } },
      { id: 'draft', name: 'Drafts', filters: { status: 'draft' } },
      { id: 'published', name: 'Published', filters: { status: 'published' } },
      { id: 'archived', name: 'Archived', filters: { status: 'archived' } }
    ],
    apiEndpoint: '/analytics/reports',
    normalizeFilters: normalizeReportsFilters,
    normalizeViewFilters: normalizeReportsFilters
  },

  widgets: {
    defaultColumns: {
      defaultVisibleColumns: ['name', 'chartType', 'reportId', 'status', 'updatedAt'],
      lockedColumn: 'name',
      excludedFromDefault: []
    },
    statistics: {
      scope: 'query',
      stats: resolvePublishableStatsConfig('totalWidgets', 'Total Widgets'),
      resolveStats: () => resolvePublishableStatsConfig('totalWidgets', 'Total Widgets'),
      computeFunction: computeWidgetsStatistics
    },
    systemViews: [
      { id: 'all', name: 'All', filters: {}, isDefault: true },
      { id: 'draft', name: 'Drafts', filters: { status: 'draft' } },
      { id: 'published', name: 'Published', filters: { status: 'published' } },
      { id: 'archived', name: 'Archived', filters: { status: 'archived' } }
    ],
    apiEndpoint: '/analytics/widgets',
    normalizeFilters: normalizeWidgetsFilters,
    normalizeViewFilters: normalizeWidgetsFilters
  },

  dashboards: {
    defaultColumns: {
      defaultVisibleColumns: ['name', 'category', 'widgetCount', 'status', 'updatedAt'],
      lockedColumn: 'name',
      excludedFromDefault: []
    },
    statistics: {
      scope: 'query',
      stats: resolvePublishableStatsConfig('totalDashboards', 'Total Dashboards'),
      resolveStats: () => resolvePublishableStatsConfig('totalDashboards', 'Total Dashboards'),
      computeFunction: computeDashboardsStatistics
    },
    systemViews: [
      { id: 'all', name: 'All', filters: {}, isDefault: true },
      { id: 'draft', name: 'Drafts', filters: { status: 'draft' } },
      { id: 'published', name: 'Published', filters: { status: 'published' } },
      { id: 'archived', name: 'Archived', filters: { status: 'archived' } }
    ],
    apiEndpoint: '/analytics/dashboards',
    normalizeFilters: normalizeDashboardsFilters,
    normalizeViewFilters: normalizeDashboardsFilters
  },

  invoices: {
    defaultColumns: {
      defaultVisibleColumns: [
        'invoiceNumber',
        'invoiceTitle',
        'status',
        'grandTotal',
        'amountDue',
        'invoiceDate',
        'updatedAt'
      ],
      lockedColumn: 'invoiceNumber',
      excludedFromDefault: ['customFields']
    },
    statistics: {
      scope: 'query',
      stats: resolveInvoicesStatsConfig({}, 'all'),
      resolveStats: resolveInvoicesStatsConfig,
      computeFunction: computeInvoicesStatistics
    },
    systemViews: [
      { id: 'all', name: 'All Invoices', filters: {}, isDefault: true },
      { id: 'my-invoices', name: 'My Invoices', filters: { assignedTo: 'me' } },
      { id: 'draft', name: 'Draft', filters: { status: 'Draft' } },
      { id: 'pending-approval', name: 'Pending Approval', filters: { status: 'Pending Approval' } },
      { id: 'approved', name: 'Approved', filters: { status: 'Approved' } },
      { id: 'posted', name: 'Posted', filters: { status: 'Posted' } },
      { id: 'void', name: 'Void', filters: { status: 'Void' } },
      { id: 'from-sales-order', name: 'From Sales Order', filters: { sourceType: 'sales_order' } }
    ],
    apiEndpoint: '/invoices',
    normalizeFilters: normalizeInvoicesFilters,
    normalizeViewFilters: normalizeInvoicesViewFilters
  },

  cases: {
    defaultColumns: {
      // Case Title, Case Number, Contact, Type, Priority, Status, Assigned To, Channel, Last Modified
      defaultVisibleColumns: [
        'title',
        'caseId',
        'contactId',
        'caseType',
        'priority',
        'status',
        'assignedTo',
        'channel',
        'updatedAt'
      ],
      lockedColumn: 'title',
      excludedFromDefault: [
        // Hide internal/system and high-noise fields from default list view
        'customFields',
        'activities',
        'assignmentControl',
        'currentSlaCycle',
        'slaCycles',
        'caseNotes',
        'resolutionSummary',
        'description',
        'ccEmails',
        'watchers'
      ]
    },
    systemViews: [
      { id: 'all', name: 'All Cases', filters: {}, isDefault: true },
      { id: 'my-cases', name: 'My Cases', filters: { assignedTo: 'me' } },
      { id: 'unassigned', name: 'Unassigned', filters: { assignedTo: null } },
      { id: 'open', name: 'Open', filters: { status: ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer'] } },
      { id: 'team', name: 'Team', filters: { status: ['Assigned', 'In Progress', 'On Hold', 'Waiting for Customer'] } },
      { id: 'sla-at-risk', name: 'SLA at risk', filters: { slaBreached: true, status: ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer'] } },
      { id: 'recently-updated', name: 'Recently updated', filters: { updatedWithinDays: 7 } },
      { id: 'resolved', name: 'Resolved', filters: { status: 'Resolved' } },
      { id: 'closed', name: 'Closed', filters: { status: 'Closed' } }
    ],
    apiEndpoint: '/helpdesk/cases'
  },

  /*
  ============================================================================
  ITEM LIST VIEW — DEFAULT COLUMN CONTRACT
  ============================================================================
  - Defines the canonical default columns for Item list view
  - item_name is the frozen primary identifier
  - This is a UI configuration layer only
  - Field meaning and ownership are defined in itemFieldModel.ts
  ============================================================================
  */
  items: {
    defaultColumns: {
      // Canonical default columns in exact order:
      // Item Name, Item Type, Item Code, Category, Selling Price, Status, Assigned To, Last Modified
      defaultVisibleColumns: [
        'item_name',
        'item_type',
        'item_code',
        'categoryId',
        'selling_price',
        'lifecycle_state',
        'assignedTo',
        'updatedAt',
      ],
      lockedColumn: 'item_name',
      excludedFromDefault: []
    },
    statistics: {
      scope: 'query',
      stats: resolveItemsStatsConfig(),
      resolveStats: resolveItemsStatsConfig,
      computeFunction: computeItemsStatistics
    },
    systemViews: [
      {
        id: 'all',
        name: 'All Items',
        filters: {},
        isDefault: true
      },
      {
        id: 'active',
        name: 'Active Items',
        filters: { lifecycle_state: 'Active' }
      },
      {
        id: 'draft',
        name: 'Draft Items',
        filters: { lifecycle_state: 'Draft' }
      },
      {
        id: 'discontinued',
        name: 'Discontinued',
        filters: { lifecycle_state: 'Discontinued' }
      },
      {
        id: 'products',
        name: 'Products',
        filters: { item_type: 'Product' }
      },
      {
        id: 'services',
        name: 'Services',
        filters: { item_type: 'Service' }
      }
    ],
    apiEndpoint: '/items',
    normalizeFilters: normalizeItemsFilters,
    normalizeViewFilters: normalizeItemsViewFilters
  },

  'live-chat-closed': {
    defaultColumns: {
      defaultVisibleColumns: [
        'visitor',
        'sessionKey',
        'channel',
        'lifecycleStatus',
        'outcome',
        'queue',
        'assignedAgent',
        'handledBy',
        'startedAt',
        'endedAt',
        'duration',
        'summary',
        'tags',
        'csatScore',
      ],
      lockedColumn: 'visitor',
    },
    apiEndpoint: '/live-chat/sessions',
  },
};

/**
 * DEV-only safety checks for Item list view configuration
 * Validates that item_name is present and frozen as required
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const itemsConfig = MODULE_LIST_REGISTRY.items;
  if (itemsConfig) {
    const { defaultVisibleColumns, lockedColumn } = itemsConfig.defaultColumns;
    
    // Assert that item_name is present in default columns
    console.assert(
      defaultVisibleColumns.includes('item_name'),
      '⚠️ [moduleListRegistry] Item list view: item_name is missing from defaultVisibleColumns. ' +
      'item_name must always be present as the primary identifier.'
    );
    
    // Assert that item_name is the locked column
    console.assert(
      lockedColumn === 'item_name',
      '⚠️ [moduleListRegistry] Item list view: lockedColumn is not "item_name". ' +
      'item_name must be frozen/locked as the primary identifier.'
    );
    
    // Warn if item_name is missing from default columns (additional safety check)
    if (!defaultVisibleColumns.includes('item_name')) {
      console.warn(
        '⚠️ [moduleListRegistry] Item list view: item_name is missing from defaultVisibleColumns. ' +
        'item_name must always be present as the primary identifier.'
      );
    }
    
    // Validate that all default columns exist in field metadata
    defaultVisibleColumns.forEach(fieldKey => {
      const metadata = getItemFieldMetadata(fieldKey);
      if (!metadata) {
        console.warn(
          `⚠️ [moduleListRegistry] Item list view: Field "${fieldKey}" is in defaultVisibleColumns but not found in ITEM_FIELD_METADATA.`
        );
      } else {
        // Warn if field is not editable or filterable (may indicate misconfiguration)
        if (!metadata.editable && !metadata.filterable) {
          console.warn(
            `⚠️ [moduleListRegistry] Item list view: Field "${fieldKey}" is in defaultVisibleColumns but is neither editable nor filterable. ` +
            'Consider if this field should be in the default view.'
          );
        }
      }
    });
  }
}

/**
 * Get module list configuration
 */
export function getModuleListConfig(
  moduleKey: string,
  options?: ModuleListConfigOptions
): ModuleListConfig | null {
  const raw = MODULE_LIST_REGISTRY[moduleKey] || null;
  if (!raw) return null;
  if (options?.inventoryEnabled === false) {
    return applyInventoryCapabilityToModuleListConfig(raw, moduleKey, false);
  }
  return raw;
}

/**
 * Check if a module has list configuration
 */
export function hasModuleListConfig(moduleKey: string): boolean {
  return moduleKey in MODULE_LIST_REGISTRY;
}

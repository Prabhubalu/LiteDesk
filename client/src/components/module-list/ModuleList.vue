<template>
  <div v-if="showListShellSkeleton">
    <ListPageSkeleton :body-rows="12" />
  </div>

  <div v-else-if="listDefinition">
    <!-- Empty State (from definition) -->
    <div v-if="shouldShowEmptyState" class="flex items-center justify-center min-h-[60vh]">
      <div class="text-center max-w-md">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ listDefinition.emptyState.title }}
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          {{ listDefinition.emptyState.description }}
        </p>
        <button
          v-if="listDefinition.emptyState.primaryAction"
          @click="handleAction(listDefinition.emptyState.primaryAction.route)"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          {{ listDefinition.emptyState.primaryAction.label }}
        </button>
      </div>
    </div>

    <!-- List View -->
    <ListView
      v-else
      :title="listPageTitle"
      :description="listDefinition.description"
      :module-key="listDefinition.moduleKey"
      :view-mode="viewMode"
      :create-label="listCreateLabel"
      :search-placeholder="listSearchPlaceholder"
      :data="data"
      :columns="adaptedColumns"
      :loading="dataLoading"
      :loading-more="loadingMore"
      infinite-scroll
      :selection-column-variant="selectionColumnVariant"
      :statistics="statistics"
      :stats-config="localizedStatsConfig"
      :saved-views="displaySavedViews"
      :active-saved-view-id="activeSavedViewId"
      :default-view-id="defaultViewId"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :pagination="pagination"
      :filter-config="adaptedFilters"
      :external-filters="filters"
      :boost-visible-column-keys="boostVisibleColumnKeys"
      :table-id="`${listDefinition.moduleKey}-table`"
      :scroll-session-key="listSessionKey"
      row-key="_id"
      :empty-title="listEmptyTitle"
      :empty-message="listEmptyMessage"
      @create="handleCreate"
      @import="handleImport"
      @export="handleExport"
      @update:searchQuery="handleSearchQueryUpdate"
      @update:filters="handleFiltersUpdate"
      @update:sort="handleSortUpdate"
      @update:pagination="handlePaginationUpdate"
      @saved-view-selected="handleSavedViewSelected"
      @set-default-view="handleSetDefaultView"
      @saved-views-updated="handleSavedViewsUpdated"
      @stat-click="handleStatClick"
      @filter-opened="handleFilterOpened"
      @fetch="fetchData"
      @load-more="handleLoadMore"
      @row-click="handleRowClick"
      @edit="handleEdit"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
      @kanban-settings-changed="$emit('kanban-settings-changed')"
      @stats-visibility-changed="(val) => $emit('stats-visibility-changed', val)"
    >
      <!-- Pass through all slots for custom cell rendering -->
      <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps" />
      </template>
    </ListView>
  </div>

  <!-- Error State -->
  <div v-else class="flex items-center justify-center min-h-[60vh]">
    <div class="text-center">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('common.moduleListListNotFound') }}</h2>
      <p class="text-gray-600 dark:text-gray-400">{{ t('common.moduleListTheListForThisModuleIs') }}</p>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  getCurrentInstance,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  provide
} from 'vue';
import {
  consumeImportListRefreshPending,
  importModuleMatchesListModule,
} from '@/utils/importListModuleMatch';
import { useI18n } from 'vue-i18n';
import {
  resolveListColumnLabel,
  resolveListCreateLabel,
  resolveListFilterLabel,
  resolveListPageTitle,
  resolveListSearchPlaceholder,
  resolveListStatLabel,
  resolveListViewLabel,
  resolveModuleDisplayLabel,
  isRegistrySystemView,
} from '@/utils/moduleListLabels';
import ListPageSkeleton from '@/components/common/ListPageSkeleton.vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import { buildModuleListFromRegistry } from '@/utils/buildModuleListFromRegistry';
import { getAppRegistry } from '@/utils/getAppRegistry';
import { createPermissionSnapshot } from '@/types/permission-snapshot.types';
import { EmptyStateType } from '@/types/empty-state.types';
import ListView from '@/components/common/ListView.vue';
import apiClient from '@/utils/apiClient';
import { getStateFields, getFieldMetadata, getParticipationFields } from '@/platform/fields/peopleFieldModel';
import { getParticipation } from '@/utils/getParticipation';
import { isPeopleSalesRoleFieldKey } from '@/utils/peopleParticipationUi';
import { getModuleListConfig, hasModuleListConfig, getSystemViews } from '@/platform/modules/moduleListRegistry';
import { getFiltersForModule } from '@/platform/filters/filterResolver';
import { buildListColumnsFromModuleFields } from '@/utils/buildListColumnsFromModuleFields';
import { normalizeListPagination } from '@/utils/normalizeListPagination';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import { allSettledWithConcurrency } from '@/utils/allSettledWithConcurrency';
import { startBulkDelete } from '@/utils/runBulkDelete';
import { yieldToUi } from '@/utils/uiYield';
import {
  clearListSession,
  getListSession,
  getListSessionKey,
  LIST_SESSION_RESTORE_KEY,
  patchListSession
} from '@/utils/listScrollSession';

/**
 * Check if a person participates in an app.
 * For SALES: use getParticipation abstraction (never person.type).
 * For other apps: use state fields from metadata.
 */
function participatesInApp(person, appKey) {
  if (!person || !appKey) return false;
  const key = String(appKey).toUpperCase();
  if (key === 'SALES' || key === 'HELPDESK') {
    return getParticipation(person, key) != null;
  }
  const stateFields = getStateFields(appKey);
  return stateFields.some(fieldKey => {
    const value = person[fieldKey];
    return value !== null && value !== undefined && value !== '';
  });
}

const props = defineProps({
  moduleKey: {
    type: String,
    required: true
  },
  appKey: {
    type: String,
    required: true
  },
  /** When provided (e.g. 'list' | 'kanban'), ListView shows "Customize List" vs "Customize Kanban" and the appropriate drawer */
  viewMode: {
    type: String,
    default: null
  },
  /** People page context: 'ALL' = no filter; otherwise filter getParticipation(person, context) != null */
  peopleContext: {
    type: String,
    default: 'ALL',
    validator: (v) => !v || v === 'ALL' || v === 'SALES' || v === 'HELPDESK'
  },
  /** Passed to ListView/TableView: 'numbered-hover' shows row # until hover (desktop);
   *  'checkbox' always shows boxes */
  selectionColumnVariant: {
    type: String,
    default: 'numbered-hover',
    validator: (v) => !v || v === 'checkbox' || v === 'numbered-hover'
  }
});

const emit = defineEmits(['create', 'import', 'export', 'row-click', 'edit', 'delete', 'bulk-action', 'filters-changed', 'search-changed', 'kanban-settings-changed', 'stats-visibility-changed']);

/** Capture at setup — getCurrentInstance() is null inside async event handlers */
const setupInstance = getCurrentInstance();
const parentHandlesBulkAction = typeof setupInstance?.vnode?.props?.onBulkAction === 'function';
const parentHandlesDelete = typeof setupInstance?.vnode?.props?.onDelete === 'function';

const route = useRoute();
const router = useRouter();

const listSessionScope = computed(() => {
  if (props.moduleKey === 'people' && props.peopleContext) {
    return String(props.peopleContext);
  }
  return '';
});

const listSessionKey = computed(() =>
  getListSessionKey(props.moduleKey, props.appKey, route.path, listSessionScope.value)
);

/** Only block the whole page on first load — not when returning from another tab */
const showListShellSkeleton = computed(
  () => loading.value && !listDefinition.value
);

const pendingListSessionRestore = ref(null);
const sessionRestoreTick = ref(0);
provide(LIST_SESSION_RESTORE_KEY, sessionRestoreTick);

function bumpSessionRestoreTick() {
  sessionRestoreTick.value += 1;
}

function clearListSessionState() {
  clearListSession(listSessionKey.value);
  pendingListSessionRestore.value = null;
}

async function restoreListSessionPages() {
  const session = pendingListSessionRestore.value;
  if (!session) return;

  const targetPage = Math.max(1, Number(session.currentPage) || 1);
  let guard = 0;
  const maxSteps = Math.min(targetPage, 200);

  while (
    guard < maxSteps &&
    normalizeListPagination(pagination.value).currentPage < targetPage &&
    normalizeListPagination(pagination.value).hasMore
  ) {
    guard += 1;
    await fetchListAppend();
  }

  pendingListSessionRestore.value = null;
  bumpSessionRestoreTick();
}

async function applyListSessionOnActivate() {
  const session = getListSession(listSessionKey.value);
  if (!session) return;

  const targetPage = Math.max(1, Number(session.currentPage) || 1);
  const currentPage = normalizeListPagination(pagination.value).currentPage;

  if (data.value.length > 0 && currentPage >= targetPage) {
    bumpSessionRestoreTick();
    return;
  }

  pendingListSessionRestore.value = session;

  if (data.value.length === 0) {
    return;
  }

  await restoreListSessionPages();
}

async function refreshListAfterImport() {
  pagination.value.currentPage = 1;
  clearListSessionState();
  await fetchData();
  consumeImportListRefreshPending(props.moduleKey);
}

function onImportCompleteForList(event) {
  const detail = event?.detail || {};
  if (!importModuleMatchesListModule(detail.module, props.moduleKey)) return;
  void refreshListAfterImport();
}

function onBulkDeleteCompleteForList(event) {
  const mk = String(event?.detail?.moduleKey || '').toLowerCase();
  if (!mk || mk !== String(props.moduleKey || '').toLowerCase()) return;
  void fetchData();
}

onMounted(() => {
  window.addEventListener('litedesk:import-complete', onImportCompleteForList);
  window.addEventListener('litedesk:bulk-delete-complete', onBulkDeleteCompleteForList);
});

onBeforeUnmount(() => {
  window.removeEventListener('litedesk:import-complete', onImportCompleteForList);
  window.removeEventListener('litedesk:bulk-delete-complete', onBulkDeleteCompleteForList);
});

onDeactivated(() => {
  patchListSession(listSessionKey.value, {
    currentPage: normalizeListPagination(pagination.value).currentPage
  });
});

async function restoreListSessionAfterFetch() {
  const session = getListSession(listSessionKey.value);
  if (!session) return;

  const targetPage = Math.max(1, Number(session.currentPage) || 1);
  if (normalizeListPagination(pagination.value).currentPage < targetPage) {
    pendingListSessionRestore.value = session;
    await restoreListSessionPages();
  } else {
    bumpSessionRestoreTick();
  }
}

async function initialListFetch() {
  if (replaceInFlight) {
    await replaceInFlight;
    return;
  }

  const session = getListSession(listSessionKey.value);
  if (!session) {
    await fetchListReplace();
    return;
  }
  pagination.value.currentPage = 1;
  await fetchListReplace({ preserveSession: true, soft: true });
  await restoreListSessionAfterFetch();
}

onActivated(async () => {
  // Aborted in-flight fetch when the tab was hidden can leave dataLoading stuck true.
  if (data.value.length > 0) {
    dataLoading.value = false;
  }

  if (consumeImportListRefreshPending(props.moduleKey)) {
    await refreshListAfterImport();
    return;
  }

  if (data.value.length > 0 && listDefinition.value) {
    await applyListSessionOnActivate();
    bumpSessionRestoreTick();
    return;
  }

  if (listDefinition.value) {
    await initialListFetch();
    return;
  }

  // Stats from a prior visit but rows were cleared (aborted replace / keep-alive eviction).
  const statsTotal = Number(
    statistics.value?.totalPeople ??
      statistics.value?.totalRecords ??
      pagination.value?.totalRecords ??
      0
  );
  if (statsTotal > 0 && data.value.length === 0) {
    await initialListFetch();
  }
});
const authStore = useAuthStore();
const { openTab } = useTabs();
const { t, te } = useI18n();

const loading = ref(true);
const dataLoading = ref(false);
const listDefinition = ref(null);
const data = ref([]);
const statistics = ref({});
const statsConfig = ref([]);
const sortField = ref('');
const sortOrder = ref('desc'); // Default to newest first so new records appear on page 1

/** People list: API/registry use sales_type; legacy layouts may still reference type */
const normalizePeopleListSortField = (key) => {
  if (props.moduleKey !== 'people' || key == null || key === '') return key;
  return String(key).trim() === 'type' ? 'sales_type' : key;
};

const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  limit: 25
});
const loadingMore = ref(false);
/** Bumped on every replace fetch so in-flight appends can detect stale results */
const listDataEpoch = ref(0);
let replaceSeq = 0;
let appendSeq = 0;
let replaceAbortController = null;
let appendAbortController = null;
/** Dedupe concurrent replace fetches (buildList + onActivated racing on remount). */
let replaceInFlight = null;

const filters = ref({});
const searchQuery = ref('');

const coerceFilterValuesToArray = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return [String(value).trim()].filter(Boolean);
};

const includesRoleMatch = (filterValues, roleValue) => {
  if (!filterValues.length) return true;
  const normalizedRole = String(roleValue || '').trim().toLowerCase();
  return filterValues.some((candidate) => String(candidate).trim().toLowerCase() === normalizedRole);
};

const isPeopleRoleFilterKey = (key) => {
  const normalized = String(key || '').trim();
  return normalized === 'type' || normalized === 'sales_type' || normalized === 'helpdesk_role';
};

// Saved Views for People module
const savedViews = ref([]);
const defaultViewId = ref(null);
const activeSavedViewId = ref(null);

// Schema-driven filter data
const moduleFieldDefinitions = ref([]);
const availableUsers = ref([]);
const availableUsersLoading = ref(false);
const availableOrganizations = ref([]);
const availableOrganizationsLoading = ref(false);
const appRegistry = ref(null);

// Known app keys that can have People participation
const knownParticipationApps = ['SALES', 'HELPDESK', 'MARKETING', 'AUDIT', 'PORTAL', 'PROJECTS'];

// App display names
const appDisplayNames = {
  'SALES': 'Sales',
  'HELPDESK': 'Helpdesk',
  'MARKETING': 'Marketing',
  'AUDIT': 'Audit',
  'PORTAL': 'Portal',
  'PROJECTS': 'Projects'
};

// Build list from registry
const buildList = async () => {
  if (!authStore.user || !authStore.isAuthenticated) {
    listDefinition.value = null;
    loading.value = false;
    return;
  }

  const isFirstShellLoad = !listDefinition.value;
  if (isFirstShellLoad) {
    loading.value = true;
  }
  try {
    // Fetch app registry
    const registry = await getAppRegistry();
    appRegistry.value = registry;
    
    if (!authStore.user || !authStore.isAuthenticated) {
      return;
    }
    
    // Fetch field definitions for schema-driven filters
    await fetchModuleFieldDefinitions();
    
    // Create permission snapshot
    const snapshot = createPermissionSnapshot(authStore.user);

    // Build list definition
    const definition = buildModuleListFromRegistry(
      props.moduleKey,
      props.appKey,
      registry,
      snapshot
    );

    if (authStore.user && authStore.isAuthenticated) {
      const fieldColumns = buildListColumnsFromModuleFields(
        moduleFieldDefinitions.value,
        props.moduleKey
      );
      if (fieldColumns.length > 0) {
        listDefinition.value = {
          ...definition,
          columns: fieldColumns
        };
      } else {
        listDefinition.value = definition;
      }

      // Initialize sort from definition
      if (definition?.defaultSort) {
        sortField.value = normalizePeopleListSortField(definition.defaultSort.column);
        // For people module, prefer 'desc' (newest first) for better UX
        // This ensures new identity-only records appear on page 1
        if (props.moduleKey === 'people' && definition.defaultSort.column === 'createdAt') {
          sortOrder.value = 'desc';
        } else {
          sortOrder.value = definition.defaultSort.order;
        }
      }
      
      // Initialize pagination from definition
      if (definition?.pagination) {
        pagination.value.limit = definition.pagination.pageSize;
      }
      
      // Fetch data after definition is built
      // Only skip if empty state is NOT_CONFIGURED (no columns)
      // Otherwise fetch data even if empty state exists (might be NO_DATA)
      
      // Initialize module-specific configuration from registry
      const moduleConfig = getModuleListConfig(props.moduleKey);
      const currentUserId = authStore.user?._id;
      const moduleLabel = listDefinition.value?.title || props.moduleKey.charAt(0).toUpperCase() + props.moduleKey.slice(1);
      
      // Get system views (from registry or generate defaults)
      const systemViews = getSystemViews(props.moduleKey, moduleLabel, currentUserId);
      
      // Convert system views to saved views format (with label instead of name)
      const systemViewsFormatted = systemViews.map(view => ({
        id: view.id,
        label: view.name,
        filters: view.filters,
        isDefault: view.isDefault === true
      }));
      
      // Load custom saved views from localStorage
      const customViewsStorageKey = `arivu-listview-${props.moduleKey}-saved-views`;
      let customViews = [];
      try {
        const saved = localStorage.getItem(customViewsStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          customViews = Array.isArray(parsed) ? parsed : [];
        }
      } catch (error) {
        console.warn('[ModuleList] Failed to load custom views:', error);
      }
      
      // Merge system views with custom views
      savedViews.value = [...systemViewsFormatted, ...customViews];
      
      // Initialize stats config from registry if available
      if (moduleConfig?.statistics) {
        statsConfig.value = moduleConfig.statistics.stats;
      }
      
      // Find default view or first view
      const defaultView = systemViews.find(v => v.isDefault) || systemViews[0];
      if (defaultView) {
        // Priority: last active view (if user switched before reload) > user's default (first visit) > "All"
        const defaultViewStorageKey = `arivu-listview-${props.moduleKey}-default-view`;
        const savedViewStorageKey = `arivu-listview-${props.moduleKey}-active-view`;
        try {
          const userDefaultViewId = localStorage.getItem(defaultViewStorageKey);
          defaultViewId.value = userDefaultViewId || null;
          const savedActiveViewId = localStorage.getItem(savedViewStorageKey);
          const viewToLoad = (savedActiveViewId && savedViews.value.find(v => v.id === savedActiveViewId))
            ? savedActiveViewId
            : (userDefaultViewId && savedViews.value.find(v => v.id === userDefaultViewId))
              ? userDefaultViewId
              : defaultView.id;
          activeSavedViewId.value = viewToLoad;
          const savedView = savedViews.value.find(v => v.id === viewToLoad);
          if (savedView && savedView.filters) {
            const viewFilters = { ...savedView.filters };
            if (moduleConfig?.normalizeViewFilters) {
              const normalized = moduleConfig.normalizeViewFilters(viewFilters, currentUserId);
              filters.value = normalized;
            } else {
              filters.value = viewFilters;
            }
          } else {
            filters.value = {};
          }
        } catch (error) {
          console.warn('[ModuleList] Failed to load saved view:', error);
          activeSavedViewId.value = defaultView.id;
          filters.value = {};
        }
      }
      
      if (!moduleConfig) {
        // For other modules, use statsConfig from definition or response
        statsConfig.value = definition?.statsConfig || [];
      }

      // Show the list shell immediately once definition is available.
      // Data fetch runs in the background, keeping the perceived load faster.
      loading.value = false;

      if (definition && definition.emptyState?.type !== 'NOT_CONFIGURED') {
        initialListFetch().catch((error) => {
          console.error('[ModuleList] Initial data fetch failed:', error);
        });
      }

      return;
    }
  } catch (error) {
    console.error('[ModuleList] Error building list:', error);
    if (authStore.isAuthenticated) {
      listDefinition.value = null;
    }
  } finally {
    if (authStore.isAuthenticated) {
      loading.value = false;
    }
  }
};

// Adapt columns from definition to ListView format
const adaptedColumns = computed(() => {
  if (!listDefinition.value?.columns) return [];
  
  return listDefinition.value.columns.map(col => ({
    key: col.key,
    label: resolveListColumnLabel(props.moduleKey, col.key, col.label, t, te),
    sortable: col.sortable ?? false,
    sortKey: col.fieldPath || col.key,
    dataType: col.dataType
  }));
});

const listPageTitle = computed(() => resolveListPageTitle(props.moduleKey, t, te));

const moduleLabel = computed(() => resolveModuleDisplayLabel(props.moduleKey, t, te));
const moduleLabelLower = computed(() => moduleLabel.value.toLowerCase());

const listEmptyTitle = computed(() => {
  const es = listDefinition.value?.emptyState;
  if (!es || es.type === EmptyStateType.NO_DATA) {
    return t('common.listEmptyNoModuleYet', { module: moduleLabelLower.value });
  }
  return es.title;
});

const listEmptyMessage = computed(() => {
  const es = listDefinition.value?.emptyState;
  if (!es || es.type === EmptyStateType.NO_DATA) {
    return t('common.listEmptyModuleWillAppear', { module: moduleLabel.value });
  }
  return es.description || t('common.listEmptyMessage');
});

const listSearchPlaceholder = computed(() => resolveListSearchPlaceholder(props.moduleKey, t, te));

const listCreateLabel = computed(() => {
  const createAction = listDefinition.value?.primaryActions?.find(a => a.type === 'create');
  const fallback = createAction?.label || `New ${listDefinition.value?.title || 'Item'}`;
  return resolveListCreateLabel(props.moduleKey, fallback, t, te);
});

const localizedStatsConfig = computed(() =>
  statsConfig.value.map((stat) => ({
    ...stat,
    name: resolveListStatLabel(props.moduleKey, stat.key, stat.name, t, te),
  }))
);

const displaySavedViews = computed(() =>
  savedViews.value.map((view) => ({
    ...view,
    label: isRegistrySystemView(props.moduleKey, view.id)
      ? resolveListViewLabel(props.moduleKey, view.id, view.label, t, te)
      : view.label,
  }))
);

const boostVisibleColumnKeys = computed(() => {
  if (props.moduleKey !== 'events') return [];
  const f = filters.value || {};
  if (f.appointmentOnly !== 'true' && f.appointmentOnly !== true) return [];
  const moduleConfig = getModuleListConfig('events');
  return moduleConfig?.appointmentListColumns ?? [];
});

// Fetch module field definitions for schema-driven filters
const fetchModuleFieldDefinitions = async () => {
  try {
    const params = { key: props.moduleKey };
    if (props.moduleKey === 'people') {
      if (props.peopleContext === 'SALES') params.context = 'sales';
      else if (props.peopleContext === 'HELPDESK') params.context = 'helpdesk';
      else params.context = 'all';
    }
    const response = await apiClient.get('/modules', { params });
    if (response.success && Array.isArray(response.data) && response.data.length > 0) {
      const module = response.data[0];
      let fields = module.fields || [];
      
      // Initialize filter metadata for People module fields if missing
      if (props.moduleKey === 'people') {
        const peopleFilterMetadata = {
          'assignedTo': {
            filterable: true,
            filterType: 'user',
            filterPriority: 1
          },
          'assigned_to': { // Also check for snake_case variant
            filterable: true,
            filterType: 'user',
            filterPriority: 1
          },
          'sales_type': {
            filterable: true,
            filterType: 'multi-select',
            filterPriority: 2
          },
          'helpdesk_role': {
            filterable: true,
            filterType: 'multi-select',
            filterPriority: 2
          },
          'do_not_contact': {
            filterable: true,
            filterType: 'boolean',
            filterPriority: 3
          },
          'doNotContact': { // Also check for camelCase variant
            filterable: true,
            filterType: 'boolean',
            filterPriority: 3
          },
          'organization': {
            filterable: true,
            filterType: 'entity',
            filterPriority: 4
          }
        };

        fields = fields.map((field) => {
          if (field.key && peopleFilterMetadata[field.key]) {
            const filterMeta = peopleFilterMetadata[field.key];
            return {
              ...field,
              filterable: filterMeta.filterable,
              filterType: field.filterType || filterMeta.filterType,
              filterPriority: field.filterPriority ?? filterMeta.filterPriority,
            };
          }
          if (field.filterable === undefined) {
            return { ...field, filterable: false };
          }
          return field;
        });
      }
      
      // Initialize filter metadata for Organizations module fields if missing
      if (props.moduleKey === 'organizations') {
        const organizationFilterMetadata = {
          'assignedTo': {
            filterable: true,
            filterType: 'user',
            filterPriority: 1
          },
          'assigned_to': { // Also check for snake_case variant
            filterable: true,
            filterType: 'user',
            filterPriority: 1
          },
          'isActive': {
            filterable: true,
            filterType: 'boolean',
            filterPriority: 2
          },
          'types': {
            filterable: true,
            filterType: 'multi-select',
            filterPriority: 3
          }
        };

        fields = fields.map((field) => {
          if (field.key && organizationFilterMetadata[field.key]) {
            const filterMeta = organizationFilterMetadata[field.key];
            return {
              ...field,
              filterable: filterMeta.filterable,
              filterType: field.filterType || filterMeta.filterType,
              filterPriority: field.filterPriority ?? filterMeta.filterPriority,
            };
          }
          if (field.filterable === undefined) {
            return { ...field, filterable: false };
          }
          return field;
        });
      }
      
      // Initialize filter metadata for Tasks module fields if missing
      if (props.moduleKey === 'tasks') {
        const tasksFilterMetadata = {
          'assignedTo': {
            filterable: true,
            filterType: 'user',
            filterPriority: 1
          },
          'assigned_to': { // Also check for snake_case variant
            filterable: true,
            filterType: 'user',
            filterPriority: 1
          },
          'status': {
            filterable: true,
            filterType: 'select',
            filterPriority: 2
          },
          'dueDate': {
            filterable: true,
            filterType: 'date',
            filterPriority: 3
          },
          'due_date': { // Also check for snake_case variant
            filterable: true,
            filterType: 'date',
            filterPriority: 3
          }
        };

        fields = fields.map((field) => {
          if (field.key && tasksFilterMetadata[field.key]) {
            const filterMeta = tasksFilterMetadata[field.key];
            return {
              ...field,
              filterable: filterMeta.filterable,
              filterType: field.filterType || filterMeta.filterType,
              filterPriority: field.filterPriority ?? filterMeta.filterPriority,
            };
          }
          if (field.filterable === undefined) {
            return { ...field, filterable: false };
          }
          return field;
        });
      }
      
      moduleFieldDefinitions.value = fields;

      const filterableFields = moduleFieldDefinitions.value.filter((f) => f.filterable === true);
      if (
        filterableFields.length === 0 &&
        (props.moduleKey === 'people' || props.moduleKey === 'organizations' || props.moduleKey === 'tasks')
      ) {
        console.warn(`[ModuleList] No filterable fields for ${props.moduleKey}`);
      }
    } else {
      moduleFieldDefinitions.value = [];
      console.warn('[ModuleList] No module found or empty response');
    }
  } catch (error) {
    console.error('[ModuleList] Error fetching module field definitions:', error);
    moduleFieldDefinitions.value = [];
  }
};

// Fetch lookup data for filter types that need it (user, entity)
const fetchUsersForFilters = async () => {
  if (availableUsersLoading.value || (Array.isArray(availableUsers.value) && availableUsers.value.length > 0)) {
    return;
  }
  availableUsersLoading.value = true;
  try {
    const response = await apiClient.get('/users/list');
    if (response.success && Array.isArray(response.data)) {
      availableUsers.value = response.data;
    } else {
      availableUsers.value = [];
    }
  } catch (error) {
    console.error('[ModuleList] Error fetching users for filters:', error);
    availableUsers.value = [];
  } finally {
    availableUsersLoading.value = false;
  }
};

const fetchOrganizationsForFilters = async () => {
  if (availableOrganizationsLoading.value || (Array.isArray(availableOrganizations.value) && availableOrganizations.value.length > 0)) {
    return;
  }
  availableOrganizationsLoading.value = true;
  try {
    const response = await apiClient.get('/v2/organization', { params: { limit: 1000 } });
    if (response.success && Array.isArray(response.data)) {
      availableOrganizations.value = response.data;
    } else if (response.success && response.data?.data && Array.isArray(response.data.data)) {
      availableOrganizations.value = response.data.data;
    } else {
      availableOrganizations.value = [];
    }
  } catch (error) {
    console.error('[ModuleList] Error fetching organizations for filters:', error);
    availableOrganizations.value = [];
  } finally {
    availableOrganizationsLoading.value = false;
  }
};

const handleFilterOpened = async (filterKey) => {
  if (!filterKey) return;
  const filter = adaptedFilters.value.find((f) => f.key === filterKey);
  if (!filter) return;
  if (filter.filterType === 'user') {
    await fetchUsersForFilters();
  }
  if (filter.filterType === 'entity' && props.moduleKey === 'people') {
    await fetchOrganizationsForFilters();
  }
};

// Helper to get user display name
const getUserDisplayName = (user) => {
  if (!user) return '';
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  if (user.email) return user.email;
  if (user.username) return user.username;
  return String(user._id || user.id || 'Unknown User');
};

// Note: buildSchemaFilters logic moved to adaptedFilters computed property

// Adapt filters from schema-driven field definitions
const adaptedFilters = computed(() => {
  // Use schema-driven filters if field definitions are available
  if (moduleFieldDefinitions.value.length > 0) {
    try {
      const schemaFilters = getFiltersForModule(props.moduleKey, moduleFieldDefinitions.value);

      // Enrich filters with options based on filterType
      const enrichedSchemaFilters = schemaFilters.map(filter => {
        const enrichedFilter = { ...filter };
        
        // Ensure options array exists (even if empty)
        if (!enrichedFilter.options) {
          enrichedFilter.options = [];
        }
        
        // Add options for user filter type
        if (filter.filterType === 'user') {
          const currentUserId = authStore.user?._id;
          const currentUserIdStr = currentUserId ? String(currentUserId) : null;
          
          const userOptions = [
            { value: 'me', label: 'Me' },
            { value: 'unassigned', label: 'Unassigned' }
          ];
          
          // Add all users
          if (Array.isArray(availableUsers.value)) {
            availableUsers.value.forEach(user => {
              if (user) {
                const userIdStr = String(user._id || user.id);
                if (currentUserIdStr && userIdStr !== currentUserIdStr) {
                  userOptions.push({
                    value: userIdStr,
                    label: getUserDisplayName(user)
                  });
                }
              }
            });
          }
          
          enrichedFilter.options = userOptions;
        }
        
        // Add options for entity filter type (organization lookup)
        if (filter.filterType === 'entity' && filter.key === 'organization') {
          const entityOptions = [
            { value: 'has', label: 'Has Organization' },
            { value: '', label: 'No Organization' }
          ];
          
          // Add all organizations
          if (Array.isArray(availableOrganizations.value)) {
            availableOrganizations.value.forEach(org => {
              if (org) {
                entityOptions.push({
                  value: org._id || org.id,
                  label: org.name || 'Unnamed Organization'
                });
              }
            });
          }
          
          enrichedFilter.options = entityOptions;
        }
        
        // Add options for boolean filter type
        if (filter.filterType === 'boolean') {
          if (filter.key === 'do_not_contact' || filter.key === 'doNotContact') {
            enrichedFilter.options = [
              { value: 'allowed', label: 'Allowed' },
              { value: 'doNotContact', label: 'Do Not Contact' }
            ];
          } else {
            // Generic boolean options
            enrichedFilter.options = [
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' }
            ];
          }
        }
        
        // For select/multi-select, options should come from field definition
        if ((filter.filterType === 'select' || filter.filterType === 'multi-select') && !enrichedFilter.options) {
          const fieldDef = moduleFieldDefinitions.value.find(f => f.key === filter.key);
          if (fieldDef?.options) {
            enrichedFilter.options = fieldDef.options;
          } else if ((isPeopleSalesRoleFieldKey(filter.key) || filter.key === 'helpdesk_role') && props.moduleKey === 'people') {
            // Special handling for People type / virtual role filters (participation)
            const participationOptions = [];
            if (appRegistry.value) {
              for (const appKey of knownParticipationApps) {
                if (appRegistry.value[appKey]) {
                  const appDisplayName = appDisplayNames[appKey] || appKey;
                  const stateFields = getStateFields(appKey);
                  const roles = [];
                  
                  for (const fieldKey of stateFields) {
                    try {
                      const metadata = getFieldMetadata(fieldKey);
                      if (isPeopleSalesRoleFieldKey(fieldKey) && appKey === 'SALES') {
                        roles.push('Lead');
                        roles.push('Contact');
                      } else if (appKey === 'HELPDESK' && roles.length === 0) {
                        roles.push('Contact');
                      }
                    } catch (error) {
                      // Field not in metadata - skip
                    }
                  }
                  
                  if (roles.length === 0) {
                    participationOptions.push({
                      value: `${appKey}:*`,
                      label: appDisplayName
                    });
                  } else {
                    roles.forEach(role => {
                      participationOptions.push({
                        value: `${appKey}:${role}`,
                        label: `${appDisplayName} · ${role}`
                      });
                    });
                  }
                }
              }
            }
            enrichedFilter.options = participationOptions;
          }
        }
        
        // People role filter labels/options should reflect the selected app tab context.
        if (props.moduleKey === 'people' && isPeopleRoleFilterKey(enrichedFilter.key)) {
          if (props.peopleContext === 'HELPDESK') {
            // In HELPDESK tab, show role choices from helpdesk_role field when available.
            const helpdeskFieldDef = moduleFieldDefinitions.value.find((f) => f.key === 'helpdesk_role');
            const fallbackOptions = [{ value: 'Contact', label: 'Contact' }];
            enrichedFilter.key = 'helpdesk_role';
            enrichedFilter.label = 'Type';
            enrichedFilter.options =
              Array.isArray(helpdeskFieldDef?.options) && helpdeskFieldDef.options.length
                ? helpdeskFieldDef.options
                : fallbackOptions;
          } else if (props.peopleContext === 'SALES') {
            // In SALES tab, normalize to sales_type semantics.
            const salesFieldDef = moduleFieldDefinitions.value.find((f) => f.key === 'sales_type' || f.key === 'type');
            const fallbackOptions = [
              { value: 'Lead', label: 'Lead' },
              { value: 'Contact', label: 'Contact' }
            ];
            enrichedFilter.key = 'sales_type';
            enrichedFilter.label = 'Type';
            enrichedFilter.options =
              Array.isArray(salesFieldDef?.options) && salesFieldDef.options.length
                ? salesFieldDef.options
                : fallbackOptions;
          } else {
            // All Apps: keep label as "Type" while preserving canonical keys.
            if (enrichedFilter.key !== 'helpdesk_role') {
              enrichedFilter.key = 'sales_type';
            }
            enrichedFilter.label = 'Type';
          }
        }

        // Ensure filter always has a label
        if (!enrichedFilter.label) {
          enrichedFilter.label = enrichedFilter.key || 'Unknown Filter';
        }
        
        return enrichedFilter;
      });

      // De-duplicate People role filters after key normalization (legacy `type` -> `sales_type`).
      if (props.moduleKey === 'people') {
        const deduped = [];
        const seenKeys = new Set();
        for (const filter of enrichedSchemaFilters) {
          const canonicalKey = String(filter?.key || '').trim();
          if (!canonicalKey) continue;
          if (seenKeys.has(canonicalKey)) continue;
          seenKeys.add(canonicalKey);
          deduped.push(filter);
        }
        return deduped.map((filter) => ({
          ...filter,
          label: resolveListFilterLabel(props.moduleKey, filter.key, filter.label, t, te),
        }));
      }

      return enrichedSchemaFilters.map((filter) => ({
        ...filter,
        label: resolveListFilterLabel(props.moduleKey, filter.key, filter.label, t, te),
      }));
    } catch (error) {
      console.warn('[ModuleList] Error building schema filters:', error);
      console.error('[ModuleList] Filter building error details:', error);
      return [];
    }
  }
  
  // Fallback: use filters from definition (for backward compatibility)
  if (!listDefinition.value?.filters) {
    return [];
  }
  
  return listDefinition.value.filters.map(filter => ({
    key: filter.key,
    label: resolveListFilterLabel(props.moduleKey, filter.key, filter.label, t, te),
    options: filter.options || [],
    fieldPath: filter.fieldPath,
    filterType: filter.filterType || 'select'
  }));
});

// Statistics computation is now handled by the registry

// Determine when to show full-page empty state based on definition type
// NO_DATA empty states should be shown inside the table (handled by ListView/TableView)
// Only show full-page empty state for configuration/access issues
const shouldShowEmptyState = computed(() => {
  if (!listDefinition.value?.emptyState) {
    return false;
  }

  const emptyState = listDefinition.value.emptyState;
  const emptyStateType = emptyState.type;

  // NO_ACCESS or NOT_CONFIGURED: Always show full-page (regardless of data)
  if (emptyStateType === EmptyStateType.NO_ACCESS || emptyStateType === EmptyStateType.NOT_CONFIGURED) {
    return true;
  }

  // NO_DATA: Don't show full-page - let ListView/TableView handle it inside the table
  if (emptyStateType === EmptyStateType.NO_DATA) {
    return false;
  }

  // DISABLED or FIRST_TIME: Show full-page always
  if (emptyStateType === EmptyStateType.DISABLED || emptyStateType === EmptyStateType.FIRST_TIME) {
    return true;
  }

  // Default: Don't show
  return false;
});

function stableListRowId(row) {
  if (!row || typeof row !== 'object') return null;
  const id = row._id;
  if (id == null || id === '') return null;
  return String(id);
}

function mergeAppendRowsById(existing, incoming) {
  const seen = new Set(
    existing.map(stableListRowId).filter(Boolean)
  );
  const merged = [...existing];
  for (const row of incoming) {
    const id = stableListRowId(row);
    if (id != null) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    merged.push(row);
  }
  return merged;
}

/** Shared GET params + endpoint for both replace and append (requestedPage differs). */
function buildListFetchContext(requestedPage) {
  const page =
    requestedPage ?? normalizeListPagination(pagination.value).currentPage;
  const params = {
    page,
    limit: pagination.value.limit,
    sortBy: normalizePeopleListSortField(sortField.value) || 'createdAt',
    sortOrder: sortField.value ? (sortOrder.value || 'desc') : 'desc'
  };

  const moduleConfig = getModuleListConfig(props.moduleKey);
  let normalizedFilters = { ...filters.value };

  if (moduleConfig?.normalizeFilters) {
    normalizedFilters = moduleConfig.normalizeFilters(normalizedFilters, authStore.user?._id);
  }

  Object.keys(normalizedFilters).forEach((key) => {
    if (key === 'participation' || key === 'participationApp' || key === 'participationRole') {
      return;
    }
    if (props.moduleKey === 'people' && (key === 'sales_type' || key === 'helpdesk_role' || key === 'type')) {
      return;
    }

    const value = normalizedFilters[key];
    if (value !== undefined && value !== '') {
      params[key] = value;
    } else if (value === null) {
      params[key] = null;
    }
  });

  if (props.moduleKey === 'people') {
    params.appKey = 'PLATFORM';
  } else if (props.appKey) {
    params.appKey = props.appKey;
  }

  if (searchQuery.value && searchQuery.value.trim()) {
    params.search = searchQuery.value.trim();
  }

  if (params.assignedTo === null && filters.value.assignedTo === undefined) {
    delete params.assignedTo;
  }

  if (params.organization === null && filters.value.organization !== null && filters.value.organization !== undefined) {
    if (filters.value.organization === undefined) {
      delete params.organization;
    }
  }

  const isAuditFindingModule =
    String(props.moduleKey || '').toLowerCase() === 'cases' &&
    String(props.appKey || '').toUpperCase() === 'AUDIT';
  const isHelpdeskCasesModule =
    String(props.moduleKey || '').toLowerCase() === 'cases' &&
    String(props.appKey || '').toUpperCase() === 'HELPDESK';
  const endpoint = isAuditFindingModule
    ? '/audit/findings'
    : isHelpdeskCasesModule
      ? '/helpdesk/cases'
      : moduleConfig?.apiEndpoint
        ? moduleConfig.apiEndpoint.startsWith('/')
          ? moduleConfig.apiEndpoint
          : `/${moduleConfig.apiEndpoint}`
        : `/${props.moduleKey}`;

  return {
    params,
    endpoint,
    moduleConfig,
    isAuditFindingModule,
    normalizedFilters
  };
}

function applyClientSideListTransforms(rawRows, ctx) {
  const { isAuditFindingModule, normalizedFilters } = ctx;
  let fetchedData = rawRows || [];

  if (isAuditFindingModule && Array.isArray(fetchedData)) {
    fetchedData = fetchedData.map((row) => {
      if (!row || typeof row !== 'object') return row;
      return {
        ...row,
        subject: row.subject || row.title || ''
      };
    });
  }

  if (props.moduleKey === 'people' && props.peopleContext && props.peopleContext !== 'ALL') {
    const ctxApp = props.peopleContext;
    fetchedData = fetchedData.filter((person) => getParticipation(person, ctxApp) != null);
  }

  if (props.moduleKey === 'people') {
    const salesTypeValues = coerceFilterValuesToArray(normalizedFilters.sales_type ?? normalizedFilters.type);
    const helpdeskRoleValues = coerceFilterValuesToArray(normalizedFilters.helpdesk_role);

    const legacyTypeOnHelpdesk =
      props.peopleContext === 'HELPDESK' && helpdeskRoleValues.length === 0 ? salesTypeValues : [];

    fetchedData = fetchedData.filter((person) => {
      const salesRole = getParticipation(person, 'SALES')?.role ?? '';
      const helpdeskRole = getParticipation(person, 'HELPDESK')?.role ?? '';

      const matchesSales = includesRoleMatch(salesTypeValues, salesRole);
      const matchesHelpdesk = includesRoleMatch(helpdeskRoleValues, helpdeskRole);
      const matchesLegacyHelpdesk = includesRoleMatch(legacyTypeOnHelpdesk, helpdeskRole);

      if (props.peopleContext === 'HELPDESK') {
        return matchesHelpdesk && matchesLegacyHelpdesk;
      }
      if (props.peopleContext === 'SALES') {
        return matchesSales;
      }

      return matchesSales && matchesHelpdesk;
    });
  }

  if (props.moduleKey === 'people' && filters.value.participation) {
    const participationValue = filters.value.participation;
    const participationValues = Array.isArray(participationValue)
      ? participationValue
      : [participationValue];

    if (participationValues.length > 0) {
      const participationFilters = participationValues.map((val) => {
        const [appKey, role] = String(val).split(':');
        return { appKey, role: role || '*' };
      });

      fetchedData = fetchedData.filter((person) =>
        participationFilters.some((filter) => {
          const { appKey, role } = filter;

          const participatesInAppKey = participatesInApp(person, appKey);
          if (!participatesInAppKey) {
            return false;
          }

          if (role === '*') {
            return true;
          }

          if (appKey === 'SALES' && (role === 'Lead' || role === 'Contact')) {
            return getParticipation(person, appKey)?.role === role;
          }

          return true;
        })
      );
    }
  }

  return fetchedData;
}

function applyPaginationFromResponse(response, fetchedRowCountForTotal, requestedPage) {
  const fallback = {
    ...pagination.value,
    currentPage: requestedPage ?? pagination.value.currentPage,
    page: requestedPage ?? pagination.value.page
  };
  const peopleTotalOverride =
    props.moduleKey === 'people' && filters.value.participationApp
      ? fetchedRowCountForTotal
      : undefined;
  const moduleTotalKey = `total${props.moduleKey.charAt(0).toUpperCase() + props.moduleKey.slice(1)}`;

  if (response.pagination) {
    const pag = { ...response.pagination };
    if (peopleTotalOverride != null) {
      pag.total = peopleTotalOverride;
      pag.totalRecords = peopleTotalOverride;
    }
    pagination.value = normalizeListPagination(
      {
        ...pag,
        totalRecords:
          peopleTotalOverride ?? pag.totalRecords ?? pag.total ?? pag[moduleTotalKey]
      },
      fallback,
      { totalRecordsOverride: peopleTotalOverride }
    );
  } else if (response.meta) {
    pagination.value = normalizeListPagination(response.meta, fallback, {
      totalRecordsOverride: peopleTotalOverride
    });
  }
}

async function fetchListReplace(opts = {}) {
  if (!listDefinition.value) return;

  if (replaceInFlight) {
    return replaceInFlight;
  }

  const soft = Boolean(opts.soft);
  const hardClear = Boolean(opts.hardClear);
  const preserveSession = Boolean(opts.preserveSession);

  const run = async () => {
    listDataEpoch.value += 1;
    const epochForThisReplace = listDataEpoch.value;

    const myReplaceSeq = ++replaceSeq;
    replaceAbortController?.abort();
    appendAbortController?.abort();
    appendAbortController = null;

    replaceAbortController = new AbortController();
    const signal = replaceAbortController.signal;

    dataLoading.value = true;
    if (hardClear) {
      data.value = [];
      statistics.value = {};
    }

    try {
      const ctx = buildListFetchContext(
        normalizeListPagination(pagination.value).currentPage
      );
      const response = await apiClient.get(ctx.endpoint, {
        params: ctx.params,
        signal
      });

      if (listDataEpoch.value !== epochForThisReplace) return;
      if (signal.aborted) return;

      if (response.success) {
        let fetchedData = applyClientSideListTransforms(response.data || [], ctx);
        data.value = [...fetchedData];

        applyPaginationFromResponse(response, fetchedData.length, ctx.params.page);

        const totalRecords = Number(
          response.pagination?.totalRecords ?? response.meta?.total ?? pagination.value.totalRecords ?? 0
        ) || 0;

        await nextTick();
        if (listDataEpoch.value !== epochForThisReplace) return;

        // Prefer server aggregates when present (correct for full result set + paged/infinite scroll)
        if (response.listStatistics && typeof response.listStatistics === 'object') {
          statistics.value = {
            ...response.listStatistics,
            totalPeople: response.listStatistics.totalPeople ?? totalRecords,
            totalOrganizations: response.listStatistics.totalOrganizations ?? totalRecords
          };
        } else if (ctx.moduleConfig?.statistics?.computeFunction) {
          statistics.value = ctx.moduleConfig.statistics.computeFunction(data.value, authStore.user?._id, {
            totalRecords
          });
        } else if (response.statistics) {
          statistics.value = response.statistics;
        }
      } else {
        console.warn('[ModuleList] API response not successful:', {
          success: response.success,
          response: response
        });
        if (!soft) {
          data.value = [];
          const mc = getModuleListConfig(props.moduleKey);
          if (mc?.statistics?.computeFunction) {
            statistics.value = mc.statistics.computeFunction([], authStore.user?._id, { totalRecords: 0 });
          } else {
            statistics.value = {};
          }
        }
      }
    } catch (error) {
      if (signal.aborted) return;
      if (listDataEpoch.value !== epochForThisReplace) return;
      console.error('[ModuleList] Error fetching data:', error);
      if (!soft) {
        data.value = [];
        const moduleConfigErr = getModuleListConfig(props.moduleKey);
        if (moduleConfigErr?.statistics?.computeFunction) {
          statistics.value = moduleConfigErr.statistics.computeFunction([], authStore.user?._id, {
            totalRecords: 0
          });
        } else {
          statistics.value = {};
        }
      }
    } finally {
      if (myReplaceSeq === replaceSeq) {
        dataLoading.value = false;
        if (preserveSession) {
          bumpSessionRestoreTick();
        }
      }
    }
  };

  replaceInFlight = run();
  try {
    await replaceInFlight;
  } finally {
    replaceInFlight = null;
  }
}

/** List GET params for server-side bulk delete (select all matching). */
function buildListQueryForBulkDelete() {
  const ctx = buildListFetchContext(1);
  const params = { ...ctx.params };
  delete params.page;
  delete params.limit;
  if (props.moduleKey === 'people' && props.peopleContext && props.peopleContext !== 'ALL') {
    params.peopleContext = props.peopleContext;
  }
  return params;
}

async function fetchListAppend() {
  if (!listDefinition.value) return;

  if (loadingMore.value || dataLoading.value) return;

  const listPage = normalizeListPagination(pagination.value);
  if (!listPage.hasMore) return;

  const parentEpoch = listDataEpoch.value;
  const myAppendSeq = ++appendSeq;

  appendAbortController?.abort();
  appendAbortController = new AbortController();
  const signal = appendAbortController.signal;

  loadingMore.value = true;

  const requestedPage = listPage.currentPage + 1;

  try {
    const ctx = buildListFetchContext(requestedPage);
    const response = await apiClient.get(ctx.endpoint, {
      params: ctx.params,
      signal
    });

    if (listDataEpoch.value !== parentEpoch) return;
    if (signal.aborted) return;

    if (response.success) {
      const fetchedData = applyClientSideListTransforms(response.data || [], ctx);
      data.value = mergeAppendRowsById(data.value, fetchedData);

      applyPaginationFromResponse(response, fetchedData.length, requestedPage);

      // Do not replace card statistics here: API `statistics` uses different keys than ListView
      // (e.g. totalContacts vs totalPeople), which zeroed the UI. Counts are for the full query
      // and stay valid from the initial replace fetch.
    }
  } catch (error) {
    if (signal.aborted) return;
    if (listDataEpoch.value !== parentEpoch) return;
    console.error('[ModuleList] Error loading more:', error);
  } finally {
    if (myAppendSeq === appendSeq) {
      loadingMore.value = false;
    }
  }
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.append] - load next page
 * @param {boolean} [opts.preserveSession] - keep scroll/page session (no clear)
 * @param {boolean} [opts.soft] - do not empty rows before replace fetch
 * @param {boolean} [opts.reactivate] - tab return: restore pages/scroll only, no refetch
 */
const fetchData = async (opts = {}) => {
  if (opts.append === true) {
    return fetchListAppend();
  }
  if (opts.reactivate) {
    await applyListSessionOnActivate();
    bumpSessionRestoreTick();
    return;
  }
  if (!opts.preserveSession) {
    clearListSessionState();
  }
  const hardClear = !opts.soft && !opts.preserveSession && !opts.reactivate;
  return fetchListReplace({ ...opts, hardClear });
};

const handleLoadMore = () => {
  fetchData({ append: true });
};

// Handle actions
const handleCreate = () => {
  // Always emit 'create' event to let parent component handle it (e.g., open drawer)
  // Don't navigate to create routes - create actions should use drawers/modals
  emit('create');
};

const handleImport = () => {
  const importAction = listDefinition.value?.primaryActions?.find(a => a.type === 'import');
  if (importAction?.route) {
    handleAction(importAction.route);
  } else {
    emit('import');
  }
};

const handleExport = () => {
  const exportAction = listDefinition.value?.primaryActions?.find(a => a.type === 'export');
  if (exportAction?.route) {
    handleAction(exportAction.route);
  } else {
    emit('export');
  }
};

const handleAction = (route) => {
  if (!route) return;
  const normalizedRoute = String(route || '').trim().toLowerCase();
  const isCreateRoute = /\/new\/?$/.test(normalizedRoute);
  if (isCreateRoute) {
    // Create flows should stay in the current tab so the drawer opens in-place.
    router.push(route);
    return;
  }
  openTab(route, {
    title: route.split('/').pop(),
    background: false,
    insertAdjacent: true
  });
};

// Handle events
const handleSearchQueryUpdate = (query) => {
  searchQuery.value = query;
  pagination.value.currentPage = 1;
  clearListSessionState();
  emit('search-changed', query);
  fetchData();
};

// Helper function to check if filters match a saved view (with normalization)
// Shared between handleFiltersUpdate and handleStatClick
const filtersMatchView = (currentFilters, viewFilters, currentUserId) => {
  // Get filter keys for both - include null and boolean values as they are valid filter values
  const viewFilterKeys = Object.keys(viewFilters).filter(k => {
    const v = viewFilters[k];
    return v !== undefined && v !== '';
  });
  const currentFilterKeys = Object.keys(currentFilters).filter(k => {
    const v = currentFilters[k];
    return v !== undefined && v !== '';
  });
  
  // Must have same number of filters
  if (viewFilterKeys.length !== currentFilterKeys.length) {
    return false;
  }
  
  // Must have the same filter keys
  const viewKeysSet = new Set(viewFilterKeys);
  const currentKeysSet = new Set(currentFilterKeys);
  if (viewKeysSet.size !== currentKeysSet.size) {
    return false;
  }
  // Check that all keys match
  for (const key of viewKeysSet) {
    if (!currentKeysSet.has(key)) {
      return false;
    }
  }
  
  // Check if all filter values match (with normalization for assignedTo)
  return viewFilterKeys.every(key => {
    const viewValue = viewFilters[key];
    const currentValue = currentFilters[key];
    
    // Normalize assignedTo for comparison
    // 'me' should match currentUserId
    // 'unassigned' should match null
    if (key === 'assignedTo') {
      // Normalize 'me' to currentUserId for comparison
      if (currentValue === 'me' && viewValue === currentUserId) {
        return true;
      }
      // Normalize 'unassigned' to null for comparison
      if (currentValue === 'unassigned' && viewValue === null) {
        return true;
      }
      // Normalize currentUserId to 'me' for comparison (reverse)
      if (currentValue === currentUserId && viewValue === 'me') {
        return true;
      }
      // Normalize null to 'unassigned' for comparison (reverse)
      if (currentValue === null && viewValue === 'unassigned') {
        return true;
      }
    }
    
    // Handle null comparison - null is a valid filter value
    if (viewValue === null) {
      return currentValue === null;
    }
    if (currentValue === null) {
      return viewValue === null;
    }
    
    // Handle boolean comparison - boolean values should be compared directly
    if (typeof viewValue === 'boolean' || typeof currentValue === 'boolean') {
      return viewValue === currentValue;
    }
    
    // String comparison for non-null, non-boolean values
    return String(viewValue) === String(currentValue);
  });
};

const handleFiltersUpdate = async (newFilters) => {
  // Clean up old participation filter keys if they exist (migration from old format)
  if (props.moduleKey === 'people') {
    // Remove old participationApp and participationRole filters if new participation filter exists
    if (newFilters.participation) {
      delete newFilters.participationApp;
      delete newFilters.participationRole;
    }
  }
  
  // Create a new object to ensure reactivity
  filters.value = { ...newFilters };
  pagination.value.currentPage = 1;
  clearListSessionState();

  emit('filters-changed', filters.value);
  
  // Wait for next tick to ensure filters are properly set before checking saved views
  await nextTick();
  
  // Handle saved view state for all modules (registry config or default views)
  // All modules get default system views via getSystemViews, so always handle saved view state
  const moduleConfig = getModuleListConfig(props.moduleKey);
  const currentUserId = authStore.user?._id;
  
  // Only handle saved view state if module has system views (from registry or generated)
  if (savedViews.value.length > 0) {
    
    // Check if filters are empty (all cleared)
    // Include null values - they are valid filter values (e.g., organization: null)
    // Boolean true/false are also valid filter values
    const hasAnyFilters = Object.keys(newFilters).some(key => {
      const value = newFilters[key];
      return value !== undefined && value !== '';
    });
    
    if (!hasAnyFilters) {
      // Filters cleared - return to "All" view
      activeSavedViewId.value = 'all';
    } else {
      // Check if current filters match any saved view
      // First check the active view, then check all views
      let matchedView = null;
      
      if (activeSavedViewId.value) {
        const activeView = savedViews.value.find(v => v.id === activeSavedViewId.value);
        if (activeView && filtersMatchView(newFilters, activeView.filters, currentUserId)) {
          matchedView = activeView;
        }
      }
      
      // If active view doesn't match, check all views
      if (!matchedView) {
        matchedView = savedViews.value.find(view => filtersMatchView(newFilters, view.filters, currentUserId));
      }
      
      if (matchedView) {
        activeSavedViewId.value = matchedView.id;
      } else {
        activeSavedViewId.value = null;
      }
    }
  }
  
  // Fetch data with updated filters
  fetchData();
};

// Handle stat click - apply derived filters
const handleStatClick = (statItem) => {
  const moduleConfig = getModuleListConfig(props.moduleKey);
  if (!moduleConfig) return;
  
  const currentUserId = authStore.user?._id;
  const newFilters = {};
  
  if (props.moduleKey === 'people') {
    // Map stat key to filter for People module
    switch (statItem.key) {
      case 'totalPeople':
        // Clear all filters - show all people
        break; // newFilters stays empty
        
      case 'assignedToMe':
        // Filter: assignedTo = currentUser
        // Use 'me' string so it matches the filter dropdown option
        newFilters.assignedTo = 'me';
        break;
        
      case 'unassigned':
        // Filter: assignedTo = null (unassigned)
        newFilters.assignedTo = 'unassigned';
        break;
        
      case 'withOrganization':
        // Filter: organization != null
        newFilters.organization = 'has';
        break;
        
      case 'withoutOrganization':
        // Filter: organization = null
        newFilters.organization = null;
        break;
    }
  } else if (props.moduleKey === 'organizations') {
    // Map stat key to filter for Organizations module
    switch (statItem.key) {
      case 'totalOrganizations':
        // Clear all filters - show all organizations
        break; // newFilters stays empty
        
      case 'assignedToMe':
        // Filter: assignedTo = currentUser
        // Use 'me' string so it matches the filter dropdown option
        newFilters.assignedTo = 'me';
        break;
        
      case 'unassigned':
        // Filter: assignedTo = null (unassigned)
        newFilters.assignedTo = 'unassigned';
        break;
        
      case 'activeOrganizations':
        // Filter: isActive = true
        newFilters.isActive = true;
        break;
        
      case 'trialOrganizations':
        // Filter: subscription.status = 'trial' or subscription.tier = 'trial'
        newFilters.tier = 'trial';
        break;
    }
  } else if (props.moduleKey === 'tasks') {
    // Map stat key to filter for Tasks module
    switch (statItem.key) {
      case 'totalTasks':
        // Clear all filters - show all tasks
        break; // newFilters stays empty
        
      case 'assignedToMe':
        // Filter: assignedTo = currentUser
        // Use 'me' string so it matches the filter dropdown option
        newFilters.assignedTo = 'me';
        break;
        
      case 'completed':
        // Filter: status = 'completed'
        newFilters.status = 'completed';
        break;
        
      case 'overdue':
        // Filter: overdue = true (this will be handled by the API)
        newFilters.overdue = true;
        break;
    }
  } else if (props.moduleKey === 'items') {
    // Map stat key to filter for Items module
    switch (statItem.key) {
      case 'totalItems':
        // Clear all filters - show all items
        break; // newFilters stays empty
        
      case 'activeItems':
        newFilters.lifecycle_state = 'Active';
        break;

      case 'draftItems':
        newFilters.lifecycle_state = 'Draft';
        break;

      case 'discontinuedItems':
        newFilters.lifecycle_state = 'Discontinued';
        break;
        
      case 'products':
        // Filter: item_type = 'Product'
        newFilters.item_type = 'Product';
        break;
        
      case 'services':
        // Filter: item_type = 'Service'
        newFilters.item_type = 'Service';
        break;
    }
  } else if (props.moduleKey === 'events') {
    // Map stat key to filter for Events module
    // The API expects startDateTime and endDateTime as ISO date strings
    // It will build MongoDB queries: startDateTime.$gte and startDateTime.$lte
    switch (statItem.key) {
      case 'totalEvents':
        // Clear all filters - show all events
        break; // newFilters stays empty
        
      case 'upcoming':
        // Filter: startDateTime >= now
        // API will interpret startDateTime as $gte
        newFilters.startDateTime = new Date().toISOString();
        break;
        
      case 'past':
        // Filter: startDateTime < now
        // Note: API uses endDateTime for $lte on startDateTime field
        // For "past", we need events where startDateTime < now
        // We'll use a workaround: set endDateTime to now (but this gives $lte, not $lt)
        // Better approach: let the API handle this or use a different filter
        // For now, we'll skip this stat click or handle it client-side
        // TODO: Add API support for $lt operator or handle past events differently
        break;
        
      case 'myEvents':
        // Filter: eventOwnerId = currentUser
        // Use 'me' string so it matches the filter dropdown option
        newFilters.eventOwnerId = 'me';
        break;
        
      case 'today':
        // Filter: startDateTime is today
        // API will use startDateTime for $gte and endDateTime for $lte
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        newFilters.startDateTime = today.toISOString();
        newFilters.endDateTime = tomorrow.toISOString();
        break;
        
      case 'thisWeek':
        // Filter: startDateTime is this week
        const nowWeek = new Date();
        const startOfWeek = new Date(nowWeek);
        startOfWeek.setDate(nowWeek.getDate() - nowWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        newFilters.startDateTime = startOfWeek.toISOString();
        newFilters.endDateTime = endOfWeek.toISOString();
        break;
    }
  } else if (props.moduleKey === 'quotes') {
    switch (statItem.key) {
      case 'openValue':
      case 'openQuotes':
        // Open spans multiple statuses; clear filters (same pattern as deals pipeline stat)
        break;

      case 'acceptedValue':
        newFilters.status = 'Accepted';
        break;

      case 'myQuotes':
        newFilters.ownerId = 'me';
        break;
    }
  }
  
  // Use handleFiltersUpdate to properly sync filters with ListView
  // This ensures ListView's internal filters reactive object is updated
  // and hasFiltersApplied correctly detects the filters for the title
  handleFiltersUpdate(newFilters);
};

// Handle saved views updated (custom views changed)
const handleSavedViewsUpdated = (customViews) => {
  const moduleConfig = getModuleListConfig(props.moduleKey);
  if (!moduleConfig?.systemViews) return;
  
  // Rebuild savedViews with system views + custom views
  const systemViews = moduleConfig.systemViews.map(view => ({
    id: view.id,
    label: view.name,
    filters: view.filters,
    isDefault: view.isDefault === true
  }));
  
  savedViews.value = [...systemViews, ...customViews];
};

// Handle saved view selection
const handleSavedViewSelected = (view) => {
  const moduleConfig = getModuleListConfig(props.moduleKey);
  if (!moduleConfig) {
    return;
  }
  
  // Set active saved view (will be persisted via watch)
  activeSavedViewId.value = view?.id || null;
  
  if (!view) {
    // Clear view selection - use handleFiltersUpdate to ensure proper sync
    handleFiltersUpdate({});
    return;
  }
  
  // Apply view filters
  let viewFilters = view.filters ? { ...view.filters } : {};
  const currentUserId = authStore.user?._id;
  
  // Handle special date filters for events module (upcoming/past)
  if (props.moduleKey === 'events') {
    if (view.id === 'upcoming') {
      // Upcoming: startDateTime >= now
      viewFilters = { startDateTime: new Date().toISOString() };
    } else if (view.id === 'past') {
      // Past: startDateTime < now
      // API uses endDateTime to set startDateTime.$lte
      // Subtract 1 second to ensure we get events strictly before now
      const now = new Date();
      now.setSeconds(now.getSeconds() - 1);
      viewFilters = { endDateTime: now.toISOString() };
    } else if (viewFilters._special) {
      // Remove special marker if present
      delete viewFilters._special;
    }
  }
  
  // Normalize filters using registry function if available
  const normalizedFilters = moduleConfig.normalizeViewFilters
    ? moduleConfig.normalizeViewFilters(viewFilters, currentUserId)
    : viewFilters;
  
  // Use handleFiltersUpdate to properly sync filters with ListView and trigger fetch
  handleFiltersUpdate(normalizedFilters);
};

const handleSetDefaultView = (viewId) => {
  if (!viewId || !hasModuleListConfig(props.moduleKey)) return;
  const defaultViewStorageKey = `arivu-listview-${props.moduleKey}-default-view`;
  try {
    localStorage.setItem(defaultViewStorageKey, viewId);
    defaultViewId.value = viewId;
  } catch (error) {
    console.warn('[ModuleList] Failed to save default view:', error);
  }
};

const handleSortUpdate = ({ sortField: key, sortOrder: order }) => {
  sortField.value = normalizePeopleListSortField(key);
  sortOrder.value = order;
  pagination.value.currentPage = 1;
  clearListSessionState();
  fetchData();
};

watch(
  () => data.value.length,
  async (len, prevLen) => {
    if (len > 0 && pendingListSessionRestore.value) {
      await restoreListSessionPages();
      return;
    }
    if (len > 0 && prevLen === 0 && getListSession(listSessionKey.value)) {
      await restoreListSessionAfterFetch();
    }
  }
);

const handlePaginationUpdate = (p) => {
  pagination.value.currentPage = p.currentPage;
  if (p.limit) {
    pagination.value.limit = p.limit;
  }
  fetchData();
};

const handleRowClick = (row) => {
  const viewAction = listDefinition.value?.rowActions?.find(a => a.type === 'view');
  if (viewAction?.route) {
    let route = viewAction.route.replace(':id', row._id);
    const mod = (props.moduleKey || '').toLowerCase();
    const ak = props.appKey && String(props.appKey).trim();
    if (ak && (mod === 'people' || mod === 'organizations')) {
      const sep = route.includes('?') ? '&' : '?';
      route = `${route}${sep}appKey=${encodeURIComponent(ak)}`;
    }
    openTab(route, {
      title: row.name || row.title || row.first_name || 'Detail',
      background: false,
      insertAdjacent: true
    });
  } else {
    emit('row-click', row);
  }
};

const handleEdit = (row) => {
  // For tasks, always emit 'edit' so parent can open the edit drawer
  if (props.moduleKey === 'tasks') {
    emit('edit', row);
    return;
  }
  const editAction = listDefinition.value?.rowActions?.find(a => a.type === 'edit');
  if (editAction?.route) {
    const route = editAction.route.replace(':id', row._id);
    openTab(route, {
      title: `Edit ${row.name || row.title || 'Item'}`,
      background: false,
      insertAdjacent: true
    });
  } else {
    emit('edit', row);
  }
};

function listDeleteApiBase() {
  return getModuleRecordCrudPathBase(props.moduleKey, {
    appKey: props.appKey,
    routePath: String(route.path || '')
  });
}

function isBulkSelectionPayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && 'mode' in value;
}

function rowsFromIds(ids) {
  return ids.map((id) => ({ _id: id }));
}

const handleDelete = async (row) => {
  if (parentHandlesDelete) {
    emit('delete', row);
    return;
  }

  const rowId = row?._id || row?.id || row;
  if (!rowId || !props.moduleKey) return;

  try {
    await apiClient.delete(`${listDeleteApiBase()}/${rowId}`);
    await fetchData();
  } catch (error) {
    console.error(`[ModuleList] Failed to delete ${props.moduleKey} record:`, error);
    const errorMessage = error?.response?.data?.message || error?.message || 'Delete failed';
    alert(errorMessage);
  }
};

const handleBulkAction = async (action, payloadOrRows) => {
  const isDeleteAction = action === 'bulk-delete' || action === 'delete';

  if (isDeleteAction) {
    startBulkDelete({
      moduleKey: props.moduleKey,
      selection: isBulkSelectionPayload(payloadOrRows) ? payloadOrRows : null,
      pageIds: Array.isArray(payloadOrRows)
        ? payloadOrRows.map((r) => String(r?._id || r?.id || r?.eventId || r)).filter(Boolean)
        : null,
      listQuery: buildListQueryForBulkDelete(),
      options: { appKey: props.appKey, routePath: String(route.path || '') },
      onComplete: (outcome) => {
        void (async () => {
          if (outcome.cancelled) {
            if (outcome.deletedCount > 0) await fetchData();
            return;
          }
          const { deletedCount, failedCount, firstError, requestedCount } = outcome;
          const totalAttempted = deletedCount + failedCount;
          const hadSelection = Number(requestedCount || 0) > 0;
          if (!props.moduleKey || (totalAttempted === 0 && !hadSelection)) {
            alert(t('common.listBulkDeleteNoSelection'));
            return;
          }
          if (totalAttempted === 0 && hadSelection) {
            alert(
              t('common.listBulkDeleteNoMatches') ||
              'No records matched your selection for deletion. Refresh the list and try again.'
            );
            return;
          }
          if (requestedCount > 0 && deletedCount + failedCount < requestedCount) {
            alert(
              t('common.listBulkDeleteIncomplete', {
                deleted: deletedCount,
                total: requestedCount
              }) ||
              `Deleted ${deletedCount} of ${requestedCount} selected records. Refresh the list or retry.`
            );
          }
          if (failedCount > 0) {
            const errorMessage =
              firstError?.response?.data?.message ||
              firstError?.message ||
              'Bulk delete failed';
            console.error(`[ModuleList] Failed bulk delete for ${props.moduleKey}:`, firstError);
            alert(
              failedCount === totalAttempted
                ? errorMessage
                : `Failed to delete ${failedCount} of ${totalAttempted} records. ${errorMessage}`
            );
            if (deletedCount > 0) await fetchData();
            return;
          }
          await fetchData();
        })();
      },
    });
    return;
  }

  if (parentHandlesBulkAction) {
    if (isBulkSelectionPayload(payloadOrRows) && payloadOrRows.mode === 'page') {
      emit('bulk-action', action, rowsFromIds(payloadOrRows.selectedIds || []));
    } else {
      emit('bulk-action', action, payloadOrRows);
    }
    return;
  }

  emit('bulk-action', action, payloadOrRows);
};

// Only rebuild when login state or user identity changes — not on every reactive touch of authStore.user
watch(
  () => (authStore.isAuthenticated ? (authStore.user?._id ?? '') : ''),
  (userId) => {
    if (userId && authStore.user && authStore.isAuthenticated) {
      buildList();
    }
  },
  { immediate: true }
);

// Watch for moduleKey/appKey changes
watch(() => [props.moduleKey, props.appKey], () => {
  if (authStore.user && authStore.isAuthenticated) {
    buildList();
  }
});

// Persist active saved view to localStorage (modules with registry config)
watch(() => activeSavedViewId.value, (newValue) => {
  if (hasModuleListConfig(props.moduleKey)) {
    const savedViewStorageKey = `arivu-listview-${props.moduleKey}-active-view`;
    if (newValue) {
      localStorage.setItem(savedViewStorageKey, newValue);
    } else {
      localStorage.removeItem(savedViewStorageKey);
    }
  }
});

// Initial build is handled by auth user watcher (immediate: true) — no duplicate buildList() on mount

// Expose methods and data for parent components
defineExpose({
  refresh: fetchData,
  refreshAfterImport: refreshListAfterImport,
  /** Tab return via keep-alive: restore lazy-loaded pages + scroll without refetching page 1 */
  reactivate: () => fetchData({ reactivate: true }),
  filters: filters,
  searchQuery: searchQuery,
  getFilters: () => filters.value,
  getSearchQuery: () => searchQuery.value,
  getCurrentRows: () => (Array.isArray(data.value) ? data.value : []),
  setFilters: (newFilters) => handleFiltersUpdate(newFilters)
});
</script>


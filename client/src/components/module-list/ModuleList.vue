<template>
  <div v-if="showListShellSkeleton">
    <ListPageSkeleton :body-rows="12" />
  </div>

  <div v-else-if="listDefinition">
    <!-- Empty State (from definition) -->
    <div v-if="shouldShowEmptyState" class="flex items-center justify-center min-h-[60vh]">
      <div class="text-center max-w-md">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ fullPageEmptyTitle }}
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          {{ fullPageEmptyMessage }}
        </p>
        <button
          v-if="listDefinition.emptyState.primaryAction"
          @click="handleAction(listDefinition.emptyState.primaryAction.route)"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          {{ fullPageEmptyActionLabel }}
        </button>
      </div>
    </div>

    <!-- List View -->
    <ListView
      v-else
      skip-mount-fetch
      :title="listPageTitle"
      :description="listDefinition.description"
      :module-key="listDefinition.moduleKey"
      :view-mode="viewMode"
      :create-label="listCreateLabel"
      :search-placeholder="listSearchPlaceholder"
      :data="data"
      :columns="adaptedColumns"
      :filter-fields="adaptedFilterFields"
      :loading="listViewLoading"
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
      :external-filters="filters"
      :parent-search-query="searchQuery"
      :boost-visible-column-keys="boostVisibleColumnKeys"
      :table-id="`${listDefinition.moduleKey}-table`"
      :scroll-session-key="listSessionKey"
      row-key="_id"
      :empty-title="listEmptyTitle"
      :empty-message="listEmptyMessage"
      @create="handleCreate"
      @import="handleImport"
      @export="handleExport"
      @search-submit="handleSearchQueryUpdate"
      @update:filters="handleFiltersUpdate"
      @update:sort="handleSortUpdate"
      @update:pagination="handlePaginationUpdate"
      @saved-view-selected="handleSavedViewSelected"
      @set-default-view="handleSetDefaultView"
      @saved-views-updated="handleSavedViewsUpdated"
      @stat-click="handleStatClick"
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
import {
  MODULE_LIST_QUICK_TRUST_MS,
  MODULE_LIST_STALE_TTL_MS,
  clearModuleListRecheck,
  compareModuleListProbe,
  consumeModuleListDirty,
  extractMaxUpdatedAtMs,
  getModuleListFingerprint,
  peekModuleListRecheck,
  recordModuleListFingerprint,
} from '@/utils/moduleListFreshness';
import { fetchModuleListMeta, supportsServerListMeta } from '@/utils/moduleListMetaApi';
import { useI18n } from 'vue-i18n';
import {
  resolveListColumnLabel,
  resolveListCreateLabel,
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
import { useOnboarding } from '@/composables/useOnboarding';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';
import { getAppRegistry } from '@/utils/getAppRegistry';
import { createPermissionSnapshot } from '@/types/permission-snapshot.types';
import { EmptyStateType } from '@/types/empty-state.types';
import ListView from '@/components/common/ListView.vue';
import apiClient from '@/utils/apiClient';
import { getStateFields } from '@/platform/fields/peopleFieldModel';
import { getParticipation } from '@/utils/getParticipation';
import {
  resolvePeopleListParticipationColumnLabel,
} from '@/utils/peopleParticipationUi';
import { getModuleListConfig, hasModuleListConfig, getSystemViews, resolvePeopleListAppContext } from '@/platform/modules/moduleListRegistry';
import {
  buildFilterFieldsFromModuleFields,
  buildListColumnsFromModuleFields,
} from '@/utils/buildListColumnsFromModuleFields';
import { normalizeListPagination } from '@/utils/normalizeListPagination';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import { allSettledWithConcurrency } from '@/utils/allSettledWithConcurrency';
import { startBulkDelete } from '@/utils/runBulkDelete';
import { startBulkUpdate } from '@/utils/runBulkUpdate';
import { yieldToUi } from '@/utils/uiYield';
import { resolveListSearchTerm } from '@/utils/searchRelevance';
import {
  clearListSession,
  getListSession,
  getListSessionKey,
  LIST_SESSION_RESTORE_KEY,
  LIST_SESSION_SCROLL_CONCEAL_KEY,
  LIST_SESSION_PAGES_READY_KEY,
  patchListSession
} from '@/utils/listScrollSession';
import {
  fetchCustomSavedViews,
  loadActiveSavedViewId,
  persistCustomSavedViews,
  saveActiveSavedViewId,
} from '@/utils/listViewSavedViewsStorage';

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
  /** Passed to ListView/TableView: 'numbered-hover' shows row # until hover (desktop);
   *  'checkbox' always shows boxes */
  selectionColumnVariant: {
    type: String,
    default: 'numbered-hover',
    validator: (v) => !v || v === 'checkbox' || v === 'numbered-hover'
  }
});

const emit = defineEmits(['create', 'import', 'export', 'row-click', 'edit', 'delete', 'bulk-action', 'filters-changed', 'search-changed', 'kanban-settings-changed', 'stats-visibility-changed', 'people-context-changed']);

/** Capture at setup — getCurrentInstance() is null inside async event handlers */
const setupInstance = getCurrentInstance();
const parentHandlesBulkAction = typeof setupInstance?.vnode?.props?.onBulkAction === 'function';
const parentHandlesDelete = typeof setupInstance?.vnode?.props?.onDelete === 'function';

const route = useRoute();
const router = useRouter();

/** Paginated list GET runs only in list view — kanban/calendar parents fetch their own dataset. */
function shouldFetchListDataForMode(mode) {
  if (mode == null || mode === '') return true;
  return String(mode).toLowerCase() === 'list';
}

function shouldFetchListData() {
  return shouldFetchListDataForMode(props.viewMode);
}

/** Stats sample size when list rows are not loaded (kanban/calendar). */
const KANBAN_STATS_SAMPLE_LIMIT = 500;

function statisticsFetchLimit(moduleConfig) {
  if (moduleConfig?.statistics?.computeFunction) return KANBAN_STATS_SAMPLE_LIMIT;
  return 1;
}

/** True after the first list replace fetch completes (success or failure). */
const listInitialFetchComplete = ref(false);

/** Keep table in loading state until first fetch starts and finishes — avoids empty-state flash. */
const listViewLoading = computed(() => {
  if (dataLoading.value) return true;
  if (statisticsLoading.value && !shouldFetchListData()) return true;
  if (
    !listInitialFetchComplete.value
    && shouldFetchListData()
    && listDefinition.value
  ) {
    return true;
  }
  return false;
});

/** Only block the whole page on first load — not when returning from another tab */
const showListShellSkeleton = computed(
  () => loading.value && !listDefinition.value
);

const pendingListSessionRestore = ref(null);
const sessionRestoreTick = ref(0);
const listSessionScrollConcealing = ref(false);
const listSessionPagesReady = ref(true);
provide(LIST_SESSION_RESTORE_KEY, sessionRestoreTick);
provide(LIST_SESSION_SCROLL_CONCEAL_KEY, listSessionScrollConcealing);
provide(LIST_SESSION_PAGES_READY_KEY, listSessionPagesReady);

function beginListSessionRestore() {
  listSessionPagesReady.value = false;
  listSessionScrollConcealing.value = true;
}

function completeListSessionRestore() {
  listSessionPagesReady.value = true;
  bumpSessionRestoreTick();
}

function sessionNeedsScrollConceal(session) {
  if (!session) return false;
  const targetPage = Math.max(1, Number(session.currentPage) || 1);
  const scrollTop = Number(session.scrollTop);
  return targetPage > 1 || (Number.isFinite(scrollTop) && scrollTop > 0);
}

function finishListSessionPageRestore() {
  const session = getListSession(listSessionKey.value);
  const scrollTop = Number(session?.scrollTop);
  if (!Number.isFinite(scrollTop) || scrollTop <= 0) {
    listSessionScrollConcealing.value = false;
  }
}

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
  completeListSessionRestore();
  finishListSessionPageRestore();
}

async function applyListSessionOnActivate() {
  const session = getListSession(listSessionKey.value);
  if (!session) return;

  const targetPage = Math.max(1, Number(session.currentPage) || 1);
  const currentPage = normalizeListPagination(pagination.value).currentPage;

  if (data.value.length > 0 && currentPage >= targetPage) {
    completeListSessionRestore();
    finishListSessionPageRestore();
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

function onBulkUpdateCompleteForList(event) {
  onBulkDeleteCompleteForList(event);
}

onMounted(() => {
  window.addEventListener('litedesk:import-complete', onImportCompleteForList);
  window.addEventListener('litedesk:bulk-delete-complete', onBulkDeleteCompleteForList);
  window.addEventListener('litedesk:bulk-update-complete', onBulkUpdateCompleteForList);
});

onBeforeUnmount(() => {
  window.removeEventListener('litedesk:import-complete', onImportCompleteForList);
  window.removeEventListener('litedesk:bulk-delete-complete', onBulkDeleteCompleteForList);
  window.removeEventListener('litedesk:bulk-update-complete', onBulkUpdateCompleteForList);
});

onDeactivated(() => {
  patchListSession(listSessionKey.value, {
    currentPage: normalizeListPagination(pagination.value).currentPage
  });
  listSessionScrollConcealing.value = false;
  listSessionPagesReady.value = true;

  replaceAbortController?.abort();
  appendAbortController?.abort();
  appendAbortController = null;
  loadingMore.value = false;
  dataLoading.value = false;
});

async function restoreListSessionAfterFetch() {
  const session = getListSession(listSessionKey.value);
  if (!session) return;

  const targetPage = Math.max(1, Number(session.currentPage) || 1);
  if (normalizeListPagination(pagination.value).currentPage < targetPage) {
    pendingListSessionRestore.value = session;
    await restoreListSessionPages();
  } else {
    completeListSessionRestore();
    finishListSessionPageRestore();
  }
}

async function initialListFetch() {
  const session = getListSession(listSessionKey.value);
  const hasActiveQuery =
    listParamsHaveActiveFilters(buildListFetchContext(1).params)
    || Boolean(searchQuery.value && String(searchQuery.value).trim());

  if (!session || hasActiveQuery) {
    await fetchListReplace();
    if (session && !hasActiveQuery) {
      await restoreListSessionAfterFetch();
    }
    return;
  }

  pagination.value.currentPage = 1;
  await fetchListReplace({ preserveSession: true, soft: true });
  await restoreListSessionAfterFetch();
}

/** Dedupe buildList + onActivated both calling initialListFetch on first keep-alive mount. */
let initialListFetchPromise = null;

function scheduleInitialListFetch() {
  if (initialListFetchPromise) {
    return initialListFetchPromise;
  }
  initialListFetchPromise = initialListFetch()
    .catch((error) => {
      console.error('[ModuleList] Initial data fetch failed:', error);
    })
    .finally(() => {
      initialListFetchPromise = null;
    });
  return initialListFetchPromise;
}

/** Dedupe concurrent statistics-only fetches for kanban/calendar modes. */
let initialStatisticsFetchPromise = null;

function scheduleInitialStatisticsFetch() {
  if (initialStatisticsFetchPromise) {
    return initialStatisticsFetchPromise;
  }
  initialStatisticsFetchPromise = fetchListStatistics()
    .catch((error) => {
      console.error('[ModuleList] Initial statistics fetch failed:', error);
    })
    .finally(() => {
      initialStatisticsFetchPromise = null;
    });
  return initialStatisticsFetchPromise;
}

function recordListFingerprintFromState() {
  recordModuleListFingerprint(props.moduleKey, props.appKey, {
    totalRecords: Number(pagination.value.totalRecords ?? 0) || 0,
    maxUpdatedAt: extractMaxUpdatedAtMs(data.value),
  });
}

async function probeListDataChanged() {
  try {
    const ctx = buildListFetchContext(1);
    const metaParams = { ...ctx.params };
    delete metaParams.page;
    delete metaParams.limit;

    if (supportsServerListMeta(props.moduleKey)) {
      const probe = await fetchModuleListMeta(props.moduleKey, metaParams);
      if (probe) {
        const fingerprint = getModuleListFingerprint(props.moduleKey, props.appKey);
        return compareModuleListProbe(fingerprint, probe) !== 'unchanged';
      }
    }

    const response = await apiClient.get(ctx.endpoint, {
      params: {
        ...ctx.params,
        page: 1,
        limit: 1,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
      cache: 'no-store',
    });
    if (!response?.success) return true;

    const rows = applyClientSideListTransforms(response.data || [], ctx);
    const probeTotal = Number(
      response.pagination?.totalRecords
      ?? response.meta?.totalRecords
      ?? response.meta?.total
      ?? 0
    );
    const probe = {
      totalRecords: Number.isFinite(probeTotal) ? probeTotal : 0,
      maxUpdatedAt: extractMaxUpdatedAtMs(rows),
    };

    const fingerprint = getModuleListFingerprint(props.moduleKey, props.appKey);
    return compareModuleListProbe(fingerprint, probe) !== 'unchanged';
  } catch (error) {
    console.warn('[ModuleList] Freshness probe failed:', error);
    return false;
  }
}

async function maybeRefreshListOnActivate() {
  if (!shouldFetchListData()) {
    if (consumeModuleListDirty(props.moduleKey, props.appKey)) {
      await fetchListStatistics();
      return true;
    }
    return false;
  }

  if (consumeModuleListDirty(props.moduleKey, props.appKey)) {
    await fetchData({ preserveSession: true, soft: true });
    return true;
  }

  if (!peekModuleListRecheck(props.moduleKey, props.appKey)) {
    return false;
  }

  const fingerprint = getModuleListFingerprint(props.moduleKey, props.appKey);
  const age = Date.now() - (fingerprint?.fetchedAt ?? 0);

  if (age < MODULE_LIST_QUICK_TRUST_MS) {
    clearModuleListRecheck(props.moduleKey, props.appKey);
    return false;
  }

  if (!fingerprint || age >= MODULE_LIST_STALE_TTL_MS) {
    clearModuleListRecheck(props.moduleKey, props.appKey);
    await fetchData({ preserveSession: true, soft: true });
    return true;
  }

  const changed = await probeListDataChanged();
  clearModuleListRecheck(props.moduleKey, props.appKey);
  if (!changed) return false;

  await fetchData({ preserveSession: true, soft: true });
  return true;
}

onActivated(async () => {
  // Aborted in-flight fetch when the tab was hidden can leave dataLoading stuck true.
  if (data.value.length > 0) {
    dataLoading.value = false;
  }

  if (consumeImportListRefreshPending(props.moduleKey)) {
    listSessionScrollConcealing.value = false;
    await refreshListAfterImport();
    return;
  }

  if (data.value.length > 0 && listDefinition.value) {
    if (await maybeRefreshListOnActivate()) {
      finishListSessionPageRestore();
      return;
    }
    await applyListSessionOnActivate();
    finishListSessionPageRestore();
    return;
  }

  if (!shouldFetchListData() && listDefinition.value) {
    if (await maybeRefreshListOnActivate()) {
      finishListSessionPageRestore();
      return;
    }
  }

  if (listDefinition.value) {
    const session = getListSession(listSessionKey.value);
    if (data.value.length === 0 && sessionNeedsScrollConceal(session)) {
      beginListSessionRestore();
    }
    if (shouldFetchListData()) {
      dataLoading.value = true;
      await scheduleInitialListFetch();
    } else {
      await scheduleInitialStatisticsFetch();
    }
    if (!listSessionPagesReady.value) {
      completeListSessionRestore();
    }
    finishListSessionPageRestore();
    return;
  }

  // Stats from a prior visit but rows were cleared (aborted replace / keep-alive eviction).
  const statsTotal = Number(
    statistics.value?.totalPeople ??
      statistics.value?.totalRecords ??
      pagination.value?.totalRecords ??
      0
  );
  if (statsTotal > 0 && data.value.length === 0 && shouldFetchListData()) {
    dataLoading.value = true;
    await scheduleInitialListFetch();
  }
});
const authStore = useAuthStore();
const {
  fetchOnboarding,
  hasModuleVisit,
  recordModuleVisit,
} = useOnboarding();
const moduleListConfigOptions = computed(() => ({
  inventoryEnabled: authStore.inventoryEnabled
}));
function resolveModuleListConfig(moduleKey = props.moduleKey) {
  return getModuleListConfig(moduleKey, moduleListConfigOptions.value);
}
const { openTab } = useTabs();
const { t, te } = useI18n();

const loading = ref(true);
const dataLoading = ref(false);
const listDefinition = ref(null);
const data = ref([]);
const statistics = ref({});
const statisticsLoading = ref(false);
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

// Saved Views for People module
const savedViews = ref([]);
const defaultViewId = ref(null);
const activeSavedViewId = ref(null);

function resolveViewPeopleContext(view) {
  if (props.moduleKey !== 'people') return 'ALL';
  if (view?.peopleContext) return view.peopleContext;
  if (view?.id) {
    return resolvePeopleListAppContext(props.moduleKey, view.id, moduleListConfigOptions.value);
  }
  return 'ALL';
}

const effectivePeopleContext = computed(() => {
  if (props.moduleKey !== 'people') return 'ALL';
  const view = savedViews.value.find((v) => v.id === activeSavedViewId.value);
  return resolveViewPeopleContext(view);
});

function peopleEmptyFilterViewId(context) {
  if (context === 'SALES') return 'sales';
  if (context === 'HELPDESK') return 'helpdesk';
  return 'all';
}

const listSessionScope = computed(() => {
  if (activeSavedViewId.value) {
    return String(activeSavedViewId.value);
  }
  return '';
});

const listSessionKey = computed(() =>
  getListSessionKey(props.moduleKey, props.appKey, route.path, listSessionScope.value)
);

const moduleFieldDefinitions = ref([]);
const appRegistry = ref(null);

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

    await fetchOnboarding();
    const isFirstModuleVisit = !hasModuleVisit(props.moduleKey, props.appKey);

    // Build list definition
    const definition = buildModuleListFromRegistry(
      props.moduleKey,
      props.appKey,
      registry,
      snapshot,
      { isFirstModuleVisit }
    );

    if (isFirstModuleVisit && definition) {
      if (definition.emptyState?.type === EmptyStateType.FIRST_TIME) {
        captureFirstTimeEmptyStateSeen(props.moduleKey, props.appKey, {
          persona: authStore.user?.onboarding?.persona,
          origin: authStore.user?.onboarding?.origin,
          organizationId: authStore.user?.organizationId,
        });
      }
      void recordModuleVisit(props.moduleKey, props.appKey);
    }

    if (authStore.user && authStore.isAuthenticated) {
      const fieldColumns = buildListColumnsFromModuleFields(
        moduleFieldDefinitions.value,
        props.moduleKey,
        authStore.inventoryEnabled
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
      const moduleConfig = resolveModuleListConfig(props.moduleKey);
      const currentUserId = authStore.user?._id;
      const moduleLabel = listDefinition.value?.title || props.moduleKey.charAt(0).toUpperCase() + props.moduleKey.slice(1);
      
      // Get system views (from registry or generate defaults)
      const systemViews = getSystemViews(
        props.moduleKey,
        moduleLabel,
        currentUserId,
        moduleListConfigOptions.value
      );
      
      // Convert system views to saved views format (with label instead of name)
      const systemViewsFormatted = systemViews.map(view => ({
        id: view.id,
        label: view.name,
        filters: view.filters,
        isDefault: view.isDefault === true,
        peopleContext: view.peopleContext,
      }));
      
      const customViews = await fetchCustomSavedViews(props.moduleKey, currentUserId);
      
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
        try {
          const userDefaultViewId = localStorage.getItem(defaultViewStorageKey);
          defaultViewId.value = userDefaultViewId || null;
          const savedActiveViewId = loadActiveSavedViewId(props.moduleKey, currentUserId);
          const viewToLoad = (savedActiveViewId && savedViews.value.find(v => v.id === savedActiveViewId))
            ? savedActiveViewId
            : (userDefaultViewId && savedViews.value.find(v => v.id === userDefaultViewId))
              ? userDefaultViewId
              : defaultView.id;
          activeSavedViewId.value = viewToLoad;
          const savedView = savedViews.value.find(v => v.id === viewToLoad);
          if (savedView) {
            filters.value = resolveSavedViewFilters(savedView, currentUserId);
            const savedConfig = savedView.config;
            if (savedConfig?.sort?.field) {
              sortField.value = normalizePeopleListSortField(savedConfig.sort.field);
              sortOrder.value = savedConfig.sort.order === 'asc' ? 'asc' : 'desc';
            }
            if (savedConfig?.search !== undefined) {
              searchQuery.value = savedConfig.search;
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
        if (shouldFetchListData()) {
          listInitialFetchComplete.value = false;
          dataLoading.value = true;
          scheduleInitialListFetch();
        } else {
          listInitialFetchComplete.value = true;
          emit('filters-changed', { ...filters.value });
          scheduleInitialStatisticsFetch();
        }
      } else {
        listInitialFetchComplete.value = true;
      }

      if (props.moduleKey === 'people') {
        emit('people-context-changed', effectivePeopleContext.value);
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
  
  return listDefinition.value.columns.map(col => {
    const fieldDef = moduleFieldDefinitions.value.find((f) => f.key === col.key);
    const defaultLabel = resolveListColumnLabel(props.moduleKey, col.key, col.label, t, te);
    const label =
      props.moduleKey === 'people'
        ? resolvePeopleListParticipationColumnLabel(
            col.key,
            effectivePeopleContext.value,
            () => defaultLabel,
            t,
            te
          )
        : defaultLabel;
    return {
      key: col.key,
      label,
      sortable: col.sortable ?? false,
      sortKey: col.fieldPath || col.key,
      dataType: col.dataType,
      options: col.options || fieldDef?.options,
    };
  });
});

const adaptedFilterFields = computed(() => {
  if (!moduleFieldDefinitions.value.length) return [];

  return buildFilterFieldsFromModuleFields(
    moduleFieldDefinitions.value,
    props.moduleKey,
    authStore.inventoryEnabled
  ).map((field) => {
    const defaultLabel = resolveListColumnLabel(props.moduleKey, field.key, field.label, t, te);
    const label =
      props.moduleKey === 'people'
        ? resolvePeopleListParticipationColumnLabel(
            field.key,
            effectivePeopleContext.value,
            () => defaultLabel,
            t,
            te
          )
        : defaultLabel;
    return {
      key: field.key,
      label,
      dataType: field.dataType,
      options: field.options,
    };
  });
});

const listPageTitle = computed(() => resolveListPageTitle(props.moduleKey, t, te));

const moduleLabel = computed(() => resolveModuleDisplayLabel(props.moduleKey, t, te));
const moduleLabelLower = computed(() => moduleLabel.value.toLowerCase());

const listEmptyTitle = computed(() => {
  const es = listDefinition.value?.emptyState;
  if (!es || es.type === EmptyStateType.NO_DATA) {
    return t('common.listEmptyNoModuleYet', { module: moduleLabelLower.value });
  }
  if (es.titleKey && te(es.titleKey)) {
    return t(es.titleKey);
  }
  return es.title;
});

const listEmptyMessage = computed(() => {
  const es = listDefinition.value?.emptyState;
  if (!es || es.type === EmptyStateType.NO_DATA) {
    return t('common.listEmptyModuleWillAppear', { module: moduleLabel.value });
  }
  if (es.descriptionKey && te(es.descriptionKey)) {
    return t(es.descriptionKey);
  }
  return es.description || t('common.listEmptyMessage');
});

const fullPageEmptyTitle = computed(() => {
  const es = listDefinition.value?.emptyState;
  if (!es) return t('moduleList.emptyState.title');
  if (es.titleKey && te(es.titleKey)) return t(es.titleKey);
  return es.title || t('moduleList.emptyState.title');
});

const fullPageEmptyMessage = computed(() => {
  const es = listDefinition.value?.emptyState;
  if (!es) return t('moduleList.emptyState.description');
  if (es.descriptionKey && te(es.descriptionKey)) return t(es.descriptionKey);
  return es.description || t('moduleList.emptyState.description');
});

const fullPageEmptyActionLabel = computed(() => {
  const action = listDefinition.value?.emptyState?.primaryAction;
  if (!action) return '';
  if (action.labelKey && te(action.labelKey)) return t(action.labelKey);
  return action.label;
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

const fetchModuleFieldDefinitions = async () => {
  try {
    const params = { key: props.moduleKey };
    if (props.moduleKey === 'people') {
      if (effectivePeopleContext.value === 'SALES') params.context = 'sales';
      else if (effectivePeopleContext.value === 'HELPDESK') params.context = 'helpdesk';
      else params.context = 'all';
    }
    const response = await apiClient.get('/modules', { params });
    if (response.success && Array.isArray(response.data) && response.data.length > 0) {
      moduleFieldDefinitions.value = response.data[0].fields || [];
    } else {
      moduleFieldDefinitions.value = [];
      console.warn('[ModuleList] No module found or empty response');
    }
  } catch (error) {
    console.error('[ModuleList] Error fetching module field definitions:', error);
    moduleFieldDefinitions.value = [];
  }
};

async function rebuildPeopleListColumns() {
  if (props.moduleKey !== 'people' || !listDefinition.value) return;
  await fetchModuleFieldDefinitions();
  const fieldColumns = buildListColumnsFromModuleFields(
    moduleFieldDefinitions.value,
    props.moduleKey,
    authStore.inventoryEnabled
  );
  if (fieldColumns.length > 0) {
    listDefinition.value = {
      ...listDefinition.value,
      columns: fieldColumns,
    };
  }
}

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

  if (emptyStateType === EmptyStateType.DISABLED) {
    return true;
  }

  // FIRST_TIME: wait for list fetch — user may already have imported data
  if (emptyStateType === EmptyStateType.FIRST_TIME) {
    if (listViewLoading.value) return false;
    const total = Number(pagination.value.totalRecords ?? 0);
    if (data.value.length > 0 || total > 0) return false;
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

const LIST_FETCH_PAGINATION_KEYS = new Set(['page', 'limit', 'sortBy', 'sortOrder', 'appKey', 'peopleContext']);

function listParamsHaveActiveFilters(params) {
  if (!params || typeof params !== 'object') return false;
  if (params.search && String(params.search).trim()) return true;
  if (params.filterQuery && String(params.filterQuery).trim()) return true;
  return Object.keys(params).some((key) => {
    if (LIST_FETCH_PAGINATION_KEYS.has(key)) return false;
    const value = params[key];
    return value !== undefined && value !== '';
  });
}

function zeroListStatistics(ctx, totalRecords = 0) {
  const keys = ctx.moduleConfig?.statistics?.stats?.map((stat) => stat.key) ?? [];
  const out = { totalRecords };
  for (const key of keys) {
    out[key] = 0;
  }
  out.totalPeople = totalRecords;
  out.totalOrganizations = totalRecords;
  return out;
}

function filtersPayloadSignature(payload) {
  return JSON.stringify(payload ?? {});
}

/** Refresh stat cards only for saved-view scope — not drill-down filters from stat clicks or filter bar. */
function shouldRefreshStatisticsFromListFetch(ctx) {
  const params = ctx?.params ?? {};
  if (params.search && String(params.search).trim()) return false;
  if (params.filterQuery && String(params.filterQuery).trim()) return false;

  const activeView = savedViews.value.find((v) => v.id === activeSavedViewId.value);
  const viewFilters = activeView
    ? resolveSavedViewFilters(activeView, authStore.user?._id)
    : {};
  const currentFilters = ctx.normalizedFilters ?? {};

  return filtersPayloadSignature(currentFilters) === filtersPayloadSignature(viewFilters);
}

function applyListStatisticsFromResponse(response, totalRecords, ctx) {
  if (totalRecords === 0) {
    statistics.value = zeroListStatistics(ctx, 0);
    return;
  }

  if (response.listStatistics && typeof response.listStatistics === 'object') {
    const raw = response.listStatistics;
    const reportedTotal = Number(
      raw.totalOrganizations ?? raw.totalPeople ?? raw.totalRecords ?? totalRecords
    ) || 0;

    // Stale cache or race can return unfiltered aggregates while pagination is filtered.
    if (reportedTotal !== totalRecords) {
      if (ctx.moduleConfig?.statistics?.computeFunction) {
        statistics.value = ctx.moduleConfig.statistics.computeFunction(data.value, authStore.user?._id, {
          totalRecords
        });
        return;
      }
      statistics.value = zeroListStatistics(ctx, totalRecords);
      return;
    }

    statistics.value = {
      ...raw,
      totalPeople: raw.totalPeople ?? totalRecords,
      totalOrganizations: raw.totalOrganizations ?? totalRecords
    };
    return;
  }

  if (ctx.moduleConfig?.statistics?.computeFunction) {
    statistics.value = ctx.moduleConfig.statistics.computeFunction(data.value, authStore.user?._id, {
      totalRecords
    });
    return;
  }

  if (response.statistics) {
    statistics.value = response.statistics;
  }
}

/** System views (My People, etc.) must always scope list GETs — search cannot drop assignedTo. */
function applyActiveSystemViewScope(normalizedFilters, moduleConfig) {
  const viewId = activeSavedViewId.value;
  if (!viewId || !savedViews.value.length) return normalizedFilters;
  if (!isRegistrySystemView(props.moduleKey, viewId)) return normalizedFilters;

  const activeView = savedViews.value.find((v) => v.id === viewId);
  if (!activeView) return normalizedFilters;

  const rawViewFilters = activeView.config?.filters ?? activeView.filters ?? {};
  if (!rawViewFilters || typeof rawViewFilters !== 'object') return normalizedFilters;

  const viewFilters = moduleConfig?.normalizeViewFilters
    ? moduleConfig.normalizeViewFilters({ ...rawViewFilters }, authStore.user?._id)
    : { ...rawViewFilters };

  const merged = { ...normalizedFilters };
  for (const [key, value] of Object.entries(viewFilters)) {
    if (key === 'filterQuery') continue;
    if (value === undefined || value === '') continue;
    merged[key] = value;
  }
  return merged;
}

/** Shared GET params + endpoint for both replace and append (requestedPage differs). */
function buildListFetchContext(requestedPage, options = {}) {
  const page =
    requestedPage ?? normalizeListPagination(pagination.value).currentPage;
  const params = {
    page,
    limit: pagination.value.limit,
    sortBy: normalizePeopleListSortField(sortField.value) || 'createdAt',
    sortOrder: sortField.value ? (sortOrder.value || 'desc') : 'desc'
  };

  const moduleConfig = resolveModuleListConfig(props.moduleKey);
  let normalizedFilters = applyActiveSystemViewScope({ ...filters.value }, moduleConfig);

  if (moduleConfig?.normalizeFilters) {
    normalizedFilters = moduleConfig.normalizeFilters(normalizedFilters, authStore.user?._id);
  }

  const hasAdvancedFilterQuery = Boolean(
    normalizedFilters.filterQuery && String(normalizedFilters.filterQuery).trim()
  );

  Object.keys(normalizedFilters).forEach((key) => {
    if (key === 'filterQuery') {
      if (hasAdvancedFilterQuery) {
        params.filterQuery = normalizedFilters.filterQuery;
      }
      return;
    }
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
      // apiClient strips null from query strings; server list handlers expect the literal 'null'.
      params[key] = 'null';
    }
  });

  if (props.moduleKey === 'people') {
    params.appKey = 'PLATFORM';
    const peopleCtx = effectivePeopleContext.value;
    if (peopleCtx && peopleCtx !== 'ALL') {
      params.peopleContext = peopleCtx;
    }
  } else if (props.appKey) {
    params.appKey = props.appKey;
  }

  const activeSearchTerm = options.searchOverride !== undefined
    ? String(options.searchOverride ?? '').trim()
    : String(searchQuery.value ?? '').trim();

  if (activeSearchTerm) {
    params.search = activeSearchTerm;
  } else {
    const columnSearchTerm = resolveListSearchTerm(
      { filterQuery: params.filterQuery },
      props.moduleKey
    );
    if (columnSearchTerm) {
      params.search = columnSearchTerm;
    }
  }

  if (params.assignedTo === 'null' && filters.value.assignedTo === undefined) {
    delete params.assignedTo;
  }

  if (params.organization === 'null' && filters.value.organization !== null && filters.value.organization !== undefined) {
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

  if (props.moduleKey === 'people' && effectivePeopleContext.value && effectivePeopleContext.value !== 'ALL') {
    const ctxApp = effectivePeopleContext.value;
    fetchedData = fetchedData.filter((person) => getParticipation(person, ctxApp) != null);
  }

  if (props.moduleKey === 'people') {
    const salesTypeValues = coerceFilterValuesToArray(normalizedFilters.sales_type ?? normalizedFilters.type);
    const helpdeskRoleValues = coerceFilterValuesToArray(normalizedFilters.helpdesk_role);

    const legacyTypeOnHelpdesk =
      effectivePeopleContext.value === 'HELPDESK' && helpdeskRoleValues.length === 0 ? salesTypeValues : [];

    fetchedData = fetchedData.filter((person) => {
      const salesRole = getParticipation(person, 'SALES')?.role ?? '';
      const helpdeskRole = getParticipation(person, 'HELPDESK')?.role ?? '';

      const matchesSales = includesRoleMatch(salesTypeValues, salesRole);
      const matchesHelpdesk = includesRoleMatch(helpdeskRoleValues, helpdeskRole);
      const matchesLegacyHelpdesk = includesRoleMatch(legacyTypeOnHelpdesk, helpdeskRole);

      if (effectivePeopleContext.value === 'HELPDESK') {
        return matchesHelpdesk && matchesLegacyHelpdesk;
      }
      if (effectivePeopleContext.value === 'SALES') {
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

async function fetchListStatistics(opts = {}) {
  if (!listDefinition.value) return;
  const moduleConfig = resolveModuleListConfig(props.moduleKey);
  if (!moduleConfig?.statistics && !statsConfig.value.length) return;

  statisticsLoading.value = true;
  try {
    const ctx = buildListFetchContext(1, { searchOverride: opts.searchOverride });
    const params = {
      ...ctx.params,
      page: 1,
      limit: statisticsFetchLimit(ctx.moduleConfig)
    };

    const response = await apiClient.get(ctx.endpoint, {
      params,
      cache: 'no-store'
    });

    if (!response?.success) return;

    const fetchedData = applyClientSideListTransforms(response.data || [], ctx);
    applyPaginationFromResponse(response, fetchedData.length, 1);
    const totalRecords = Number(pagination.value.totalRecords ?? 0) || 0;

    const prevData = data.value;
    if (!shouldFetchListData()) {
      data.value = fetchedData;
    }
    applyListStatisticsFromResponse(response, totalRecords, ctx);
    if (!shouldFetchListData()) {
      data.value = prevData;
    }
  } catch (error) {
    console.error('[ModuleList] Error fetching statistics:', error);
  } finally {
    statisticsLoading.value = false;
  }
}

async function fetchListReplace(opts = {}) {
  if (!listDefinition.value) return;

  const soft = Boolean(opts.soft);
  const hardClear = Boolean(opts.hardClear);
  const preserveSession = Boolean(opts.preserveSession);

  // Always supersede an in-flight replace — returning the old promise dropped newer filters.
  listDataEpoch.value += 1;
  const epochForThisReplace = listDataEpoch.value;
  const myReplaceSeq = ++replaceSeq;
  replaceAbortController?.abort();
  appendAbortController?.abort();
  appendAbortController = null;

  replaceAbortController = new AbortController();
  const signal = replaceAbortController.signal;

  const ctx = buildListFetchContext(
    normalizeListPagination(pagination.value).currentPage,
    { searchOverride: opts.searchOverride }
  );
  const refreshStats = shouldRefreshStatisticsFromListFetch(ctx);

  dataLoading.value = true;
  if (refreshStats && hardClear) {
    statistics.value = {};
  }
  if (hardClear) {
    data.value = [];
  }

  const run = async () => {
    try {
      const response = await apiClient.get(ctx.endpoint, {
        params: ctx.params,
        signal,
        cache: 'no-store'
      });

      if (listDataEpoch.value !== epochForThisReplace || signal.aborted) return;

      if (response.success) {
        const fetchedData = applyClientSideListTransforms(response.data || [], ctx);

        data.value = [...fetchedData];
        applyPaginationFromResponse(response, fetchedData.length, ctx.params.page);
        const totalRecords = Number(pagination.value.totalRecords ?? 0) || 0;
        if (refreshStats || !Object.keys(statistics.value).length) {
          applyListStatisticsFromResponse(response, totalRecords, ctx);
        }
        recordListFingerprintFromState();
      } else {
        console.warn('[ModuleList] API response not successful:', {
          success: response.success,
          response: response
        });
        if (!soft) {
          data.value = [];
          const mc = resolveModuleListConfig(props.moduleKey);
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
        const moduleConfigErr = resolveModuleListConfig(props.moduleKey);
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
        listInitialFetchComplete.value = true;
        if (preserveSession) {
          bumpSessionRestoreTick();
        }
      }
    }
  };

  const promise = run();
  replaceInFlight = promise;
  try {
    await promise;
  } finally {
    if (replaceInFlight === promise) {
      replaceInFlight = null;
    }
  }
}

/** List GET params for server-side bulk delete (select all matching). */
function buildListQueryForBulkDelete() {
  const ctx = buildListFetchContext(1);
  const params = { ...ctx.params };
  delete params.page;
  delete params.limit;
  if (props.moduleKey === 'people' && effectivePeopleContext.value && effectivePeopleContext.value !== 'ALL') {
    params.peopleContext = effectivePeopleContext.value;
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
      signal,
      cache: 'no-store'
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
    if (!shouldFetchListData()) return;
    return fetchListAppend();
  }
  if (opts.reactivate) {
    await applyListSessionOnActivate();
    bumpSessionRestoreTick();
    return;
  }
  if (!shouldFetchListData()) return;
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
  const term = String(query ?? '').trim();
  searchQuery.value = term;
  pagination.value.currentPage = 1;
  clearListSessionState();
  emit('search-changed', term);
  if (shouldFetchListData()) {
    fetchData({ searchOverride: term, soft: true });
  } else {
    fetchListStatistics({ searchOverride: term });
  }
};

// Helper function to check if filters match a saved view (with normalization)
// Shared between handleFiltersUpdate and handleStatClick
function filtersMatchView(currentFilters, viewFilters, currentUserId) {
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
}

function viewMatchesFilters(view, currentFilters, currentUserId) {
  if (!view) return false;

  if (currentFilters.filterQuery && view.config?.filterQuery) {
    const savedFilterQuery = typeof view.config.filterQuery === 'string'
      ? view.config.filterQuery
      : JSON.stringify(view.config.filterQuery);
    const incomingFilterQuery = typeof currentFilters.filterQuery === 'string'
      ? currentFilters.filterQuery
      : JSON.stringify(currentFilters.filterQuery);
    return savedFilterQuery === incomingFilterQuery;
  }

  const viewFilters = view.config?.filters || view.filters || {};
  return filtersMatchView(currentFilters, viewFilters, currentUserId);
}

const handleFiltersUpdate = async (newFilters, options = {}) => {
  // Clean up old participation filter keys if they exist (migration from old format)
  if (props.moduleKey === 'people') {
    // Remove old participationApp and participationRole filters if new participation filter exists
    if (newFilters.participation) {
      delete newFilters.participationApp;
      delete newFilters.participationRole;
    }
  }

  const prevSignature = filtersPayloadSignature(filters.value);
  const nextSignature = filtersPayloadSignature(newFilters);
  const filtersChanged = prevSignature !== nextSignature;

  // Create a new object to ensure reactivity
  filters.value = { ...newFilters };

  if (filtersChanged || options.forceFetch) {
    pagination.value.currentPage = 1;
    pagination.value.totalRecords = 0;
    pagination.value.total = 0;
    pagination.value.totalPages = 0;
    clearListSessionState();
    emit('filters-changed', filters.value);
    if (shouldFetchListData()) {
      fetchData();
    } else if (filtersChanged || options.forceFetch) {
      fetchListStatistics();
    }
  }

  // Wait for next tick to ensure filters are properly set before checking saved views
  await nextTick();
  
  // Handle saved view state for all modules (registry config or default views)
  // All modules get default system views via getSystemViews, so always handle saved view state
  const moduleConfig = resolveModuleListConfig(props.moduleKey);
  const currentUserId = authStore.user?._id;
  
  // Only handle saved view state if module has system views (from registry or generated)
  if (savedViews.value.length > 0 && !options.preserveActiveView) {
    
    // Check if filters are empty (all cleared)
    // Include null values - they are valid filter values (e.g., organization: null)
    // Boolean true/false are also valid filter values
    const hasAnyFilters = Object.keys(newFilters).some(key => {
      const value = newFilters[key];
      return value !== undefined && value !== '';
    });
    
    if (!hasAnyFilters) {
      const activeView = activeSavedViewId.value
        ? savedViews.value.find((v) => v.id === activeSavedViewId.value)
        : null;
      const isCustomSavedView = Boolean(
        activeView?.id?.startsWith('custom-') || activeView?.config
      );
      if (!isCustomSavedView) {
        if (props.moduleKey === 'people') {
          activeSavedViewId.value = peopleEmptyFilterViewId(effectivePeopleContext.value);
        } else {
          activeSavedViewId.value = 'all';
        }
      }
    } else {
      // Check if current filters match any saved view
      // First check the active view, then check all views
      let matchedView = null;
      
      if (activeSavedViewId.value) {
        const activeView = savedViews.value.find(v => v.id === activeSavedViewId.value);
        if (viewMatchesFilters(activeView, newFilters, currentUserId)) {
          matchedView = activeView;
        }
      }
      
      // If active view doesn't match, check all views
      if (!matchedView) {
        matchedView = savedViews.value.find((view) => viewMatchesFilters(view, newFilters, currentUserId));
      }
      
      if (matchedView) {
        activeSavedViewId.value = matchedView.id;
      }
      // Keep activeSavedViewId when unmatched so the UI can show modified view state.
    }
  }
};

// Handle stat click - apply derived filters
const handleStatClick = (statItem) => {
  const moduleConfig = resolveModuleListConfig(props.moduleKey);
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
        // Filter: assignedTo = currentUser
        // Use 'me' string so it matches the filter dropdown option
        newFilters.assignedTo = 'me';
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
        newFilters.assignedTo = 'me';
        break;
    }
  }
  
  // Use handleFiltersUpdate to properly sync filters with ListView
  // This ensures ListView's internal filters reactive object is updated
  // and hasFiltersApplied correctly detects the filters for the title
  handleFiltersUpdate(newFilters);
};

function formatSystemViewsForList(systemViews) {
  return systemViews.map((view) => ({
    id: view.id,
    label: view.name,
    filters: view.filters,
    isDefault: view.isDefault === true,
    peopleContext: view.peopleContext,
  }));
}

function resolveSavedViewFilters(view, currentUserId) {
  if (!view) return {};

  const config = view.config;
  let viewFilters = {};

  if (config?.filterQuery) {
    viewFilters = {
      filterQuery: typeof config.filterQuery === 'string'
        ? config.filterQuery
        : JSON.stringify(config.filterQuery),
    };
  } else if (config?.filters && Object.keys(config.filters).length > 0) {
    viewFilters = { ...config.filters };
  } else if (view.filters) {
    viewFilters = { ...view.filters };
  }

  if (props.moduleKey === 'events') {
    if (view.id === 'upcoming') {
      viewFilters = { startDateTime: new Date().toISOString() };
    } else if (view.id === 'past') {
      const now = new Date();
      now.setSeconds(now.getSeconds() - 1);
      viewFilters = { endDateTime: now.toISOString() };
    } else if (viewFilters._special) {
      delete viewFilters._special;
    }
  }

  const moduleConfig = resolveModuleListConfig(props.moduleKey);
  return moduleConfig?.normalizeViewFilters
    ? moduleConfig.normalizeViewFilters(viewFilters, currentUserId)
    : viewFilters;
}

// Handle saved views updated (custom views changed)
const handleSavedViewsUpdated = async (customViews) => {
  const moduleLabel = listDefinition.value?.title
    || props.moduleKey.charAt(0).toUpperCase() + props.moduleKey.slice(1);
  const systemViews = getSystemViews(
    props.moduleKey,
    moduleLabel,
    authStore.user?._id,
    moduleListConfigOptions.value
  );

  savedViews.value = [...formatSystemViewsForList(systemViews), ...customViews];

  await persistCustomSavedViews(props.moduleKey, authStore.user?._id, customViews);
};

// Handle saved view selection
const handleSavedViewSelected = async (view) => {
  const prevContext = effectivePeopleContext.value;
  activeSavedViewId.value = view?.id || null;

  if (!view) {
    handleFiltersUpdate({});
    return;
  }

  const nextContext = resolveViewPeopleContext(view);
  if (props.moduleKey === 'people' && prevContext !== nextContext) {
    await rebuildPeopleListColumns();
    emit('people-context-changed', nextContext);
  }

  handleFiltersUpdate(resolveSavedViewFilters(view, authStore.user?._id), { preserveActiveView: true });
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

function buildListQueryForBulkOperations() {
  return buildListQueryForBulkDelete();
}

const handleBulkAction = async (action, payloadOrRows) => {
  const isDeleteAction = action === 'bulk-delete' || action === 'delete';
  const isMassEditAction = action === 'mass-edit';

  if (isMassEditAction) {
    const payload = isBulkSelectionPayload(payloadOrRows) ? payloadOrRows : null;
    const updates = payload?.updates && typeof payload.updates === 'object' ? payload.updates : null;
    if (!updates || Object.keys(updates).length === 0) {
      alert(t('common.massEditSelectFieldHint'));
      return;
    }

    startBulkUpdate({
      moduleKey: props.moduleKey,
      updates,
      selection: payload,
      pageIds: !payload && Array.isArray(payloadOrRows)
        ? payloadOrRows.map((r) => String(r?._id || r?.id || r?.eventId || r)).filter(Boolean)
        : null,
      listQuery: buildListQueryForBulkOperations(),
      options: { appKey: props.appKey, routePath: String(route.path || '') },
      onComplete: (outcome) => {
        void (async () => {
          if (outcome.cancelled) {
            if (outcome.updatedCount > 0) await fetchData();
            return;
          }
          const {
            updatedCount,
            skippedCount,
            failedCount,
            firstError,
            requestedCount,
          } = outcome;
          const totalAttempted = updatedCount + skippedCount + failedCount;
          const hadSelection = Number(requestedCount || 0) > 0;

          if (!props.moduleKey || (totalAttempted === 0 && !hadSelection)) {
            alert(t('common.massEditNoSelection'));
            return;
          }
          if (totalAttempted === 0 && hadSelection) {
            alert(t('common.massEditNoMatches'));
            return;
          }
          if (failedCount > 0) {
            const errorMessage =
              firstError?.response?.data?.message ||
              firstError?.message ||
              t('common.massEditFailed');
            alert(
              failedCount === totalAttempted
                ? errorMessage
                : t('common.massEditPartialFailed', { failed: failedCount, total: totalAttempted, message: errorMessage })
            );
            if (updatedCount > 0) await fetchData();
            return;
          }
          if (skippedCount > 0) {
            alert(t('common.massEditPartialSkipped', { updated: updatedCount, skipped: skippedCount }));
          }
          await fetchData();
        })();
      },
      onError: (error) => {
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          t('common.massEditFailed');
        alert(errorMessage);
      },
    });
    return;
  }

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
    listInitialFetchComplete.value = false;
    data.value = [];
    buildList();
  }
});

// Fetch list rows when parent switches from kanban/calendar back to list view
watch(
  () => props.viewMode,
  (mode, prevMode) => {
    if (!listDefinition.value || prevMode == null) return;
    const toList = shouldFetchListDataForMode(mode);
    const fromList = shouldFetchListDataForMode(prevMode);
    if (toList && !fromList) {
      scheduleInitialListFetch();
    } else if (!toList && fromList) {
      scheduleInitialStatisticsFetch();
    }
  }
);

// Persist active saved view to localStorage
watch(() => activeSavedViewId.value, (newValue) => {
  saveActiveSavedViewId(props.moduleKey, authStore.user?._id, newValue);
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
  setFilters: (newFilters) => handleFiltersUpdate(newFilters),
  getPeopleContext: () => effectivePeopleContext.value,
});
</script>


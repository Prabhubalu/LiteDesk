<template>
  <div class="mx-auto w-full px-6 py-8">
    <div
      v-if="!canView"
      class="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-600"
    >
      <h2 class="text-lg font-medium text-neutral-900 dark:text-white">
        {{ t('analytics.emptyNoAccessTitle') }}
      </h2>
      <p class="mt-2 text-sm text-neutral-500">{{ t('analytics.emptyNoAccessDescription') }}</p>
    </div>

    <template v-else>
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
            {{ t('analytics.homeTitle') }}
          </h1>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {{ t('analytics.homeDescription') }}
          </p>
        </div>
        <div v-if="canCreate" class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="goCreateReport"
          >
            {{ t('analytics.newReport') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="goCreateDashboard"
          >
            {{ t('analytics.newDashboard') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
            @click="goCreateWidget"
          >
            {{ t('analytics.newWidget') }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">
        {{ t('states.loading') }}
      </div>

      <template v-else>
        <div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            class="rounded-xl border border-neutral-200 p-4 text-left hover:border-primary-400 dark:border-neutral-700"
            @click="goReports"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.listTitle') }}
            </p>
            <p class="mt-1 text-2xl font-semibold text-neutral-900 dark:text-white">
              {{ kpi.reports }}
            </p>
          </button>
          <button
            type="button"
            class="rounded-xl border border-neutral-200 p-4 text-left hover:border-primary-400 dark:border-neutral-700"
            @click="goWidgets"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.widgetsListTitle') }}
            </p>
            <p class="mt-1 text-2xl font-semibold text-neutral-900 dark:text-white">
              {{ kpi.widgets }}
            </p>
          </button>
          <button
            type="button"
            class="rounded-xl border border-neutral-200 p-4 text-left hover:border-primary-400 dark:border-neutral-700"
            @click="goDashboards"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.dashboardsListTitle') }}
            </p>
            <p class="mt-1 text-2xl font-semibold text-neutral-900 dark:text-white">
              {{ kpi.dashboards }}
            </p>
          </button>
          <div class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.homeKpiExecutions') }}
            </p>
            <p class="mt-1 text-2xl font-semibold text-neutral-900 dark:text-white">
              {{ kpi.executionsThisWeek }}
            </p>
          </div>
        </div>

        <div class="relative mb-6">
          <input
            v-model="search"
            type="search"
            class="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            :placeholder="t('analytics.homeSearchPlaceholder')"
            @input="debouncedSearch"
          />
          <div
            v-if="search.trim() && (searchResults.length || searching)"
            class="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          >
            <p v-if="searching" class="px-4 py-3 text-sm text-neutral-500">{{ t('states.loading') }}</p>
            <button
              v-for="item in searchResults"
              :key="`${item.assetType}-${item._id}`"
              type="button"
              class="flex w-full items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
              @click="openSearchResult(item)"
            >
              <span class="font-medium text-neutral-900 dark:text-white">{{ item.name }}</span>
              <span class="shrink-0 capitalize text-neutral-500">
                {{ t(`analytics.assetType_${item.assetType}`, item.assetType) }}
              </span>
            </button>
            <p
              v-if="!searching && searchResults.length === 0"
              class="px-4 py-3 text-sm text-neutral-500"
            >
              {{ t('analytics.emptyNoResultsDescription') }}
            </p>
          </div>
        </div>

        <div class="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600"
            @click="goFolders"
          >
            {{ t('analytics.foldersTitle') }}
            <span v-if="kpi.folders" class="ml-1 text-neutral-500">({{ kpi.folders }})</span>
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600"
            @click="goSchedules"
          >
            {{ t('analytics.schedulesTitle') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600"
            @click="goAlerts"
          >
            {{ t('analytics.alertsTitle') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600"
            @click="goTrash"
          >
            {{ t('analytics.trashTitle') }}
          </button>
          <button
            v-if="canEdit"
            type="button"
            class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600"
            @click="goSettings"
          >
            {{ t('analytics.settingsTitle') }}
          </button>
        </div>

        <div
          v-if="showFirstTimeEmpty"
          class="mb-6 rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-600"
        >
          <h2 class="text-lg font-medium text-neutral-900 dark:text-white">
            {{ t('analytics.homeFirstTimeTitle') }}
          </h2>
          <p class="mt-2 text-sm text-neutral-500">{{ t('analytics.homeFirstTimeDescription') }}</p>
          <button
            v-if="canCreate"
            type="button"
            class="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
            @click="goCreateReport"
          >
            {{ t('analytics.homeFirstTimeAction') }}
          </button>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <section class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {{ t('analytics.homeRecentTitle') }}
              </h2>
            </div>
            <ul v-if="recent.length" class="divide-y divide-neutral-200 dark:divide-neutral-700">
              <li v-for="item in recent" :key="`${item.assetType}-${item._id}`">
                <div class="flex items-center gap-1 py-3">
                  <AnalyticsFavoriteButton
                    :active="isFavorite(item.assetType, item._id)"
                    @toggle="toggleFavoriteItem(item)"
                  />
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center justify-between gap-3 text-left text-sm hover:text-primary-600"
                    @click="openRecent(item)"
                  >
                    <span class="truncate font-medium text-neutral-900 dark:text-white">{{ item.name }}</span>
                    <span class="shrink-0 text-xs text-neutral-500">
                      {{ formatRelative(item.activityAt) }}
                    </span>
                  </button>
                </div>
              </li>
            </ul>
            <p v-else class="py-6 text-center text-sm text-neutral-500">
              {{ t('analytics.homeRecentEmpty') }}
            </p>
          </section>

          <section class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.homeFavoritesTitle') }}
            </h2>
            <ul v-if="favorites.length" class="divide-y divide-neutral-200 dark:divide-neutral-700">
              <li v-for="item in favorites" :key="`fav-${item.assetType}-${item._id}`">
                <div class="flex items-center gap-1 py-3">
                  <AnalyticsFavoriteButton
                    :active="true"
                    @toggle="toggleFavoriteItem(item)"
                  />
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 text-left text-sm font-medium text-neutral-900 hover:text-primary-600 dark:text-white"
                    @click="openRecent(item)"
                  >
                    {{ item.name }}
                  </button>
                </div>
              </li>
            </ul>
            <p v-else class="py-6 text-center text-sm text-neutral-500">
              {{ t('analytics.homeFavoritesEmpty') }}
            </p>
          </section>

          <section class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700 lg:col-span-2">
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.homeQuickStartTitle') }}
            </h2>
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                class="rounded-lg border border-neutral-200 px-3 py-3 text-left text-sm hover:border-primary-400 dark:border-neutral-600"
                @click="goReports"
              >
                {{ t('analytics.listTitle') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-neutral-200 px-3 py-3 text-left text-sm hover:border-primary-400 dark:border-neutral-600"
                @click="goWidgets"
              >
                {{ t('analytics.widgetsListTitle') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-neutral-200 px-3 py-3 text-left text-sm hover:border-primary-400 dark:border-neutral-600"
                @click="goDashboards"
              >
                {{ t('analytics.dashboardsListTitle') }}
              </button>
              <button
                v-if="canCreate"
                type="button"
                class="rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-left text-sm hover:border-primary-400 dark:border-neutral-600"
                @click="goCreateReport"
              >
                {{ t('analytics.homeBlankReport') }}
              </button>
            </div>
          </section>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAnalyticsHome } from '@/composables/useAnalyticsHome';
import AnalyticsFavoriteButton from '@/components/analytics/AnalyticsFavoriteButton.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useOnboarding } from '@/composables/useOnboarding';
import {
  captureAnalyticsHomeViewed,
  captureAnalyticsModuleVisited,
  captureAnalyticsSearch,
  captureAnalyticsFavoriteToggled,
} from '@/config/posthogAnalytics';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { hasModuleVisit, recordModuleVisit } = useOnboarding();
const { home, searchResults, loading, searching, fetchHome, searchAssets, clearSearch, isFavorite, toggleFavorite } = useAnalyticsHome();

const search = ref('');
const isFirstVisit = ref(false);
let searchTimer = null;

const canView = computed(() => authStore.can('reports', 'view'));
const canCreate = computed(() => authStore.can('reports', 'create'));
const canEdit = computed(() => authStore.can('reports', 'edit'));

const kpi = computed(() => home.value?.kpiStrip || {
  reports: 0,
  widgets: 0,
  dashboards: 0,
  folders: 0,
  executionsThisWeek: 0,
});

const recent = computed(() => home.value?.recent || []);
const favorites = computed(() => home.value?.favorites || []);

const showFirstTimeEmpty = computed(() => {
  return isFirstVisit.value && kpi.value.reports === 0 && kpi.value.widgets === 0 && kpi.value.dashboards === 0;
});

function formatRelative(value) {
  if (!value) return '—';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return t('analytics.homeJustNow');
  if (hours < 24) return t('analytics.homeHoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('analytics.homeDaysAgo', { count: days });
}

function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = search.value.trim();
    if (!q) {
      clearSearch();
      return;
    }
    const res = await searchAssets(q);
    if (res?.success) {
      captureAnalyticsSearch({ query_length: q.length, result_count: searchResults.value.length });
    }
  }, 300);
}

function routeForAsset(assetType, id) {
  if (assetType === 'report') return { name: 'analytics-report-detail', params: { id } };
  if (assetType === 'widget') return { name: 'analytics-widget-detail', params: { id } };
  return { name: 'analytics-dashboard-view', params: { id } };
}

function openRecent(item) {
  router.push(routeForAsset(item.assetType, item._id));
}

function openSearchResult(item) {
  search.value = '';
  clearSearch();
  router.push(routeForAsset(item.assetType, item._id));
}

function goReports() {
  router.push({ name: 'analytics-reports' });
}

function goWidgets() {
  router.push({ name: 'analytics-widgets' });
}

function goDashboards() {
  router.push({ name: 'analytics-dashboards' });
}

function goCreateReport() {
  router.push({ name: 'analytics-report-create' });
}

function goCreateWidget() {
  router.push({ name: 'analytics-widget-create' });
}

function goCreateDashboard() {
  router.push({ name: 'analytics-dashboard-create' });
}

function goFolders() {
  router.push({ name: 'analytics-folders' });
}

function goSchedules() {
  router.push({ name: 'analytics-schedules' });
}

function goAlerts() {
  router.push({ name: 'analytics-alerts' });
}

function goTrash() {
  router.push({ name: 'analytics-trash' });
}

function goSettings() {
  router.push({ name: 'analytics-settings' });
}

async function toggleFavoriteItem(item) {
  const result = await toggleFavorite(item.assetType, item._id);
  captureAnalyticsFavoriteToggled({
    asset_type: item.assetType,
    asset_id: item._id,
    favorited: result.favorited,
  });
}

onMounted(async () => {
  isFirstVisit.value = !hasModuleVisit('analytics', 'PLATFORM');
  captureAnalyticsModuleVisited({ surface: 'analytics_home' });
  captureAnalyticsHomeViewed();

  if (isFirstVisit.value && canView.value) {
    captureFirstTimeEmptyStateSeen('analytics', 'PLATFORM', {
      persona: authStore.user?.onboarding?.persona,
      origin: authStore.user?.onboarding?.origin,
      organizationId: authStore.user?.organizationId,
    });
  }

  void recordModuleVisit('analytics', 'PLATFORM');
  if (canView.value) {
    await fetchHome();
  }
});
</script>

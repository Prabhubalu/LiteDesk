<template>
  <div v-if="loading" class="space-y-4 p-2">
    <div class="h-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/70 dark:border-slate-700 dark:bg-slate-800/70"></div>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        v-for="idx in 3"
        :key="idx"
        class="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100/70 dark:border-slate-700 dark:bg-slate-800/70"
      ></div>
    </div>
  </div>

  <div v-else-if="dashboardDefinition" class="dashboard-shell">
    <div v-if="dashboardDefinition.emptyState" class="flex items-center justify-center min-h-[60vh]">
      <div class="text-center max-w-md">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ dashboardDefinition.emptyState.title }}
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          {{ dashboardDefinition.emptyState.description }}
        </p>
        <button
          v-if="dashboardDefinition.emptyState.primaryAction"
          @click="handleAction(dashboardDefinition.emptyState.primaryAction.route)"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          {{ dashboardDefinition.emptyState.primaryAction.label }}
        </button>
      </div>
    </div>

    <div v-else class="space-y-6">
      <DashboardHeader
        :dashboard-definition="dashboardDefinition"
        :formatted-now="formattedNow"
        :selected-range-label="selectedRangeLabel"
        :show-controls="isSalesApp"
        @cycle-range="cycleRange"
        @refresh="buildDashboard"
        @action="handleAction"
      />

      <template v-if="isSalesApp">
      <DashboardFilters
        :rep-id="selectedRepId"
        :pipeline="selectedPipeline"
        :deal-type="selectedDealType"
        :rep-filter-options="repFilterOptions"
        :pipeline-filter-options="pipelineFilterOptions"
        :deal-type-options="dealTypeOptions"
        @update:repId="selectedRepId = $event"
        @update:pipeline="selectedPipeline = $event"
        @update:dealType="selectedDealType = $event"
        @reset="resetFilters"
      />

      <ExecutiveSnapshot :cards="executiveKpiCards" />

      <PipelineForecast
        :trend-subtitle="trendSubtitle"
        :trend-direction-label="trendDirectionLabel"
        :pipeline-stages="pipelineStages"
        :biggest-dropoff-summary="biggestDropoffSummary"
        :stuck-deals-summary="stuckDealsSummary"
        :forecast-panel="forecastPanel"
        :forecast-by-rep="forecastByRep"
      />

      <section class="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-12">
        <div class="h-full xl:col-span-5">
          <RepPerformanceLeaderboard :rows="repPerformanceRows" />
        </div>
        <div class="h-full xl:col-span-7">
          <ActivityAlerts
            :activity-over-time="activityOverTime"
            :new-pipeline-per-week="newPipelinePerWeek"
            :activity-to-deal-conversion-pct="activityToDealConversionPct"
            :efficiency-flags="efficiencyFlags"
            :alerts-data="alertsData"
          />
        </div>
      </section>
      <AiInsightsStrip :cards="aiInsightCards" />
      </template>

      <template v-else>
        <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('dashboard.appDashboardQuickAccess') }}</h2>
          <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <button
              v-for="module in (dashboardDefinition.modules || [])"
              :key="module.moduleKey"
              type="button"
              class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              @click="handleAction(module.route)"
            >
              {{ module.label }}
            </button>
            <p v-if="(dashboardDefinition.modules || []).length === 0" class="text-xs text-slate-500 dark:text-slate-400">{{ t('dashboard.appDashboardNoDashboardWidgetsConfiguredForThis') }}</p>
          </div>
        </section>
      </template>

    </div>
  </div>

  <div v-else class="flex items-center justify-center min-h-[60vh]">
    <div class="text-center">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('dashboard.appDashboardDashboardNotFound') }}</h2>
      <p class="text-gray-600 dark:text-gray-400">{{ t('dashboard.appDashboardTheDashboardForThisAppIs') }}</p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { toRef } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import { useSalesDashboardMetrics } from '@/composables/useSalesDashboardMetrics';
import DashboardHeader from '@/components/dashboard/widgets/DashboardHeader.vue';
import DashboardFilters from '@/components/dashboard/widgets/DashboardFilters.vue';
import ExecutiveSnapshot from '@/components/dashboard/widgets/ExecutiveSnapshot.vue';
import PipelineForecast from '@/components/dashboard/widgets/PipelineForecast.vue';
import RepPerformanceLeaderboard from '@/components/dashboard/widgets/RepPerformanceLeaderboard.vue';
import ActivityAlerts from '@/components/dashboard/widgets/ActivityAlerts.vue';
import AiInsightsStrip from '@/components/dashboard/widgets/AiInsightsStrip.vue';

const props = defineProps({
  appKey: {
    type: String,
    required: true
  }
});

const { t } = useI18n();

const authStore = useAuthStore();
const { openTab } = useTabs();
const {
  isSalesApp,
  loading,
  dashboardDefinition,
  selectedRepId,
  selectedPipeline,
  selectedDealType,
  dealTypeOptions,
  formattedNow,
  selectedRangeLabel,
  cycleRange,
  buildDashboard,
  resetFilters,
  executiveKpiCards,
  trendSubtitle,
  trendDirectionLabel,
  pipelineStages,
  biggestDropoffSummary,
  stuckDealsSummary,
  forecastPanel,
  forecastByRep,
  repPerformanceRows,
  activityOverTime,
  newPipelinePerWeek,
  activityToDealConversionPct,
  efficiencyFlags,
  alertsData,
  aiInsightCards,
  repFilterOptions,
  pipelineFilterOptions
} = useSalesDashboardMetrics({
  appKey: toRef(props, 'appKey'),
  authStore
});

const handleAction = (route) => {
  if (!route) return;

  openTab(route, {
    title: route.split('/').pop(),
    background: false,
    insertAdjacent: true
  });
};

</script>

<style scoped>
.dashboard-shell {
  background: transparent;
  border-radius: 0;
  padding: 0;
}
</style>


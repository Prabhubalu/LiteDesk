<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          {{ t('navigation.appMarketing') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('navigation.marketingDashboardBlurb') }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <router-link
          v-if="canCreateCampaign"
          :to="{ name: 'marketing-campaign-new' }"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {{ t('marketing.dashboardActionNewCampaign') }}
        </router-link>
        <router-link
          v-if="canCreateAudience"
          :to="{ name: 'marketing-audience-new' }"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {{ t('marketing.dashboardActionNewAudience') }}
        </router-link>
        <router-link
          v-if="canViewCampaigns"
          :to="{ name: 'marketing-reports' }"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {{ t('marketing.dashboardActionReports') }}
        </router-link>
        <router-link
          v-if="canViewCampaigns"
          :to="{ name: 'marketing-campaigns' }"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {{ t('marketing.dashboardActionCampaigns') }}
        </router-link>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-gray-500">
      {{ t('states.loading') }}
    </div>

    <template v-else-if="dashboard">
      <div class="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="card in kpiCards"
          :key="card.key"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{{ card.value }}</p>
          <p v-if="card.hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ card.hint }}</p>
        </div>
      </div>

      <div class="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="card in statusCards"
          :key="card.key"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{{ card.value }}</p>
        </div>
      </div>

      <div class="grid gap-6 xl:grid-cols-3">
        <section class="xl:col-span-2 space-y-6">
          <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('marketing.dashboardRecentCampaignsTitle') }}
              </h2>
            </div>
            <div v-if="recentCampaigns.length === 0" class="px-5 py-10 text-center text-sm text-gray-500">
              {{ t('marketing.dashboardRecentCampaignsEmpty') }}
            </div>
            <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
              <li
                v-for="campaign in recentCampaigns"
                :key="campaign._id"
                class="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                @click="openCampaign(campaign._id)"
              >
                <div class="min-w-0">
                  <p class="truncate font-medium text-gray-900 dark:text-white">{{ campaign.name }}</p>
                  <p class="truncate text-sm text-gray-500 dark:text-gray-400">
                    {{ campaign.subject || t('marketing.dashboardNoSubject') }}
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <BadgeCell
                    :value="formatStatus(campaign.status)"
                    :variant="statusVariantMap[campaign.status] || 'default'"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ formatDate(campaign.updatedAt) }}
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('marketing.dashboardTopCampaignsTitle') }}
              </h2>
            </div>
            <div v-if="topCampaigns.length === 0" class="px-5 py-10 text-center text-sm text-gray-500">
              {{ t('marketing.dashboardTopCampaignsEmpty') }}
            </div>
            <div v-else class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {{ t('marketing.campaignsColName') }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {{ t('marketing.dashboardColRecipients') }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {{ t('marketing.campaignsStatsOpenRate') }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {{ t('marketing.campaignsStatsClickRate') }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr
                    v-for="campaign in topCampaigns"
                    :key="campaign._id"
                    class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    @click="openCampaign(campaign._id)"
                  >
                    <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{{ campaign.name }}</td>
                    <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ campaign.totalRecipients }}</td>
                    <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ formatRate(campaign.openRate) }}</td>
                    <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ formatRate(campaign.clickRate) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('marketing.dashboardLinkPerformanceTitle') }}
              </h2>
            </div>
            <div v-if="linkPerformance.length === 0" class="px-5 py-10 text-center text-sm text-gray-500">
              {{ t('marketing.dashboardLinkPerformanceEmpty') }}
            </div>
            <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
              <li
                v-for="(link, index) in linkPerformance"
                :key="`${link.url || 'unknown'}-${index}`"
                class="px-5 py-4"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {{ link.url || t('marketing.dashboardUnknownLink') }}
                    </p>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {{ t('marketing.dashboardLinkCampaignCount', { count: link.campaignCount }) }}
                    </p>
                  </div>
                  <div class="shrink-0 text-right text-sm text-gray-700 dark:text-gray-300">
                    <p>{{ t('marketing.dashboardLinkClicks', { count: link.clicks }) }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ t('marketing.dashboardLinkRecipients', { count: link.uniqueRecipients }) }}
                    </p>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <aside class="space-y-6">
          <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('marketing.dashboardActivityTitle') }}
              </h2>
            </div>
            <div v-if="recentActivity.length === 0" class="px-5 py-10 text-center text-sm text-gray-500">
              {{ t('marketing.dashboardActivityEmpty') }}
            </div>
            <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
              <li
                v-for="item in recentActivity"
                :key="item.id"
                class="cursor-pointer px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                @click="openCampaign(item.campaignId)"
              >
                <p class="text-sm text-gray-900 dark:text-white">
                  {{ activityMessage(item) }}
                </p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ formatDate(item.timestamp) }}
                </p>
              </li>
            </ul>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('marketing.dashboardAudienceGrowthTitle') }}
            </h2>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {{ t('marketing.dashboardAudienceGrowthSummary', audienceGrowthSummary) }}
            </p>
            <div v-if="audienceGrowthTrend.length > 0" class="mt-4 space-y-2">
              <div
                v-for="point in audienceGrowthTrend"
                :key="point.date"
                class="flex items-center gap-3"
              >
                <span class="w-20 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {{ formatShortDate(point.date) }}
                </span>
                <div class="h-2 flex-1 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    class="h-2 rounded-full bg-indigo-500"
                    :style="{ width: `${growthBarWidth(point.audiences)}%` }"
                  />
                </div>
                <span class="w-8 shrink-0 text-right text-xs text-gray-700 dark:text-gray-300">
                  {{ point.audiences }}
                </span>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('marketing.dashboardQuickLinksTitle') }}
            </h2>
            <div class="mt-4 flex flex-col gap-2">
              <router-link
                v-if="canViewAudiences"
                :to="{ name: 'marketing-audiences' }"
                class="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                {{ t('marketing.dashboardActionAudiences') }}
              </router-link>
              <router-link
                v-if="canViewSegments"
                :to="{ name: 'marketing-segments' }"
                class="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                {{ t('marketing.dashboardActionSegments') }}
              </router-link>
            </div>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useOnboarding } from '@/composables/useOnboarding';
import { useMarketingDashboard } from '@/composables/useMarketingDashboard';
import {
  captureMarketingAppOpened,
  captureMarketingDashboardViewed
} from '@/config/posthogMarketing';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { recordModuleVisit } = useOnboarding();
const { dashboard, loading, fetchDashboard } = useMarketingDashboard();

const canViewCampaigns = computed(() => authStore.can('campaigns', 'view'));
const canCreateCampaign = computed(() => authStore.can('campaigns', 'create'));
const canViewAudiences = computed(() => authStore.can('audiences', 'view'));
const canCreateAudience = computed(() => authStore.can('audiences', 'create'));
const canViewSegments = computed(() => authStore.can('segments', 'view'));

const statusVariantMap = {
  draft: 'warning',
  scheduled: 'info',
  running: 'primary',
  paused: 'default',
  completed: 'success',
  cancelled: 'default',
  archived: 'default',
  failed: 'danger'
};

const statusLabelKeys = {
  draft: 'marketing.campaignsStatusDraft',
  scheduled: 'marketing.campaignsStatusScheduled',
  running: 'marketing.campaignsStatusRunning',
  paused: 'marketing.campaignsStatusPaused',
  completed: 'marketing.campaignsStatusCompleted',
  cancelled: 'marketing.campaignsStatusCancelled',
  archived: 'marketing.campaignsStatusArchived',
  failed: 'marketing.campaignsStatusFailed'
};

const recentCampaigns = computed(() => dashboard.value?.recentCampaigns || []);
const topCampaigns = computed(() => dashboard.value?.topCampaigns || []);
const linkPerformance = computed(() => dashboard.value?.linkPerformance || []);
const recentActivity = computed(() => dashboard.value?.recentActivity || []);
const audienceGrowthTrend = computed(() => dashboard.value?.kpis?.audiences?.growthTrend || []);

const audienceGrowthSummary = computed(() => ({
  audiences: dashboard.value?.kpis?.audiences?.totalAudiences || 0,
  members: dashboard.value?.kpis?.audiences?.totalMembers || 0,
  newAudiences: dashboard.value?.kpis?.audiences?.newAudiencesLast30Days || 0
}));

const kpiCards = computed(() => {
  const engagement = dashboard.value?.kpis?.engagement || {};
  return [
    {
      key: 'delivered',
      label: t('marketing.dashboardKpiDelivered'),
      value: engagement.delivered || 0,
      hint: t('marketing.dashboardKpiDeliveredHint', { rate: formatRate(engagement.deliveryRate) })
    },
    {
      key: 'opens',
      label: t('marketing.dashboardKpiOpens'),
      value: engagement.uniqueOpens || 0,
      hint: t('marketing.dashboardKpiOpensHint', { rate: formatRate(engagement.avgOpenRate) })
    },
    {
      key: 'clicks',
      label: t('marketing.dashboardKpiClicks'),
      value: engagement.uniqueClicks || 0,
      hint: t('marketing.dashboardKpiClicksHint', { rate: formatRate(engagement.avgClickRate) })
    },
    {
      key: 'audiences',
      label: t('marketing.dashboardKpiAudienceMembers'),
      value: dashboard.value?.kpis?.audiences?.totalMembers || 0,
      hint: t('marketing.dashboardKpiAudienceMembersHint', {
        count: dashboard.value?.kpis?.audiences?.totalAudiences || 0
      })
    }
  ];
});

const statusCards = computed(() => {
  const campaigns = dashboard.value?.kpis?.campaigns || {};
  return [
    { key: 'active', label: t('marketing.dashboardStatusActive'), value: campaigns.active || 0 },
    { key: 'draft', label: t('marketing.campaignsStatusDraft'), value: campaigns.draft || 0 },
    { key: 'scheduled', label: t('marketing.campaignsStatusScheduled'), value: campaigns.scheduled || 0 },
    { key: 'completed', label: t('marketing.campaignsStatusCompleted'), value: campaigns.completed || 0 }
  ];
});

const maxGrowthAudiences = computed(() =>
  Math.max(1, ...audienceGrowthTrend.value.map((point) => point.audiences || 0))
);

function formatStatus(value) {
  const key = statusLabelKeys[value];
  return key ? t(key) : String(value || 'draft');
}

function formatRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0%';
  const pct = num <= 1 ? num * 100 : num;
  return `${Math.round(pct)}%`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function growthBarWidth(count) {
  return Math.max(8, Math.round(((count || 0) / maxGrowthAudiences.value) * 100));
}

function activityMessage(item) {
  if (item.messageKey === 'dashboardActivitySent') {
    return t('marketing.dashboardActivitySent', { name: item.campaignName });
  }
  if (item.messageKey === 'dashboardActivityScheduled') {
    return t('marketing.dashboardActivityScheduled', { name: item.campaignName });
  }
  if (item.messageKey === 'dashboardActivityDraft') {
    return t('marketing.dashboardActivityDraft', { name: item.campaignName });
  }
  return t('marketing.dashboardActivityUpdated', { name: item.campaignName });
}

function openCampaign(id) {
  router.push({ name: 'marketing-campaign-detail', params: { id: String(id) } });
}

onMounted(async () => {
  const orgId = authStore.user?.organizationId || authStore.organization?._id || undefined;
  captureMarketingAppOpened({ organization_id: orgId });
  captureMarketingDashboardViewed({ organization_id: orgId });
  void recordModuleVisit('marketing_dashboard', 'MARKETING');
  await fetchDashboard();
});
</script>

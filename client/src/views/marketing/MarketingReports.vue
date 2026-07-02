<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.reportsTitle') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('marketing.reportsDescription') }}
        </p>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            {{ t('marketing.reportsPeriodLabel') }}
          </label>
          <select
            v-model="periodDays"
            class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            @change="reload"
          >
            <option :value="7">{{ t('marketing.reportsPeriod7Days') }}</option>
            <option :value="30">{{ t('marketing.reportsPeriod30Days') }}</option>
            <option :value="90">{{ t('marketing.reportsPeriod90Days') }}</option>
          </select>
        </div>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
          :disabled="exporting"
          @click="handleExport('csv')"
        >
          {{ t('marketing.reportsExportCsv') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
          :disabled="exporting"
          @click="handleExport('xlsx')"
        >
          {{ t('marketing.reportsExportExcel') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="exporting"
          @click="handleExport('pdf')"
        >
          {{ t('marketing.reportsExportPdf') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-gray-500">
      {{ t('states.loading') }}
    </div>

    <template v-else-if="summary">
      <div class="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="card in kpiCards"
          :key="card.key"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{{ card.value }}</p>
        </div>
      </div>

      <div class="grid gap-6 xl:grid-cols-2">
        <section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('marketing.reportsCampaignPerformanceTitle') }}
            </h2>
          </div>
          <div v-if="campaignRows.length === 0" class="px-5 py-10 text-center text-sm text-gray-500">
            {{ t('marketing.reportsCampaignPerformanceEmpty') }}
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
                    {{ t('marketing.dashboardColOpenRate') }}
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {{ t('marketing.dashboardColClickRate') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                <tr
                  v-for="row in campaignRows"
                  :key="row._id"
                  class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  @click="openCampaign(row._id)"
                >
                  <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{{ row.name }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ row.stats.totalRecipients }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatRate(row.stats.openRate) }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatRate(row.stats.clickRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('marketing.reportsEngagementTrendTitle') }}
            </h2>
          </div>
          <div v-if="engagementTrend.length === 0" class="px-5 py-10 text-center text-sm text-gray-500">
            {{ t('marketing.reportsEngagementTrendEmpty') }}
          </div>
          <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
            <li
              v-for="row in engagementTrend"
              :key="row.date"
              class="flex items-center justify-between px-5 py-3 text-sm"
            >
              <span class="text-gray-700 dark:text-gray-300">{{ row.date }}</span>
              <span class="text-gray-500 dark:text-gray-400">
                {{ t('marketing.reportsTrendLine', {
                  campaigns: row.campaigns,
                  openRate: formatRate(row.openRate)
                }) }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useMarketingReports } from '@/composables/useMarketingReports';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const router = useRouter();
const notifications = useNotifications();
const { summary, loading, exporting, fetchReportsSummary, downloadCampaignExport } = useMarketingReports();

const periodDays = ref(30);

const campaignRows = computed(() => summary.value?.campaigns || []);
const engagementTrend = computed(() => summary.value?.engagementTrend || []);

const kpiCards = computed(() => {
  const totals = summary.value?.totals || {};
  const amds = summary.value?.amdsAnalytics || {};
  const cards = [
    { key: 'campaigns', label: t('marketing.reportsKpiCampaigns'), value: totals.campaigns ?? 0 },
    { key: 'recipients', label: t('marketing.reportsKpiRecipients'), value: totals.recipients ?? 0 },
    { key: 'openRate', label: t('marketing.reportsKpiOpenRate'), value: formatRate(totals.openRate) },
    { key: 'clickRate', label: t('marketing.reportsKpiClickRate'), value: formatRate(totals.clickRate) }
  ];

  if (amds.complaintRate != null) {
    cards.push({
      key: 'complaintRate',
      label: t('marketing.reportsKpiComplaintRate'),
      value: formatRate(amds.complaintRate)
    });
  }

  if (amds.hardBounceRate != null) {
    cards.push({
      key: 'hardBounceRate',
      label: t('marketing.reportsKpiHardBounceRate'),
      value: formatRate(amds.hardBounceRate)
    });
  }

  return cards;
});

function formatRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0%';
  const pct = num > 1 ? num : num * 100;
  return `${pct.toFixed(1)}%`;
}

async function reload() {
  try {
    await fetchReportsSummary({ days: periodDays.value });
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  }
}

async function handleExport(format) {
  try {
    await downloadCampaignExport(format, { days: periodDays.value });
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  }
}

function openCampaign(id) {
  router.push({ name: 'marketing-campaign-detail', params: { id } });
}

onMounted(reload);
</script>

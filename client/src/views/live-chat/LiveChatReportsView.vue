<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <LiveChatWorkspaceNav />

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div class="mx-auto max-w-6xl">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('liveChat.reportsTitle') }}</h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('liveChat.reportsDesc') }}</p>
          </div>
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ t('liveChat.reportsRangeLabel') }}
            <select
              v-model="rangeDays"
              class="ml-2 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              @change="load"
            >
              <option v-for="opt in rangeOptions" :key="opt.days" :value="opt.days">
                {{ opt.label }}
              </option>
            </select>
          </label>
        </div>

        <div v-if="loading" class="mt-8 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          {{ t('liveChat.reportsLoading') }}
        </div>

        <div v-else-if="error" class="mt-8 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {{ error }}
        </div>

        <template v-else-if="overview">
          <section class="mt-6">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('liveChat.reportsOperational') }}
            </h2>
            <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard :label="t('liveChat.reportsActiveNow')" :value="overview.operational.activeNow" />
              <StatCard :label="t('liveChat.reportsWaitingNow')" :value="overview.operational.waitingNow" />
              <StatCard :label="t('liveChat.reportsOnlineAgents')" :value="overview.operational.onlineAgents" />
              <StatCard :label="t('liveChat.reportsClosedInRange')" :value="overview.operational.closedInRange" />
              <StatCard :label="t('liveChat.reportsMissed')" :value="overview.operational.missedCount" />
              <StatCard
                :label="t('liveChat.reportsAvgHandleTime')"
                :value="formatDuration(overview.operational.avgHandleTimeSeconds)"
              />
              <StatCard
                :label="t('liveChat.reportsAgentsActive')"
                :value="overview.operational.agentsWithClosedSessions"
              />
              <StatCard
                :label="t('liveChat.reportsAvgSessionsPerAgent')"
                :value="formatAverage(overview.operational.avgSessionsPerAgent)"
              />
            </div>
          </section>

          <section class="mt-8">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('liveChat.reportsQuality') }}
            </h2>
            <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                :label="t('liveChat.reportsAvgCsat')"
                :value="formatCsat(overview.quality.csat?.avgScore)"
              />
              <StatCard
                :label="t('liveChat.reportsCsatRated')"
                :value="overview.quality.csat?.ratedCount ?? 0"
              />
              <StatCard
                :label="t('liveChat.reportsTotalTransfers')"
                :value="overview.quality.transfers?.totalTransfers ?? 0"
              />
              <StatCard
                :label="t('liveChat.reportsTransferRate')"
                :value="formatPercent(overview.quality.transfers?.transferRate)"
              />
            </div>
          </section>

          <section class="mt-8 grid gap-6 lg:grid-cols-2">
            <ReportPanel :title="t('liveChat.reportsCsatDistribution')">
              <table v-if="csatDistributionRows.length" class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-gray-500 dark:text-gray-400">
                    <th class="pb-2 font-medium">{{ t('liveChat.reportsCsatScore') }}</th>
                    <th class="pb-2 font-medium text-right">{{ t('liveChat.reportsCount') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in csatDistributionRows"
                    :key="row.score"
                    class="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td class="py-2 text-gray-900 dark:text-gray-100">{{ row.score }}/5</td>
                    <td class="py-2 text-right text-gray-700 dark:text-gray-300">{{ row.count }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('liveChat.reportsNoCsat') }}</p>
            </ReportPanel>
            <ReportPanel :title="t('liveChat.reportsQueueLoad')">
              <table v-if="overview.queueLoad.length" class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-gray-500 dark:text-gray-400">
                    <th class="pb-2 font-medium">{{ t('liveChat.reportsQueue') }}</th>
                    <th class="pb-2 font-medium text-right">{{ t('liveChat.reportsCount') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in overview.queueLoad"
                    :key="row.queueId || 'unqueued'"
                    class="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td class="py-2 text-gray-900 dark:text-gray-100">{{ row.queueName }}</td>
                    <td class="py-2 text-right text-gray-700 dark:text-gray-300">{{ row.waitingCount }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('liveChat.reportsNoQueueLoad') }}</p>
            </ReportPanel>

            <ReportPanel :title="t('liveChat.reportsOutcomes')">
              <table v-if="overview.quality.outcomes.length" class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-gray-500 dark:text-gray-400">
                    <th class="pb-2 font-medium">{{ t('liveChat.outcomeLabel') }}</th>
                    <th class="pb-2 font-medium text-right">{{ t('liveChat.reportsCount') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in overview.quality.outcomes"
                    :key="row.outcome"
                    class="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td class="py-2 text-gray-900 dark:text-gray-100">{{ outcomeLabel(row.outcome) }}</td>
                    <td class="py-2 text-right text-gray-700 dark:text-gray-300">{{ row.count }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('liveChat.reportsNoOutcomes') }}</p>
            </ReportPanel>
          </section>

          <section class="mt-8">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('liveChat.reportsBusiness') }}
            </h2>
            <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard :label="t('liveChat.reportsCasesCreated')" :value="overview.business.casesCreated" />
              <StatCard :label="t('liveChat.reportsCasesLinked')" :value="overview.business.casesLinked" />
              <StatCard :label="t('liveChat.reportsPeopleCreated')" :value="overview.business.peopleCreated" />
              <StatCard :label="t('liveChat.reportsPeopleLinked')" :value="overview.business.peopleLinked" />
            </div>
          </section>

          <section class="mt-8">
            <ReportPanel :title="t('liveChat.reportsAgentMetrics')">
              <table v-if="agents.length" class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-gray-500 dark:text-gray-400">
                    <th class="pb-2 font-medium">{{ t('liveChat.agent') }}</th>
                    <th class="pb-2 font-medium text-right">{{ t('liveChat.reportsSessionsHandled') }}</th>
                    <th class="pb-2 font-medium text-right">{{ t('liveChat.reportsAvgFrt') }}</th>
                    <th class="pb-2 font-medium text-right">{{ t('liveChat.reportsAvgHandleTime') }}</th>
                    <th class="pb-2 font-medium text-right">{{ t('liveChat.reportsAgentTransfers') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in agents"
                    :key="row.agentId"
                    class="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td class="py-2 text-gray-900 dark:text-gray-100">{{ row.agentName }}</td>
                    <td class="py-2 text-right text-gray-700 dark:text-gray-300">{{ row.sessionsHandled }}</td>
                    <td class="py-2 text-right text-gray-700 dark:text-gray-300">
                      {{ formatDuration(row.avgFirstResponseSeconds) }}
                    </td>
                    <td class="py-2 text-right text-gray-700 dark:text-gray-300">
                      {{ formatDuration(row.avgHandleTimeSeconds) }}
                    </td>
                    <td class="py-2 text-right text-gray-700 dark:text-gray-300">
                      {{ row.totalTransfers ?? 0 }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('liveChat.reportsNoAgents') }}</p>
            </ReportPanel>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { liveChatOutcomeLabel, setLiveChatCustomOutcomeLabels } from '@/utils/liveChatSessionDisplay';
import LiveChatWorkspaceNav from '@/components/live-chat/LiveChatWorkspaceNav.vue';
import StatCard from '@/components/live-chat/LiveChatReportStatCard.vue';
import ReportPanel from '@/components/live-chat/LiveChatReportPanel.vue';

const { t } = useI18n();

const loading = ref(true);
const error = ref('');
const overview = ref(null);
const agents = ref([]);
const rangeDays = ref(30);

const rangeOptions = computed(() => [
  { days: 7, label: t('liveChat.reportsRange7d') },
  { days: 30, label: t('liveChat.reportsRange30d') },
  { days: 90, label: t('liveChat.reportsRange90d') },
]);

const csatDistributionRows = computed(() => {
  const rows = overview.value?.quality?.csat?.distribution;
  return Array.isArray(rows) ? rows.filter((row) => row.count > 0) : [];
});

function rangeParams() {
  const to = new Date();
  const from = new Date(to.getTime() - rangeDays.value * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return t('liveChat.reportsDurationSeconds', { count: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('liveChat.reportsDurationMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return t('liveChat.reportsDurationHours', { hours, minutes: rem });
}

function formatCsat(score) {
  if (score == null || !Number.isFinite(score)) return '—';
  return `${score}/5`;
}

function formatAverage(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return String(value);
}

function formatPercent(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value}%`;
}

function outcomeLabel(key) {
  return liveChatOutcomeLabel(key, t) || '—';
}

async function loadOutcomes() {
  try {
    const res = await apiClient.get('/live-chat/outcomes');
    setLiveChatCustomOutcomeLabels(Array.isArray(res?.data) ? res.data : []);
  } catch {
    setLiveChatCustomOutcomeLabels([]);
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const params = rangeParams();
    const [overviewRes, agentsRes] = await Promise.all([
      apiClient.get('/live-chat/reports/overview', { params }),
      apiClient.get('/live-chat/reports/agents', { params }),
      loadOutcomes(),
    ]);
    if (!overviewRes?.success) {
      throw new Error(overviewRes?.message || t('liveChat.reportsLoadFailed'));
    }
    overview.value = overviewRes.data || null;
    agents.value = Array.isArray(agentsRes?.data?.agents) ? agentsRes.data.agents : [];
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('liveChat.reportsLoadFailed');
    overview.value = null;
    agents.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

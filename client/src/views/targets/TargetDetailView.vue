<template>
  <div class="min-h-full bg-gray-50 dark:bg-gray-900/50 py-8 px-4 sm:px-6">
    <div v-if="loading" class="max-w-4xl mx-auto space-y-4">
      <div class="h-8 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div class="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
    </div>

    <div v-else-if="target" class="max-w-4xl mx-auto space-y-6">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        @click="router.push('/settings?tab=performance&view=targets')"
      >
        <ArrowLeftIcon class="h-4 w-4" />
        {{ t('performance.targetsQuotasTitle') }}
      </button>

      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white truncate">{{ target.name }}</h1>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <TargetStatusBadge kind="lifecycle" :value="target.lifecycleStatus" />
            <TargetStatusBadge v-if="['active', 'locked'].includes(target.lifecycleStatus)" kind="status" :value="target.status" />
          </div>
          <p class="mt-2 text-sm text-gray-500">{{ formatPeriodRange(target.periodStart, target.periodEnd) }}</p>
          <p
            v-if="target.dependencyWarnings?.length"
            class="mt-2 text-sm text-amber-700 dark:text-amber-300"
          >
            {{ t('performance.detailPartialData') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2 shrink-0">
          <button
            v-if="target.lifecycleStatus === 'active'"
            type="button"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium hover:bg-white dark:hover:bg-gray-800"
            @click="lockTarget"
          >
            {{ t('performance.detailLock') }}
          </button>
          <button
            v-if="target.lifecycleStatus === 'draft'"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            @click="activate"
          >
            {{ t('performance.activateTarget') }}
          </button>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p class="text-4xl font-bold tabular-nums text-gray-900 dark:text-white">
              {{ progressPct }}<span class="text-2xl text-gray-400 font-semibold">%</span>
            </p>
            <p class="mt-1 text-sm text-gray-500">
              {{ t('performance.achievedOfTarget', {
                achieved: formatTargetValue(target.achievedValue, target.metricKind),
                target: formatTargetValue(target.targetValue, target.metricKind),
              }) }}
            </p>
          </div>
        </div>
        <TargetProgressBar :target="target" :show-labels="false" size="lg" />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('performance.detailAchieved') }}</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
            {{ formatTargetValue(target.achievedValue, target.metricKind) }}
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('performance.detailGoal') }}</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
            {{ formatTargetValue(target.targetValue, target.metricKind) }}
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('performance.detailForecast') }}</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
            {{ target.forecastValue != null ? formatTargetValue(target.forecastValue, target.metricKind) : '—' }}
          </p>
          <p v-if="target.riskLevel" class="mt-1 text-xs capitalize text-gray-500">{{ target.riskLevel }} risk</p>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('performance.detailContributions') }}</h2>
          <button type="button" class="text-sm font-medium text-indigo-600 hover:text-indigo-500" @click="recalculate">
            {{ t('performance.detailRecalculate') }}
          </button>
        </div>
        <ul v-if="contributions.length" class="divide-y divide-gray-100 dark:divide-gray-700 max-h-72 overflow-y-auto">
          <li
            v-for="row in contributions"
            :key="row._id"
            class="flex items-center justify-between gap-4 px-5 py-3 text-sm"
          >
            <span class="text-gray-600 dark:text-gray-400">
              <span class="font-medium text-gray-900 dark:text-white capitalize">{{ row.sourceModuleKey }}</span>
              · {{ row.direction === 'credit' ? '+' : '−' }}{{ Math.abs(row.amount) }}
            </span>
            <time class="text-xs text-gray-400 shrink-0">{{ formatRelative(row.occurredAt) }}</time>
          </li>
        </ul>
        <p v-else class="px-5 py-8 text-center text-sm text-gray-500">—</p>
      </div>

      <div v-if="versions.length" class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('performance.detailVersions') }}</h2>
        <ul class="space-y-2 text-sm">
          <li
            v-for="v in versions"
            :key="v._id"
            class="flex justify-between text-gray-600 dark:text-gray-400"
          >
            <span>Version {{ v.versionNumber }} · {{ v.reason }}</span>
            <span class="text-xs">{{ formatDate(v.publishedAt) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeftIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import TargetStatusBadge from '@/components/targets/TargetStatusBadge.vue';
import TargetProgressBar from '@/components/targets/TargetProgressBar.vue';
import { formatPeriodRange, formatTargetValue, targetProgressPercent } from '@/utils/targetDisplayUtils';

const props = defineProps({ id: { type: String, default: '' } });
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const target = ref(null);
const contributions = ref([]);
const versions = ref([]);
const loading = ref(true);

const targetId = computed(() => props.id || route.params.id);

const progressPct = computed(() => targetProgressPercent(target.value));

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

function formatRelative(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return formatDate(d);
}

async function load() {
  loading.value = true;
  try {
    const [tRes, cRes, vRes] = await Promise.all([
      apiClient.get(`/targets/${targetId.value}`),
      apiClient.get(`/targets/${targetId.value}/contributions`),
      apiClient.get(`/targets/${targetId.value}/versions`),
    ]);
    target.value = tRes?.data;
    contributions.value = cRes?.data || [];
    versions.value = vRes?.data || [];
    await apiClient.get(`/targets/${targetId.value}/forecast`);
    const refreshed = await apiClient.get(`/targets/${targetId.value}`);
    if (refreshed?.data) target.value = refreshed.data;
  } finally {
    loading.value = false;
  }
}

async function activate() {
  await apiClient.post(`/targets/${targetId.value}/activate`, {});
  await load();
}

async function lockTarget() {
  await apiClient.post(`/targets/${targetId.value}/lock`, {});
  await load();
}

async function recalculate() {
  await apiClient.post(`/targets/${targetId.value}/recalculate`, {});
  await load();
}

onMounted(load);
</script>

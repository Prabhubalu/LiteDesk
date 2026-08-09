<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('telephony.analyticsTitle') }}</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('telephony.analyticsDesc') }}</p>
        </div>
        <select
          v-model="days"
          class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          @change="load"
        >
          <option :value="7">7</option>
          <option :value="30">30</option>
          <option :value="90">90</option>
        </select>
      </div>

      <p v-if="loading" class="mt-4 text-sm text-gray-500">{{ t('states.loading') }}</p>
      <p v-else-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
      <div v-else class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="card in cards"
          :key="card.label"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{{ card.value }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import TelephonyNav from '@/components/telephony/TelephonyNav.vue';
import { getAnalyticsDashboard } from '@/utils/telephonyApi';

const { t } = useI18n();
const loading = ref(true);
const error = ref('');
const days = ref(7);
const metrics = ref(null);

const cards = computed(() => {
  const m = metrics.value || {};
  return [
    { label: t('telephony.analyticsTotalCalls'), value: m.calls ?? 0 },
    { label: t('telephony.analyticsConnected'), value: m.connected ?? 0 },
    { label: t('telephony.analyticsMissed'), value: m.missed ?? 0 },
    { label: t('telephony.analyticsAht'), value: formatSeconds(m.aht) },
    { label: t('telephony.analyticsAwt'), value: formatSeconds(m.awt) },
    { label: t('telephony.analyticsTalkTime'), value: formatSeconds(m.totalTalkSeconds) },
  ];
});

function formatSeconds(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const seconds = Number(value);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getAnalyticsDashboard({ days: days.value });
    metrics.value = res?.data?.metrics || res?.data || {};
  } catch {
    error.value = t('telephony.analyticsLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

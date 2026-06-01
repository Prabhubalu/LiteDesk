<template>
  <SettingsScrollPanel content-class="pb-24">
    <template #header>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="flex items-start gap-3 min-w-0">
          <button
            type="button"
            class="mt-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-200 transition-colors"
            :aria-label="t('performance.back')"
            @click="goBack"
          >
            <ArrowLeftIcon class="w-5 h-5" />
          </button>
          <div class="min-w-0">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('performance.targetsQuotasTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('performance.targetsQuotasDescription') }}</p>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 shrink-0"
          @click="router.push('/targets/new')"
        >
          <PlusIcon class="w-4 h-4" />
          {{ t('performance.newTarget') }}
        </button>
      </div>
    </template>

    <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-900/50">
        <button
          v-for="tab in filterTabs"
          :key="tab.id"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="filter === tab.id
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
          @click="filter = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="relative flex-1 max-w-md">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          v-model="search"
          type="search"
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
          :placeholder="t('performance.searchPlaceholder')"
        />
      </div>
    </div>

    <div v-if="loading" class="grid gap-3">
      <div v-for="i in 3" :key="i" class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 h-28" />
    </div>

    <TargetEmptyState
      v-else-if="!filteredTargets.length"
      :title="t('performance.noTargetsTitle')"
      :description="t('performance.noTargets')"
      :action-label="t('performance.newTarget')"
      @action="router.push('/targets/new')"
    />

    <div v-else class="grid gap-3">
      <button
        v-for="target in filteredTargets"
        :key="target._id"
        type="button"
        class="group text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        @click="router.push(`/targets/${target._id}`)"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {{ target.name }}
            </h3>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <TargetStatusBadge kind="lifecycle" :value="target.lifecycleStatus" />
              <TargetStatusBadge v-if="target.lifecycleStatus === 'active'" kind="status" :value="target.status" />
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {{ formatPeriodRange(target.periodStart, target.periodEnd) }}
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
              {{ formatTargetValue(target.achievedValue, target.metricKind) }}
            </p>
            <p class="text-xs text-gray-500">
              {{ t('performance.achievedOfTarget', {
                achieved: formatTargetValue(target.achievedValue, target.metricKind),
                target: formatTargetValue(target.targetValue, target.metricKind),
              }) }}
            </p>
          </div>
        </div>
        <TargetProgressBar class="mt-4" :target="target" :show-labels="false" size="md" />
      </button>
    </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeftIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import TargetStatusBadge from '@/components/targets/TargetStatusBadge.vue';
import TargetProgressBar from '@/components/targets/TargetProgressBar.vue';
import TargetEmptyState from '@/components/targets/TargetEmptyState.vue';
import { formatPeriodRange, formatTargetValue } from '@/utils/targetDisplayUtils';

const { t } = useI18n();
const router = useRouter();
const targets = ref([]);
const loading = ref(true);
const filter = ref('all');
const search = ref('');

const filterTabs = computed(() => [
  { id: 'all', label: t('performance.filterAll') },
  { id: 'active', label: t('performance.filterActive') },
  { id: 'draft', label: t('performance.filterDraft') },
]);

const filteredTargets = computed(() => {
  let list = targets.value;
  if (filter.value === 'active') {
    list = list.filter((x) => ['active', 'locked'].includes(x.lifecycleStatus));
  } else if (filter.value === 'draft') {
    list = list.filter((x) => x.lifecycleStatus === 'draft');
  }
  const q = search.value.trim().toLowerCase();
  if (q) list = list.filter((x) => (x.name || '').toLowerCase().includes(q));
  return list;
});

function goBack() {
  router.replace({ path: '/settings', query: { tab: 'performance' } });
}

onMounted(async () => {
  try {
    const res = await apiClient.get('/targets');
    targets.value = res?.data || [];
  } finally {
    loading.value = false;
  }
});
</script>

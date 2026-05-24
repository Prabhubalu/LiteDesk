<template>
  <div class="w-full h-full">
    <div v-if="currentView === 'overview'" class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('performance.settingsTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
          {{ t('performance.settingsDescription') }}
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          v-for="option in performanceOptions"
          :key="option.id"
          type="button"
          class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group text-left"
          @click="navigateToOption(option)"
        >
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm"
              :class="option.iconBg"
            >
              <component :is="option.icon" class="w-6 h-6 text-white" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {{ option.name }}
              </h4>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {{ option.description }}
              </p>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <span>{{ t('performance.configure') }}</span>
            <ArrowRightIcon class="w-4 h-4" aria-hidden="true" />
          </div>
        </button>
      </div>
    </div>

    <TargetsQuotasSettings v-else-if="currentView === 'targets'" />
    <PerformanceDashboards v-else-if="currentView === 'dashboards'" />
  </div>
</template>

<script setup>
import { computed, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowRightIcon } from '@heroicons/vue/24/outline';
import TargetsQuotasSettings from '@/components/settings/TargetsQuotasSettings.vue';
import PerformanceDashboards from '@/components/settings/PerformanceDashboards.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const TargetsIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', class: 'w-6 h-6' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }),
]);

const DashboardIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', class: 'w-6 h-6' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 6a1 1 0 011-1h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-8zM4 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z' }),
]);

const performanceOptions = computed(() => [
  {
    id: 'targets',
    name: t('performance.targetsQuotasTitle'),
    description: t('performance.targetsQuotasDescription'),
    icon: TargetsIcon,
    iconBg: 'bg-indigo-600',
  },
  {
    id: 'dashboards',
    name: t('performance.dashboardsTitle'),
    description: t('performance.dashboardsDescription'),
    icon: DashboardIcon,
    iconBg: 'bg-emerald-600',
  },
]);

const currentView = computed(() => {
  const v = route.query.view;
  if (v === 'targets' || v === 'dashboards') return v;
  return 'overview';
});

function navigateToOption(option) {
  router.replace({ path: '/settings', query: { tab: 'performance', view: option.id } });
}
</script>

<template>
  <SettingsScrollPanel content-class="pb-24">
    <template #header>
      <div class="flex items-start gap-3">
        <button
          type="button"
          class="mt-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
          @click="goBack"
        >
          <ArrowLeftIcon class="w-5 h-5" />
        </button>
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('performance.dashboardsTitle') }}</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('performance.dashboardsDescription') }}</p>
        </div>
      </div>
    </template>

    <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <TargetProgressWidget app-key="SALES" module-key="deals" />
      <TargetProgressWidget app-key="HELPDESK" module-key="cases" />
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div class="border-b border-gray-100 dark:border-gray-700 px-5 py-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('performance.leaderboard') }}</h3>
      </div>
      <div v-if="leaderboardLoading" class="p-6 space-y-3">
        <div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
      </div>
      <p v-else-if="!leaderboard.length" class="px-5 py-10 text-center text-sm text-gray-500">
        {{ t('performance.leaderboardEmpty') }}
      </p>
      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <li
          v-for="row in leaderboard"
          :key="row.rank"
          class="flex items-center gap-4 px-5 py-3"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            :class="row.rank <= 3 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
          >
            {{ row.rank }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ userName(row.user) }}</p>
          </div>
          <span class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
            {{ row.achievedValue }}
          </span>
        </li>
      </ul>
    </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeftIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import TargetProgressWidget from '@/components/targets/TargetProgressWidget.vue';

const { t } = useI18n();
const router = useRouter();
const leaderboard = ref([]);
const leaderboardLoading = ref(true);

function userName(user) {
  if (!user) return '—';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '—';
}

function goBack() {
  router.replace({ path: '/settings', query: { tab: 'performance' } });
}

onMounted(async () => {
  try {
    const res = await apiClient.get('/targets/leaderboard', { params: { limit: 10 } });
    leaderboard.value = res?.data || [];
  } finally {
    leaderboardLoading.value = false;
  }
});
</script>

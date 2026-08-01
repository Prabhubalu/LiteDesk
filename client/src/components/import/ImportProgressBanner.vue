<template>
  <div
    v-if="activeImportsStore.hasBannerImports"
    class="fixed bottom-4 right-4 z-[9000] flex w-full max-w-md flex-col gap-2 pointer-events-none"
  >
    <div
      v-for="item in activeImportsStore.processingImportsForBanner"
      :key="item.importId"
      class="pointer-events-auto overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-lg dark:border-indigo-800 dark:bg-gray-900"
    >
      <div class="px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {{ item.fileName }}
            </p>
            <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              {{ t('import.importRecordsProgress', {
                processed: formatCount(item.processed),
                total: formatCount(item.total),
              }) }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            @click="viewImport(item.importId)"
          >
            {{ t('process.execLogsViewDetails') }}
          </button>
        </div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            class="h-full rounded-full bg-indigo-600 transition-all duration-300 ease-out"
            :style="{ width: `${progressPercent(item)}%` }"
          />
        </div>
        <p class="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          {{ t('import.importBackgroundHint') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useActiveImportsStore } from '@/stores/activeImports';
import { useTabs } from '@/composables/useTabs';
import { formatNumber } from '@/utils/localeFormat';

const { t } = useI18n();
const router = useRouter();
const activeImportsStore = useActiveImportsStore();
const { openTab } = useTabs();

function formatCount(value) {
  return formatNumber(Number(value || 0));
}

function progressPercent(item) {
  const total = Number(item.total || 0);
  if (!total) return 0;
  return Math.min(100, Math.round((Number(item.processed || 0) / total) * 100));
}

function viewImport(importId) {
  openTab(`/imports/${importId}`, {
    title: t('import.importBackgroundTabTitle'),
    icon: 'download',
    insertAdjacent: true,
  });
  router.push(`/imports/${importId}`);
}
</script>

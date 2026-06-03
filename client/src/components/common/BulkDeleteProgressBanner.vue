<template>
  <div
    v-if="bulkDeleteStore.hasBannerDelete"
    class="fixed bottom-4 left-4 right-4 z-[9000] flex justify-end pointer-events-none sm:left-auto sm:right-4 sm:max-w-md"
  >
    <div
      class="pointer-events-auto w-full overflow-hidden rounded-xl border border-red-200 bg-white shadow-lg dark:border-red-800 dark:bg-gray-900"
    >
      <div class="px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('common.bulkDeleteBannerTitle') }}
            </p>
            <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              {{ progressLabel }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="requestCancel"
          >
            {{ t('common.bulkDeleteCancel') }}
          </button>
        </div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            class="h-full rounded-full bg-red-600 transition-all duration-300 ease-out"
            :class="{ 'animate-pulse': bulkDeleteStore.progressIndeterminate }"
            :style="{
              width: bulkDeleteStore.progressIndeterminate
                ? '35%'
                : `${bulkDeleteStore.progressPercent}%`
            }"
          />
        </div>
        <p class="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          {{ t('common.bulkDeleteBackgroundHint') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBulkDeleteProgressStore } from '@/stores/bulkDeleteProgress';

const { t } = useI18n();
const bulkDeleteStore = useBulkDeleteProgressStore();

const progressLabel = computed(() => {
  const processed = Number(bulkDeleteStore.processed || 0).toLocaleString();
  const total = Number(bulkDeleteStore.total || 0).toLocaleString();
  return t('common.bulkDeleteProgressDeleting', { processed, total });
});

function requestCancel() {
  if (window.confirm(t('common.bulkDeleteLeaveConfirm'))) {
    bulkDeleteStore.requestCancel();
  }
}
</script>

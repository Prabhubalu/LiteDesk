<template>
  <section class="space-y-2">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="text-[30px] font-bold leading-tight text-slate-900 dark:text-white">{{ dashboardDefinition.title || 'Dashboard' }}</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ dashboardDefinition.description || 'Overview and insights for this app workspace' }}
        </p>
      </div>
      <div v-if="showControls" class="flex flex-wrap items-center gap-2">
        <span class="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {{ selectedRangeLabel }}
        </span>
        <button
          type="button"
          @click="$emit('cycle-range')"
          class="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >{{ t('dashboard.dashboardHeaderDateRange') }}</button>
        <button
          type="button"
          @click="$emit('refresh')"
          class="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
        >{{ t('settings.integrationsRefresh') }}</button>
      </div>
    </div>
    <p v-if="showControls" class="text-xs text-slate-500 dark:text-slate-400">Last synced {{ formattedNow }}</p>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
defineProps({
  dashboardDefinition: { type: Object, required: true },
  formattedNow: { type: String, required: true },
  selectedRangeLabel: { type: String, required: true },
  showControls: { type: Boolean, default: true }
});

const { t } = useI18n();

defineEmits(['cycle-range', 'refresh', 'action']);
</script>

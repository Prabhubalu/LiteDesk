<template>
  <section class="grid h-full grid-cols-1 gap-3 xl:grid-cols-12">
    <article class="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Activity & Pipeline Creation</h2>
        <span class="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{{ t('dashboard.activityAlertsThisMonth') }}</span>
      </div>
      <div class="mb-3 inline-flex overflow-hidden rounded-md border border-slate-200 text-[11px] dark:border-slate-700">
        <span class="bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">{{ t('settings.modFieldsActivitiesTitle') }}</span>
        <span class="border-l border-slate-200 px-2.5 py-1 text-slate-500 dark:border-slate-700 dark:text-slate-300">{{ t('dashboard.activityAlertsPipelineCreated') }}</span>
        <span class="border-l border-slate-200 px-2.5 py-1 text-slate-500 dark:border-slate-700 dark:text-slate-300">{{ t('dashboard.activityAlertsConversionRate') }}</span>
      </div>
      <div class="mb-2 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
        <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-indigo-500"></span>{{ t('dashboard.activityAlertsCalls') }}</span>
        <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-violet-400"></span>{{ t('dashboard.activityAlertsMeetings') }}</span>
        <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-emerald-400"></span>{{ t('settings.coreModDetailModuleTasks') }}</span>
      </div>
      <div class="relative h-40 rounded-md border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/60">
        <svg v-if="activityOverTime.length" viewBox="0 0 100 40" class="h-full w-full">
          <polyline :points="linePoints(activityOverTime, 'calls')" fill="none" stroke="#6366F1" stroke-width="1.8" />
          <polyline :points="linePoints(activityOverTime, 'meetings')" fill="none" stroke="#A78BFA" stroke-width="1.8" />
          <polyline :points="linePoints(activityOverTime, 'tasks')" fill="none" stroke="#34D399" stroke-width="1.8" />
        </svg>
        <div v-else class="absolute inset-0 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">{{ t('dashboard.activityAlertsNoActivityTrendDataForSelected') }}</div>
      </div>
      <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/70">
          <p class="text-slate-500 dark:text-slate-400">{{ t('dashboard.activityAlertsPipelineCreatedRecentWeeks') }}</p>
          <div class="mt-2 flex items-end gap-1.5">
            <div
              v-for="(row, idx) in newPipelinePerWeek.slice(-6)"
              :key="`pipeline-${idx}`"
              class="flex w-full flex-col items-center gap-1"
            >
              <div class="w-full rounded-sm bg-indigo-200/60 dark:bg-indigo-500/30" :style="{ height: `${pipelineBarHeight(row.value)}px` }"></div>
              <span class="text-[10px] text-slate-500 dark:text-slate-400">{{ shortLabel(row.week) }}</span>
            </div>
            <p v-if="newPipelinePerWeek.length === 0" class="text-[11px] text-slate-500 dark:text-slate-400">{{ t('dashboard.activityAlertsNoPipelineCreatedYet') }}</p>
          </div>
        </div>
        <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/70">
          <p class="text-slate-500 dark:text-slate-400">{{ t('dashboard.activityAlertsEfficiencyWatch') }}</p>
          <ul class="mt-2 space-y-1.5">
            <li v-for="flag in efficiencyFlags.slice(0, 2)" :key="flag.repId" class="text-[11px] text-amber-700 dark:text-amber-200">
              {{ flag.name }}: {{ flag.reason }} ({{ flag.activityCount }} acts, {{ flag.conversionPct }}% conv)
            </li>
            <li v-if="efficiencyFlags.length === 0" class="text-[11px] text-emerald-700 dark:text-emerald-200">{{ t('dashboard.activityAlertsNoEfficiencyConcernsDetected') }}</li>
          </ul>
        </div>
      </div>
      <div class="mt-2.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200">
        Activity to deal conversion: {{ activityToDealConversionPct }}%
      </div>
    </article>

    <article class="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-4">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Risk & Alerts</h2>
        <span class="text-xs text-indigo-600 dark:text-indigo-300">{{ t('settings.roleDrawerPermViewAll') }}</span>
      </div>
      <ul class="flex-1 space-y-2">
        <li
          v-for="alert in alertsData.slice(0, 5)"
          :key="alert.code"
          class="rounded-md border px-3 py-2 text-xs"
          :class="alertRowClass(alert.severity || alert.priority)"
        >
          <p class="font-semibold">{{ alert.message }}</p>
          <p class="mt-1 opacity-80">{{ alert.action }}</p>
        </li>
        <li v-if="alertsData.length === 0" class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{{ t('dashboard.activityAlertsNoCriticalAlertsRightNow') }}</li>
      </ul>
    </article>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
defineProps({
  activityOverTime: { type: Array, required: true },
  newPipelinePerWeek: { type: Array, required: true },
  activityToDealConversionPct: { type: Number, required: true },
  efficiencyFlags: { type: Array, required: true },
  alertsData: { type: Array, required: true }
});

const { t } = useI18n();

const linePoints = (rows, key) => {
  const series = Array.isArray(rows) ? rows.slice(-8) : [];
  if (!series.length) return '';
  const max = Math.max(...series.map((row) => Number(row?.[key] || 0)), 1);
  return series
    .map((row, idx) => {
      const x = (idx / Math.max(1, series.length - 1)) * 100;
      const y = 36 - ((Number(row?.[key] || 0) / max) * 28);
      return `${x},${Math.max(2, Math.min(38, y))}`;
    })
    .join(' ');
};

const alertRowClass = (priority) => {
  const normalized = String(priority || '').toLowerCase();
  if (normalized === 'high') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200';
  if (normalized === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
  return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200';
};

const pipelineBarHeight = (value) => {
  const amount = Number(value || 0);
  if (amount <= 0) return 6;
  return Math.max(8, Math.min(40, Math.round(Math.log10(amount + 1) * 12)));
};

const shortLabel = (week) => {
  const raw = String(week || '');
  if (!raw) return '-';
  const parts = raw.split('-');
  return parts.length >= 2 ? `${parts[1]}/${parts[2] || ''}` : raw.slice(-4);
};
</script>

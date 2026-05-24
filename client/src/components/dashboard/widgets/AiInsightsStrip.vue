<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('dashboard.aiInsightsStripAiInsights') }}</h2>
      <span class="text-[11px] text-slate-500 dark:text-slate-400">{{ t('dashboard.aiInsightsStripGeneratedJustNow') }}</span>
    </div>
    <div class="grid grid-cols-1 gap-2 md:grid-cols-4">
      <article
        v-for="(insight, idx) in cards"
        :key="`insight-${idx}`"
        class="rounded-md border p-3"
        :class="cardClass(idx)"
      >
        <div class="flex items-start gap-2">
          <span class="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/70 text-[10px] font-bold dark:bg-slate-900/60">
            {{ insightIcon(idx) }}
          </span>
          <p class="text-xs font-semibold">{{ insight.title }}</p>
        </div>
        <p class="mt-1 text-[11px] opacity-85">{{ insight.body }}</p>
      </article>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
defineProps({
  cards: {
    type: Array,
    default: () => []
  }
});

const { t } = useI18n();

const cardClass = (idx) => [
  'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200',
  'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200'
][idx % 4];

const insightIcon = (idx) => ['>', 'o', '*', '+'][idx % 4];
</script>

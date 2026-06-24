<template>
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <div
      v-for="card in cards"
      :key="card.key"
      class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ card.label }}</p>
      <p v-if="loading" class="mt-2 text-2xl font-bold text-gray-300 dark:text-gray-600">—</p>
      <p v-else class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{{ card.value }}</p>
      <p v-if="card.hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ card.hint }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  loading: { type: Boolean, default: false },
  statistics: { type: Object, default: null },
  formMeta: { type: Object, default: null },
  summaryOverview: { type: Object, default: null },
  isEngagementForm: { type: Boolean, default: false }
});

const { t } = useI18n();

const cards = computed(() => {
  const stats = props.statistics || {};
  const form = props.formMeta || {};
  const overview = props.summaryOverview || {};
  const totalResponses = overview.totalResponses ?? stats.totalResponses ?? form.totalResponses ?? 0;

  if (props.isEngagementForm) {
    const completionRate = Math.round(Number(overview.completionRate ?? 0));
    const avgRating = overview.avgRating != null
      ? Number(overview.avgRating)
      : Number(stats.avgRating ?? form.avgRating ?? 0);
    const satisfaction = overview.satisfactionPercentage;
    const responseRate = Math.round(Number(form.responseRate ?? 0));

    const engagementCards = [
      {
        key: 'total-responses',
        label: t('forms.widgetTotalResponses'),
        value: String(totalResponses),
        hint: null
      },
      {
        key: 'completion-rate',
        label: t('forms.resultsSummaryCompletionRate'),
        value: `${completionRate}%`,
        hint: t('forms.resultsSummaryCompletionHint')
      }
    ];

    if (satisfaction != null) {
      engagementCards.push({
        key: 'satisfaction',
        label: t('forms.settingsKpiSatisfaction'),
        value: `${satisfaction}%`,
        hint: null
      });
    } else if (avgRating > 0) {
      engagementCards.push({
        key: 'avg-rating',
        label: t('forms.widgetAvgRating'),
        value: `${avgRating.toFixed(1)}/5`,
        hint: t('forms.widgetSubtitleStars')
      });
    } else {
      engagementCards.push({
        key: 'questions',
        label: t('forms.resultsSummaryQuestions'),
        value: String(overview.totalQuestions ?? 0),
        hint: t('forms.resultsSummaryQuestionsHint')
      });
    }

    engagementCards.push({
      key: 'response-rate',
      label: t('forms.widgetResponseRate'),
      value: `${responseRate}%`,
      hint: t('forms.widgetSubtitlePercent')
    });

    return engagementCards;
  }

  const avgCompliance = Math.round(Number(stats.avgCompliance ?? form.avgCompliance ?? 0));
  const avgRating = Number(stats.avgRating ?? form.avgRating ?? 0);
  const responseRate = Math.round(Number(form.responseRate ?? 0));

  return [
    {
      key: 'total-responses',
      label: t('forms.widgetTotalResponses'),
      value: String(totalResponses),
      hint: null
    },
    {
      key: 'avg-compliance',
      label: t('forms.widgetAvgCompliance'),
      value: `${avgCompliance}%`,
      hint: t('forms.widgetSubtitlePercent')
    },
    {
      key: 'avg-rating',
      label: t('forms.widgetAvgRating'),
      value: `${avgRating.toFixed(1)}/5`,
      hint: t('forms.widgetSubtitleStars')
    },
    {
      key: 'response-rate',
      label: t('forms.widgetResponseRate'),
      value: `${responseRate}%`,
      hint: t('forms.widgetSubtitlePercent')
    }
  ];
});
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="py-16 text-center">
      <div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-500" />
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('forms.resultsSummaryLoading') }}</p>
    </div>

    <div
      v-else-if="!summary?.supported"
      class="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center dark:border-gray-700"
    >
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('forms.resultsSummaryUnsupported') }}</p>
    </div>

    <template v-else>
      <div
        v-if="overviewCards.length"
        class="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <div
          v-for="card in overviewCards"
          :key="card.key"
          class="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-800/80"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{{ card.value }}</p>
          <p v-if="card.hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ card.hint }}</p>
        </div>
      </div>

      <div
        v-if="overview.totalResponses === 0"
        class="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-800"
      >
        <ChartBarIcon class="mx-auto mb-4 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.resultsSummaryEmptyTitle') }}</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('forms.resultsSummaryEmptyHint') }}</p>
      </div>

      <div v-else class="space-y-8">
        <section
          v-for="section in summary.sections"
          :key="section.sectionId"
          class="space-y-5"
        >
          <div v-if="showSectionTitle(section)" class="border-b border-gray-200 pb-2 dark:border-gray-700">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ section.sectionName }}
            </h3>
          </div>

          <div
            v-for="subsection in section.subsections"
            :key="subsection.subsectionId || subsection.subsectionName || 'root'"
            class="space-y-4"
          >
            <h4
              v-if="showSubsectionTitle(section, subsection)"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {{ subsection.subsectionName }}
            </h4>

            <FormQuestionResultSummary
              v-for="(question, index) in subsection.questions"
              :key="question.questionId"
              :question="question"
              :question-number="questionOffset(section, subsection) + index + 1"
              @expand-text="(questionId) => emit('expand-text', questionId)"
            />
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChartBarIcon } from '@heroicons/vue/24/outline';
import {
  shouldShowEngagementSectionTitle,
  shouldShowEngagementSubsectionTitle
} from '@/utils/engagementFormDisplay';
import FormQuestionResultSummary from './FormQuestionResultSummary.vue';

const props = defineProps({
  summary: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  formName: { type: String, default: '' }
});

const emit = defineEmits(['expand-text']);

const { t } = useI18n();

const overview = computed(() => props.summary?.overview || {});

const overviewCards = computed(() => {
  const data = overview.value;
  const cards = [
    {
      key: 'responses',
      label: t('forms.widgetTotalResponses'),
      value: String(data.totalResponses ?? 0),
      hint: null
    },
    {
      key: 'completion',
      label: t('forms.resultsSummaryCompletionRate'),
      value: `${Math.round(Number(data.completionRate ?? 0))}%`,
      hint: t('forms.resultsSummaryCompletionHint')
    }
  ];

  if (data.avgRating != null) {
    cards.push({
      key: 'rating',
      label: t('forms.widgetAvgRating'),
      value: `${Number(data.avgRating).toFixed(1)}/5`,
      hint: t('forms.widgetSubtitleStars')
    });
  }

  if (data.satisfactionPercentage != null) {
    cards.push({
      key: 'satisfaction',
      label: t('forms.settingsKpiSatisfaction'),
      value: `${data.satisfactionPercentage}%`,
      hint: null
    });
  } else if (data.totalQuestions > 0) {
    cards.push({
      key: 'questions',
      label: t('forms.resultsSummaryQuestions'),
      value: String(data.totalQuestions),
      hint: t('forms.resultsSummaryQuestionsHint')
    });
  }

  return cards.slice(0, 4);
});

const formMeta = computed(() => ({
  name: props.formName,
  formType: props.summary?.formType || 'Survey'
}));

function toSectionShape(section) {
  return {
    sectionId: section?.sectionId,
    name: section?.sectionName || ''
  };
}

function toSubsectionShape(subsection) {
  return {
    subsectionId: subsection?.subsectionId,
    name: subsection?.subsectionName || ''
  };
}

function showSectionTitle(section) {
  return shouldShowEngagementSectionTitle(formMeta.value, toSectionShape(section));
}

function showSubsectionTitle(section, subsection) {
  return shouldShowEngagementSubsectionTitle(
    formMeta.value,
    toSectionShape(section),
    toSubsectionShape(subsection)
  );
}

function questionOffset(section, subsection) {
  let offset = 0;
  for (const currentSection of props.summary?.sections || []) {
    for (const currentSubsection of currentSection.subsections || []) {
      if (currentSection.sectionId === section.sectionId && currentSubsection === subsection) {
        return offset;
      }
      offset += (currentSubsection.questions || []).length;
    }
  }
  return offset;
}
</script>

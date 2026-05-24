<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.comparisonHeading') }}</h2>
        <select
          v-model="selectedComparisonType"
          @change="fetchComparison"
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="last_audit">{{ t('forms.comparisonLastAudit') }}</option>
          <option value="average">{{ t('forms.comparisonAverage') }}</option>
          <option value="specific_audit">{{ t('forms.comparisonSpecific') }}</option>
        </select>
      </div>
    </div>

    <div class="p-6">
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p class="mt-4 text-gray-600 dark:text-gray-400">{{ t('forms.comparisonLoading') }}</p>
      </div>

      <div v-else-if="!hasPreviousResponse || !comparisonData || !comparisonData.comparison" class="text-center py-12 text-gray-500 dark:text-gray-400">
        <svg class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p class="text-sm font-medium">{{ t('forms.comparisonNoPrevious') }}</p>
      </div>

      <div v-else-if="hasMeaningfulData" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('forms.comparisonCurrentScore') }}</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ currentScore }}%
            </p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              {{ comparisonLabel }}
            </h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ comparisonScore }}%
            </p>
            <p
              v-if="showScoreDifference"
              class="text-sm mt-1"
              :class="scoreDifference >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
            >
              {{ scoreDifference >= 0 ? '+' : '' }}{{ scoreDifference }}%
            </p>
          </div>
        </div>

        <div v-if="hasMeaningfulSectionData" class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.comparisonSectionHeading') }}</h3>
          <div class="space-y-3">
            <div
              v-for="(comparison, sectionId) in meaningfulSectionComparisons"
              :key="sectionId"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
                {{ getSectionName(sectionId) }}
              </h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('forms.comparisonCurrent') }}</p>
                  <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        class="bg-indigo-600 h-2 rounded-full"
                        :style="{ width: `${comparison.current}%` }"
                      ></div>
                    </div>
                    <span class="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">
                      {{ comparison.current }}%
                    </span>
                  </div>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ comparisonLabel }}</p>
                  <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        class="bg-gray-600 h-2 rounded-full"
                        :style="{ width: `${comparison.previous}%` }"
                      ></div>
                    </div>
                    <span class="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">
                      {{ comparison.previous }}%
                    </span>
                  </div>
                </div>
              </div>
              <p
                v-if="showSectionDifference(comparison)"
                class="text-xs mt-2"
                :class="comparison.difference >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
              >
                {{ formatSectionChange(comparison.difference) }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="comparisonData.trends && comparisonData.trends.labels && comparisonData.trends.labels.length > 0" class="mt-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('forms.comparisonTrendAnalysis') }}</h3>
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6">
            <TrendsChart :data="comparisonData.trends" />
          </div>
        </div>
      </div>

      <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
        <svg class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p class="text-sm font-medium">{{ t('forms.comparisonNoMeaningful') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import TrendsChart from './TrendsChart.vue';

const { t } = useI18n();

const props = defineProps({
  form: {
    type: Object,
    required: true
  },
  response: {
    type: Object,
    required: true
  }
});

const loading = ref(false);
const selectedComparisonType = ref('last_audit');
const comparisonData = ref(null);
const hasPreviousResponse = ref(false);

const currentScore = computed(() => {
  if (!props.response || !props.response.sectionScores) return 0;
  const scores = Object.values(props.response.sectionScores).filter(s => typeof s === 'number');
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / scores.length);
});

const comparisonScore = computed(() => {
  if (!comparisonData.value || !comparisonData.value.comparison) return 0;
  return comparisonData.value.comparison.overallScore?.previous || comparisonData.value.comparison.previous || 0;
});

const scoreDifference = computed(() => {
  return currentScore.value - comparisonScore.value;
});

const showScoreDifference = computed(() => {
  return !(currentScore.value === 0 && comparisonScore.value === 0);
});

const hasMeaningfulData = computed(() => {
  if (!comparisonData.value || !comparisonData.value.comparison) return false;

  const current = currentScore.value;
  const previous = comparisonScore.value;

  if (current === 0 && previous === 0) return false;

  return true;
});

const meaningfulSectionComparisons = computed(() => {
  if (!comparisonData.value || !comparisonData.value.sectionComparison) return {};

  const filtered = {};
  Object.entries(comparisonData.value.sectionComparison).forEach(([sectionId, comparison]) => {
    if (comparison.current !== 0 || comparison.previous !== 0) {
      filtered[sectionId] = comparison;
    }
  });

  return filtered;
});

const hasMeaningfulSectionData = computed(() => {
  return Object.keys(meaningfulSectionComparisons.value).length > 0;
});

const showSectionDifference = (comparison) => {
  return !(comparison.current === 0 && comparison.previous === 0);
};

const formatSectionChange = (difference) => {
  const prefix = difference >= 0 ? '+' : '';
  return t('forms.comparisonChangeValue', { value: `${prefix}${difference}%` });
};

const comparisonLabel = computed(() => {
  switch (selectedComparisonType.value) {
    case 'last_audit':
      return t('forms.comparisonLastAuditScore');
    case 'average':
      return t('forms.comparisonAverageScore');
    case 'specific_audit':
      return t('forms.comparisonSpecificAuditScore');
    default:
      return t('forms.comparisonScoreDefault');
  }
});

const getSectionName = (sectionId) => {
  if (!props.form || !props.form.sections) return sectionId;
  for (const section of props.form.sections) {
    if (section.sectionId === sectionId) {
      return section.name;
    }
  }
  return sectionId;
};

const fetchComparison = async () => {
  loading.value = true;
  try {
    const result = await apiClient(`/forms/${props.form._id}/responses/${props.response._id}/compare`, {
      method: 'GET',
      params: {
        compareWith: selectedComparisonType.value
      }
    });

    if (result.success) {
      comparisonData.value = result.data;

      if (result.data.comparison !== null && result.data.comparison !== undefined) {
        hasPreviousResponse.value = true;
      } else {
        hasPreviousResponse.value = false;
      }
    } else {
      comparisonData.value = null;
      hasPreviousResponse.value = false;
    }
  } catch (error) {
    console.error('Error fetching comparison:', error);
    comparisonData.value = null;
    hasPreviousResponse.value = false;
  } finally {
    loading.value = false;
  }
};

const checkForPreviousResponse = async () => {
  try {
    const result = await apiClient(`/forms/${props.form._id}/responses/${props.response._id}/compare`, {
      method: 'GET',
      params: {
        compareWith: 'last_audit'
      }
    });

    if (result.success) {
      if (result.data.comparison !== null && result.data.comparison !== undefined) {
        hasPreviousResponse.value = true;
        comparisonData.value = result.data;
      } else {
        hasPreviousResponse.value = false;
      }
    } else {
      hasPreviousResponse.value = false;
    }
  } catch (error) {
    console.error('Error checking for previous response:', error);
    hasPreviousResponse.value = false;
  }
};

onMounted(async () => {
  await checkForPreviousResponse();
});

watch(() => props.response?._id, async () => {
  if (props.response?._id) {
    await checkForPreviousResponse();
  }
});
</script>

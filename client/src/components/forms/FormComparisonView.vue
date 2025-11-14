<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Response Comparison</h2>
        <select
          v-model="selectedComparisonType"
          @change="fetchComparison"
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option value="last_audit">Compare with Last Audit</option>
          <option value="average">Compare with Average</option>
          <option value="specific_audit">Compare with Specific Audit</option>
        </select>
      </div>
    </div>
    
    <div class="p-6">
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        <p class="mt-4 text-gray-600 dark:text-gray-400">Loading comparison...</p>
      </div>

      <div v-else-if="comparisonData" class="space-y-6">
        <!-- Overall Comparison -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Current Score</h3>
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
              class="text-sm mt-1"
              :class="scoreDifference >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
            >
              {{ scoreDifference >= 0 ? '+' : '' }}{{ scoreDifference }}%
            </p>
          </div>
        </div>

        <!-- Section Comparison -->
        <div v-if="comparisonData.sectionComparison && Object.keys(comparisonData.sectionComparison).length > 0" class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Section Comparison</h3>
          <div class="space-y-3">
            <div
              v-for="(comparison, sectionId) in comparisonData.sectionComparison"
              :key="sectionId"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
                {{ getSectionName(sectionId) }}
              </h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</p>
                  <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        class="bg-brand-600 h-2 rounded-full"
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
                class="text-xs mt-2"
                :class="comparison.difference >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
              >
                Change: {{ comparison.difference >= 0 ? '+' : '' }}{{ comparison.difference }}%
              </p>
            </div>
          </div>
        </div>

        <!-- Trend Chart -->
        <div v-if="comparisonData.trends && comparisonData.trends.labels && comparisonData.trends.labels.length > 0" class="mt-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Trend Analysis</h3>
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6">
            <TrendsChart :data="comparisonData.trends" />
          </div>
        </div>
      </div>

      <!-- No Comparison Data -->
      <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
        <svg class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p>No comparison data available. Select a comparison type above.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';
import TrendsChart from './TrendsChart.vue';

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

const comparisonLabel = computed(() => {
  switch (selectedComparisonType.value) {
    case 'last_audit':
      return 'Last Audit Score';
    case 'average':
      return 'Average Score';
    case 'specific_audit':
      return 'Specific Audit Score';
    default:
      return 'Comparison Score';
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
    }
  } catch (error) {
    console.error('Error fetching comparison:', error);
    alert('Failed to load comparison data. Please try again.');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchComparison();
});
</script>


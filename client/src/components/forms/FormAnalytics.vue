<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-gray-600 dark:text-gray-400">Loading analytics...</p>
    </div>

    <!-- Analytics Content -->
    <div v-else class="space-y-6">
      <!-- Row 1: Compliance Trend & Rating Distribution -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compliance Trend</h3>
          <ComplianceTrendChart :form-id="formId" />
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rating Distribution</h3>
          <RatingDistributionChart :form-id="formId" />
        </div>
      </div>

      <!-- Row 2: Section Scores & Response Rate -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Section Scores Comparison</h3>
          <SectionScoresChart :form-id="formId" :form="form" />
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Response Rate Over Time</h3>
          <ResponseRateChart :form-id="formId" />
        </div>
      </div>

      <!-- Row 3: Top Failed Questions -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Failed Questions</h3>
        <TopFailedQuestions :form-id="formId" :form="form" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import ComplianceTrendChart from './analytics/ComplianceTrendChart.vue';
import RatingDistributionChart from './analytics/RatingDistributionChart.vue';
import SectionScoresChart from './analytics/SectionScoresChart.vue';
import ResponseRateChart from './analytics/ResponseRateChart.vue';
import TopFailedQuestions from './analytics/TopFailedQuestions.vue';

const props = defineProps({
  formId: {
    type: String,
    required: true
  },
  form: {
    type: Object,
    default: null
  }
});

const loading = ref(false);
</script>


<template>
  <div>
    <div v-if="loading" class="text-center py-8">
      <div class="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500 rounded-full animate-spin mx-auto mb-2"></div>
      <p class="text-sm text-gray-500 dark:text-gray-400">Loading failed questions...</p>
    </div>

    <div v-else-if="failedQuestions.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      <svg class="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-sm font-medium">No failed questions found</p>
      <p class="text-xs mt-1">All questions are passing!</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="(question, index) in failedQuestions"
        :key="question.questionId"
        class="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
      >
        <div class="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
          <span class="text-sm font-semibold text-red-800 dark:text-red-200">{{ index + 1 }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {{ question.questionText }}
          </p>
          <div class="flex items-center gap-4 mt-2">
            <span class="text-xs text-gray-600 dark:text-gray-400">
              Failed: <span class="font-semibold text-red-600 dark:text-red-400">{{ question.failCount }}</span> times
            </span>
            <span class="text-xs text-gray-600 dark:text-gray-400">
              Section: <span class="font-semibold">{{ question.sectionName }}</span>
            </span>
            <span class="text-xs text-gray-600 dark:text-gray-400">
              Fail Rate: <span class="font-semibold text-red-600 dark:text-red-400">{{ question.failRate }}%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import apiClient from '@/utils/apiClient';

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
const failedQuestions = ref([]);

const sectionNames = computed(() => {
  if (!props.form || !props.form.sections) return {};
  const names = {};
  props.form.sections.forEach(section => {
    names[section.sectionId] = section.name;
    if (section.subsections) {
      section.subsections.forEach(subsection => {
        names[subsection.subsectionId] = subsection.name;
        subsection.questions?.forEach(q => {
          names[q.questionId] = section.name; // Map question to section
        });
      });
    }
  });
  return names;
});

const fetchData = async () => {
  loading.value = true;
  try {
    const response = await apiClient(`/forms/${props.formId}/responses`, {
      method: 'GET',
      params: { limit: 100 }
    });
    
    if (response.success && response.data && response.data.responses) {
      const responses = response.data.responses;
      
      // Count failures per question
      const questionFailures = {};
      let totalResponses = responses.length;
      
      responses.forEach(r => {
        if (r.responseDetails && Array.isArray(r.responseDetails)) {
          r.responseDetails.forEach(detail => {
            if (detail.questionId && detail.passed === false) {
              if (!questionFailures[detail.questionId]) {
                questionFailures[detail.questionId] = {
                  questionId: detail.questionId,
                  questionText: detail.questionText || 'Unknown Question',
                  failCount: 0,
                  sectionId: detail.sectionId
                };
              }
              questionFailures[detail.questionId].failCount++;
          }
          });
        }
      });
      
      // Convert to array and calculate fail rates
      const questions = Object.values(questionFailures).map(q => ({
        ...q,
        sectionName: sectionNames.value[q.sectionId] || 'Unknown Section',
        failRate: totalResponses > 0 ? Math.round((q.failCount / totalResponses) * 100) : 0
      }));
      
      // Sort by fail count (descending) and take top 10
      failedQuestions.value = questions
        .sort((a, b) => b.failCount - a.failCount)
        .slice(0, 10);
    }
  } catch (error) {
    console.error('Error fetching failed questions data:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (props.form) {
    fetchData();
  }
});

watch(() => [props.formId, props.form], () => {
  if (props.form) {
    fetchData();
  }
}, { deep: true });
</script>


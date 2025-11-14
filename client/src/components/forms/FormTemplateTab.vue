<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Response Template</h2>
      <button
        @click="showTemplateModal = true"
        class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-all"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create Template
      </button>
    </div>

    <!-- Template Selection -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Select Template
      </label>
      <select
        v-model="localForm.responseTemplate.templateId"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      >
        <option :value="null">Use Default Template</option>
        <option v-for="template in templates" :key="template._id" :value="template._id">
          {{ template.name }}
        </option>
      </select>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Choose a template to customize how form responses appear in reports
      </p>
    </div>

    <!-- Custom Template Settings -->
    <div v-if="localForm.responseTemplate.customTemplate" class="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
      <h3 class="text-md font-semibold text-gray-900 dark:text-white">Custom Template Settings</h3>
      
      <div class="space-y-3">
        <label class="flex items-center">
          <input
            v-model="localForm.responseTemplate.customTemplate.includeComparison"
            type="checkbox"
            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Include Comparison with Previous Responses</span>
        </label>

        <label class="flex items-center">
          <input
            v-model="localForm.responseTemplate.customTemplate.includeTrends"
            type="checkbox"
            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Include Trends Charts</span>
        </label>

        <label class="flex items-center">
          <input
            v-model="localForm.responseTemplate.customTemplate.includeCharts"
            type="checkbox"
            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Include KPI Charts</span>
        </label>

        <label class="flex items-center">
          <input
            v-model="localForm.responseTemplate.customTemplate.includeCorrectiveActions"
            type="checkbox"
            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Include Corrective Actions Section</span>
        </label>
      </div>
    </div>

    <!-- Template Preview Placeholder -->
    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 border-2 border-dashed border-gray-300 dark:border-gray-600">
      <div class="text-center">
        <svg class="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-gray-600 dark:text-gray-400 mb-2">Template Preview</p>
        <p class="text-sm text-gray-500 dark:text-gray-500">
          Preview will appear here once a template is selected or created
        </p>
        <button
          @click="showPreview = true"
          class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-all"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview Template
        </button>
      </div>
    </div>

    <!-- Template Creation Modal (Placeholder) -->
    <div v-if="showTemplateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="showTemplateModal = false">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Response Template</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          Advanced template builder with drag-drop functionality will be available in a future update.
        </p>
        <div class="flex justify-end gap-2">
          <button
            @click="showTemplateModal = false"
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

const templates = ref([]);
const showTemplateModal = ref(false);
const showPreview = ref(false);

// Initialize localForm with proper defaults
const initializeLocalForm = () => {
  const formData = props.form || {};
  return {
    ...formData,
    responseTemplate: formData.responseTemplate || {
      templateId: null,
      customTemplate: {
        layout: null,
        includeComparison: false,
        includeTrends: false,
        includeCharts: false,
        includeCorrectiveActions: false
      }
    }
  };
};

const localForm = ref(initializeLocalForm());
let isSyncing = false;
let lastEmittedForm = null;

// Only sync when form ID changes (new form loaded)
watch(() => props.form?._id, (newId) => {
  if (newId && newId !== localForm.value._id) {
    isSyncing = true;
    localForm.value = initializeLocalForm();
    lastEmittedForm = null;
    setTimeout(() => { isSyncing = false; }, 100);
  }
}, { immediate: true });

// Watch localForm and emit updates, but prevent circular updates
watch(() => localForm.value, (newForm) => {
  if (!isSyncing) {
    // Only emit if the form actually changed (compare serialized versions)
    const serialized = JSON.stringify(newForm);
    if (serialized !== lastEmittedForm) {
      lastEmittedForm = serialized;
      emit('update', JSON.parse(serialized));
    }
  }
}, { deep: true });

const fetchTemplates = async () => {
  try {
    // TODO: Implement API endpoint for fetching response templates
    // For now, use empty array
    templates.value = [];
  } catch (error) {
    console.error('Error fetching templates:', error);
    templates.value = [];
  }
};

onMounted(() => {
  fetchTemplates();
});
</script>

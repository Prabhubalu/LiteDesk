<template>
  <div class="w-full">
    <!-- Header -->
    <header class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('process.flowListTitle') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('process.flowListDescription') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Always visible: Start with Template CTA -->
        <button
          @click="openTemplates"
          class="px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
        >
          {{ t('process.flowStartWithTemplate') }}
        </button>
        <button
          @click="createFlow"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {{ t('process.flowCreateFromScratch') }}
        </button>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ error }}
    </div>

    <!-- Empty State (Improved) -->
    <div v-else-if="flows.length === 0" class="text-center py-16 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {{ t('process.flowEmptyTitle') }}
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
        {{ t('process.flowEmptyMessage') }}
      </p>
      <div class="flex items-center justify-center gap-3">
        <button
          @click="openTemplates"
          class="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {{ t('process.flowStartWithTemplateBtn') }}
        </button>
        <button
          @click="createFlow"
          class="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {{ t('process.flowCreateFromScratchBtn') }}
        </button>
      </div>
    </div>

    <!-- Flows List -->
    <div v-else class="space-y-3">
      <div
        v-for="flow in flows"
        :key="flow._id"
        class="border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ flow.name }}
              </h3>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                {{ flow.appKey }}
              </span>
            </div>

            <p v-if="flow.description" class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {{ flow.description }}
            </p>

            <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>
                <span class="font-medium">{{ t('process.flowMetaProcesses') }}</span>
                {{ t('process.flowProcessCount', { count: flow.processIds?.length || 0 }) }}
              </div>
              <div v-if="flow.updatedAt">
                <span class="font-medium">{{ t('process.flowMetaLastUpdated') }}</span>
                {{ formatDate(flow.updatedAt) }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="viewFlow(flow)"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {{ t('common.viewRecord') }}
            </button>
            <button
              @click="editFlow(flow)"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {{ t('actions.edit') }}
            </button>
            <button
              @click="confirmDelete(flow)"
              class="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              {{ t('actions.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="deletingFlow"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="deletingFlow = null"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('process.flowDeleteModalTitle') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {{ t('process.flowDeleteConfirm', { name: deletingFlow.name }) }}
        </p>
        <div class="flex items-center justify-end gap-3">
          <button
            @click="deletingFlow = null"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            @click="handleDelete"
            :disabled="processing"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ processing ? t('process.flowDeleting') : t('actions.delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Template Selection Modal (Improved) -->
    <div
      v-if="showTemplates"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="showTemplates = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('process.flowTemplateModalTitle') }}
            </h3>
            <button
              @click="showTemplates = false"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {{ t('process.flowTemplateModalHint') }}
          </p>

          <!-- Loading -->
          <div v-if="loadingTemplates" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('process.flowLoadingTemplates') }}</p>
          </div>

          <!-- Templates Grid (Improved cards) -->
          <div v-else-if="templates.length > 0" class="grid md:grid-cols-2 gap-4">
            <div
              v-for="template in templates"
              :key="template.key"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer group"
              @click="selectTemplate(template)"
            >
              <div class="flex items-start justify-between gap-3 mb-3">
                <h4 class="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {{ template.name }}
                </h4>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex-shrink-0">
                  {{ template.appKey }}
                </span>
              </div>
              
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {{ template.description }}
              </p>
              
              <!-- What this sets up -->
              <div v-if="template.highlights && template.highlights.length > 0" class="mb-3">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{{ t('process.flowTemplateHighlights') }}</p>
                <ul class="space-y-1">
                  <li
                    v-for="(highlight, idx) in template.highlights"
                    :key="idx"
                    class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                  >
                    <svg class="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    {{ highlight }}
                  </li>
                </ul>
              </div>
              
              <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{{ t('process.flowProcessCount', { count: template.processCount }) }}</span>
                <span class="text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline">
                  {{ t('process.flowTemplateSelect') }}
                </span>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-8">
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('process.flowNoTemplates') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Template Import Confirmation (Improved copy) -->
    <div
      v-if="selectedTemplate"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="selectedTemplate = null"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {{ t('process.flowImportTitle', { name: selectedTemplate.name }) }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {{ t('process.flowImportBody', { count: selectedTemplate.processCount }) }}
        </p>
        
        <!-- What will be created -->
        <div v-if="selectedTemplate.highlights && selectedTemplate.highlights.length > 0" class="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('process.flowImportWhatCreated') }}</p>
          <ul class="space-y-1">
            <li
              v-for="(highlight, idx) in selectedTemplate.highlights"
              :key="idx"
              class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
            >
              <svg class="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              {{ highlight }}
            </li>
          </ul>
        </div>
        
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <p class="text-xs text-blue-800 dark:text-blue-200">
            {{ t('process.flowImportNote') }}
          </p>
        </div>
        <div class="flex items-center justify-end gap-3">
          <button
            @click="selectedTemplate = null"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            @click="confirmImport"
            :disabled="importing"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ importing ? t('process.flowImporting') : t('process.flowImportTemplate') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { formatUserDateTime } from '@/utils/localeFormat';

const { t } = useI18n();
const router = useRouter();
const { success: showSuccess, error: showError } = useNotifications();

const flows = ref([]);
const loading = ref(true);
const error = ref(null);
const deletingFlow = ref(null);
const processing = ref(false);
const showTemplates = ref(false);
const templates = ref([]);
const loadingTemplates = ref(false);
const selectedTemplate = ref(null);
const importing = ref(false);

const loadFlows = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get('/admin/business-flows');
    flows.value = response.data || [];
  } catch (err) {
    error.value = err.message || t('process.flowLoadFailed');
    console.error('Error loading business flows:', err);
  } finally {
    loading.value = false;
  }
};

const loadTemplates = async () => {
  loadingTemplates.value = true;
  try {
    const response = await apiClient.get('/admin/business-flow-templates');
    templates.value = response.data || [];
  } catch (err) {
    console.error('Error loading templates:', err);
    templates.value = [];
  } finally {
    loadingTemplates.value = false;
  }
};

const openTemplates = () => {
  showTemplates.value = true;
  if (templates.value.length === 0) {
    loadTemplates();
  }
};

const selectTemplate = (template) => {
  selectedTemplate.value = template;
  showTemplates.value = false;
};

const confirmImport = async () => {
  if (!selectedTemplate.value || importing.value) return;
  importing.value = true;
  try {
    const response = await apiClient.post(`/admin/business-flow-templates/${selectedTemplate.value.key}/import`);
    if (response.success) {
      showSuccess(t('process.flowImportSuccess'));
      selectedTemplate.value = null;
      await loadFlows();
      // Navigate to the imported flow
      if (response.data?.businessFlowId) {
        router.push(`/settings/automation/flows/${response.data.businessFlowId}`);
      }
    } else {
      showError(response.message || t('process.flowImportFailed'));
    }
  } catch (err) {
    showError(err.message || t('process.flowImportFailed'));
  } finally {
    importing.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return formatUserDateTime(date);
};

const createFlow = () => {
  router.push('/settings/automation/flows/create');
};

const viewFlow = (flow) => {
  router.push(`/settings/automation/flows/${flow._id}`);
};

const editFlow = (flow) => {
  router.push(`/settings/automation/flows/${flow._id}/edit`);
};

const confirmDelete = (flow) => {
  deletingFlow.value = flow;
};

const handleDelete = async () => {
  if (!deletingFlow.value || processing.value) return;
  processing.value = true;
  try {
    const response = await apiClient.delete(`/admin/business-flows/${deletingFlow.value._id}`);
    if (response.success) {
      showSuccess(t('process.flowDeleteSuccess'));
      deletingFlow.value = null;
      await loadFlows();
    } else {
      showError(response.message || t('process.flowDeleteFailed'));
    }
  } catch (err) {
    showError(err.message || t('process.flowDeleteFailed'));
  } finally {
    processing.value = false;
  }
};

onMounted(() => {
  document.title = t('process.flowListPageTitle');
  loadFlows();
});
</script>

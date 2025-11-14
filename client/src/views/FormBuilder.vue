<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">Loading form...</p>
      </div>
    </div>

    <!-- Form Builder -->
    <div v-else class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-4">
          <button 
            @click="$router.push('/forms')" 
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span class="font-medium">Back to Forms</span>
          </button>
          
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ form?.name || 'New Form' }}
            </h1>
            <p v-if="form?.formId" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ form.formId }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Success Message -->
          <Transition
            enter-active-class="transition ease-out duration-300"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition ease-in duration-200"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <div
              v-if="successMessage"
              class="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-sm font-medium">{{ successMessage }}</span>
            </div>
          </Transition>

          <!-- Error Message -->
          <Transition
            enter-active-class="transition ease-out duration-300"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition ease-in duration-200"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <div
              v-if="errorMessage"
              class="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span class="text-sm font-medium">{{ errorMessage }}</span>
            </div>
          </Transition>

          <button
            @click="saveForm"
            :disabled="saving"
            class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-all disabled:opacity-50"
          >
            <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
          
          <button
            v-if="form?._id"
            @click="previewForm"
            class="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-all"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex -mb-px">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              ]"
            >
              {{ tab.label }}
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="p-6">
          <!-- Details Tab -->
          <FormDetailsTab
            v-if="activeTab === 'details'"
            :form="form"
            @update="handleFormUpdate"
          />

          <!-- Sections Tab -->
          <SectionsBuilder
            v-if="activeTab === 'sections'"
            :form="form"
            @update="handleFormUpdate"
          />

          <!-- Settings Tab -->
          <FormSettingsTab
            v-if="activeTab === 'settings'"
            :form="form"
            @update="handleFormUpdate"
          />

          <!-- Template Tab -->
          <FormTemplateTab
            v-if="activeTab === 'template'"
            :form="form"
            @update="handleFormUpdate"
          />
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showPreviewModal"
        class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        @click.self="closePreviewModal"
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Modal Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Form Preview</h2>
            <button
              @click="closePreviewModal"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <FormPreview
              :form="form"
              @close="closePreviewModal"
              @submit="handlePreviewSubmit"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import FormDetailsTab from '@/components/forms/FormDetailsTab.vue';
import SectionsBuilder from '@/components/forms/SectionsBuilder.vue';
import FormSettingsTab from '@/components/forms/FormSettingsTab.vue';
import FormTemplateTab from '@/components/forms/FormTemplateTab.vue';
import FormPreview from '@/components/forms/FormPreview.vue';

const route = useRoute();
const router = useRouter();

// Props
const props = defineProps({
  formId: {
    type: String,
    default: null
  }
});

// State
const loading = ref(false);
const saving = ref(false);
const activeTab = ref('details');
const successMessage = ref('');
const errorMessage = ref('');
const isManualSave = ref(false); // Flag to prevent auto-save during manual save
const showPreviewModal = ref(false);
const form = ref({
  name: '',
  description: '',
  formType: 'Audit',
  linkedModule: null,
  visibility: 'Internal',
  status: 'Draft',
  assignedTo: null,
  expiryDate: null,
  tags: [],
  approvalRequired: false,
  linkedReport: null,
  attachments: [],
  notes: '',
  sections: [],
  kpiMetrics: [],
  scoringFormula: '',
  thresholds: {
    pass: 80,
    partial: 50
  },
  autoAssignment: false,
  workflowOnSubmit: [],
  publicLink: {
    enabled: false,
    slug: '',
    url: ''
  },
  formVersion: 1
});

const tabs = [
  { id: 'details', label: 'Details' },
  { id: 'sections', label: 'Sections & Questions' },
  { id: 'settings', label: 'Settings' },
  { id: 'template', label: 'Response Template' }
];

// Computed
const formIdFromRoute = computed(() => {
  return props.formId || route.params.id || null;
});

// Methods
const handleFormUpdate = (updatedForm) => {
  // Only update if the form actually changed and we're not currently saving
  // This prevents updates during save operations which would trigger auto-save
  if (!saving.value && !isManualSave.value) {
    const currentSerialized = JSON.stringify(form.value);
    const updatedSerialized = JSON.stringify(updatedForm);
    if (currentSerialized !== updatedSerialized) {
      form.value = { ...updatedForm };
    }
  }
};

const fetchForm = async () => {
  if (!formIdFromRoute.value) {
    // New form - use defaults
    return;
  }

  loading.value = true;
  try {
    const response = await apiClient(`/forms/${formIdFromRoute.value}`, {
      method: 'GET'
    });

    if (response.success) {
      const fetchedForm = response.data || form.value;
      form.value = fetchedForm;
      // Initialize lastSavedForm to prevent immediate auto-save after fetch
      lastSavedForm = JSON.stringify(fetchedForm);
    }
  } catch (error) {
    console.error('Error fetching form:', error);
  } finally {
    loading.value = false;
  }
};

const saveForm = async (isAutoSave = false) => {
  // Prevent auto-save if manual save is in progress
  if (!isAutoSave && saving.value) {
    return;
  }
  
  saving.value = true;
  successMessage.value = '';
  errorMessage.value = '';
  isManualSave.value = !isAutoSave; // Set flag for manual saves
  try {
    const url = formIdFromRoute.value ? `/forms/${formIdFromRoute.value}` : '/forms';
    const method = formIdFromRoute.value ? 'PUT' : 'POST';

    // Transform form data to match backend structure
    const formData = {
      ...form.value,
      // Transform kpiMetrics from array to object structure
      kpiMetrics: Array.isArray(form.value.kpiMetrics) 
        ? {
            compliancePercentage: form.value.kpiMetrics.includes('Compliance %'),
            satisfactionPercentage: form.value.kpiMetrics.includes('Satisfaction %'),
            rating: form.value.kpiMetrics.includes('Rating')
          }
        : form.value.kpiMetrics || {
            compliancePercentage: false,
            satisfactionPercentage: false,
            rating: false
          },
      // Transform autoAssignment from boolean to object structure
      autoAssignment: typeof form.value.autoAssignment === 'boolean'
        ? {
            enabled: form.value.autoAssignment,
            linkTo: 'org'
          }
        : form.value.autoAssignment || {
            enabled: false,
            linkTo: 'org'
          },
      // Transform workflowOnSubmit from array to object structure
      workflowOnSubmit: Array.isArray(form.value.workflowOnSubmit)
        ? {
            notify: [],
            createTask: form.value.workflowOnSubmit.includes('Create Task'),
            updateField: null
          }
        : form.value.workflowOnSubmit || {
            notify: [],
            createTask: false,
            updateField: null
          },
      // Ensure scoringFormula has a default value
      scoringFormula: form.value.scoringFormula || '(Passed / Total) × 100',
      // Handle publicLink - only include slug if enabled and slug exists
      // Empty slug causes duplicate key error due to unique index
      publicLink: form.value.publicLink && form.value.publicLink.enabled && form.value.publicLink.slug
        ? {
            enabled: true,
            slug: form.value.publicLink.slug
          }
        : {
            enabled: false
            // Don't include slug if empty to avoid duplicate key error
          }
    };

    // Ensure required fields are present
    if (!formData.name || !formData.name.trim()) {
      throw new Error('Form name is required');
    }
    if (!formData.formType) {
      formData.formType = 'Audit';
    }

    // Clean up sections/subsections/questions to ensure they have required fields
    if (formData.sections && Array.isArray(formData.sections)) {
      formData.sections = formData.sections.map((section, sIdx) => {
        // Ensure section has required fields
        if (!section.sectionId) {
          section.sectionId = `SEC-${Date.now()}-${sIdx}`;
        }
        if (!section.name) {
          section.name = `Section ${sIdx + 1}`;
        }
        
        // Clean up subsections
        if (section.subsections && Array.isArray(section.subsections)) {
          section.subsections = section.subsections.map((subsection, subIdx) => {
            if (!subsection.subsectionId) {
              subsection.subsectionId = `SUB-${Date.now()}-${subIdx}`;
            }
            if (!subsection.name) {
              subsection.name = `Subsection ${subIdx + 1}`;
            }
            
            // Clean up questions
            if (subsection.questions && Array.isArray(subsection.questions)) {
              subsection.questions = subsection.questions.map((question, qIdx) => {
                if (!question.questionId) {
                  question.questionId = `Q-${Date.now()}-${qIdx}`;
                }
                if (!question.questionText || !question.questionText.trim()) {
                  question.questionText = 'New Question';
                }
                // Ensure conditionalLogic structure is correct
                if (!question.conditionalLogic || !question.conditionalLogic.showIf) {
                  question.conditionalLogic = {
                    showIf: {
                      questionId: '',
                      operator: 'equals',
                      value: null
                    }
                  };
                }
                return question;
              });
            }
            return subsection;
          });
        }
        return section;
      });
    }

    // Create clean payload with only fields that should be sent
    const payload = {
      name: formData.name,
      description: formData.description || '',
      formType: formData.formType,
      linkedModule: formData.linkedModule || null,
      visibility: formData.visibility,
      status: formData.status,
      assignedTo: formData.assignedTo || null,
      expiryDate: formData.expiryDate || null,
      tags: formData.tags || [],
      approvalRequired: formData.approvalRequired || false,
      linkedReport: formData.linkedReport || null,
      attachments: formData.attachments || [],
      notes: formData.notes || '',
      sections: formData.sections || [],
      kpiMetrics: formData.kpiMetrics,
      scoringFormula: formData.scoringFormula,
      thresholds: formData.thresholds,
      autoAssignment: formData.autoAssignment,
      workflowOnSubmit: formData.workflowOnSubmit,
      approvalWorkflow: formData.approvalWorkflow?.enabled 
        ? formData.approvalWorkflow 
        : { enabled: false },
      publicLink: formData.publicLink?.enabled && formData.publicLink?.slug
        ? { enabled: true, slug: formData.publicLink.slug }
        : { enabled: false },
      responseTemplate: formData.responseTemplate?.templateId
        ? {
            templateId: formData.responseTemplate.templateId,
            customTemplate: formData.responseTemplate.customTemplate || null
          }
        : formData.responseTemplate?.customTemplate
          ? { customTemplate: formData.responseTemplate.customTemplate }
          : undefined
    };

    // Clean up null/empty values that shouldn't be sent
    // Remove responseTemplate if it's empty
    if (!payload.responseTemplate || (!payload.responseTemplate.templateId && (!payload.responseTemplate.customTemplate || !payload.responseTemplate.customTemplate.layout))) {
      delete payload.responseTemplate;
    } else if (payload.responseTemplate.customTemplate && payload.responseTemplate.customTemplate.layout === null) {
      // Remove layout if it's null
      delete payload.responseTemplate.customTemplate.layout;
    }
    
    // Remove updateField if null
    if (payload.workflowOnSubmit && payload.workflowOnSubmit.updateField === null) {
      delete payload.workflowOnSubmit.updateField;
    }
    
    // Clean up conditionalLogic.showIf if questionId is empty (not being used)
    if (payload.sections && Array.isArray(payload.sections)) {
      payload.sections.forEach(section => {
        if (section.subsections) {
          section.subsections.forEach(subsection => {
            if (subsection.questions) {
              subsection.questions.forEach(question => {
                if (question.conditionalLogic && question.conditionalLogic.showIf && !question.conditionalLogic.showIf.questionId) {
                  // Remove showIf if questionId is empty (conditional logic not set)
                  delete question.conditionalLogic.showIf;
                  // If showIf is removed and conditionalLogic is empty, remove it
                  if (Object.keys(question.conditionalLogic).length === 0) {
                    delete question.conditionalLogic;
                  }
                }
              });
            }
          });
        }
      });
    }

    // Debug: Log the payload being sent (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('Saving form payload:', JSON.stringify(payload, null, 2));
    }

    const response = await apiClient(url, {
      method,
      body: JSON.stringify(payload)
    });

    if (response.success) {
      // Update form ID if it's a new form
      const savedForm = response.data || form.value;
      if (!formIdFromRoute.value && savedForm?._id) {
        // Update the existing tab's path and title instead of creating a new one
        const { tabs, activeTabId, findTabByPath } = useTabs();
        const currentTab = tabs.value.find(tab => tab.id === activeTabId.value);
        
        if (currentTab && currentTab.path === '/forms/builder') {
          // Update existing tab
          currentTab.path = `/forms/builder/${savedForm._id}`;
          currentTab.title = savedForm.name || 'Form Builder';
          currentTab.name = `form-builder-${savedForm._id}`;
        } else {
          // Tab doesn't exist or path changed, use openTab to update/create
          const { openTab } = useTabs();
          openTab(`/forms/builder/${savedForm._id}`, {
            name: `form-builder-${savedForm._id}`,
            title: savedForm.name || 'Form Builder',
            component: 'FormBuilder',
            params: { formId: savedForm._id }
          });
        }
        
        // Use replace to update URL without creating history entry
        router.replace(`/forms/builder/${savedForm._id}`);
      }
      
      // Update form and mark as saved (prevent auto-save trigger)
      lastSavedForm = JSON.stringify(savedForm);
      form.value = savedForm;
      
      // Show success message only for manual saves
      if (!isAutoSave) {
        successMessage.value = formIdFromRoute.value ? 'Form updated successfully!' : 'Form created successfully!';
        setTimeout(() => {
          successMessage.value = '';
        }, 3000);
      }
    }
  } catch (error) {
    console.error('Error saving form:', error);
    console.error('Error details:', error.response?.data || error);
    
    // Only show error for manual saves (auto-save errors are silent)
    if (!isAutoSave) {
      // Extract detailed error message from response
      const errorDetails = error.response?.data;
      let errorMsg = error.message || 'Error saving form. Please try again.';
      
      if (errorDetails?.error) {
        errorMsg = errorDetails.error;
      } else if (errorDetails?.message) {
        errorMsg = errorDetails.message;
      }
      
      errorMessage.value = errorMsg;
      setTimeout(() => {
        errorMessage.value = '';
      }, 5000);
    }
  } finally {
    saving.value = false;
    isManualSave.value = false;
  }
};

const previewForm = () => {
  // Show preview modal
  showPreviewModal.value = true;
};

const handlePreviewSubmit = (previewData) => {
  // Handle preview form submission (for testing)
  console.log('Preview form submitted:', previewData);
  // You could show a success message or navigate to public form
  showPreviewModal.value = false;
  // Optionally open public form if available
  if (form.value.publicLink?.enabled && form.value.publicLink?.slug) {
    window.open(`/forms/public/${form.value.publicLink.slug}`, '_blank');
  }
};

const closePreviewModal = () => {
  showPreviewModal.value = false;
};

const enablePublicLink = async () => {
  if (!formIdFromRoute.value) return;

  try {
    const response = await apiClient(`/forms/${formIdFromRoute.value}/enable-public`, {
      method: 'POST'
    });

    if (response.success && response.data) {
      // Backend returns: { success: true, data: populatedForm }
      // So response.data is the form object with publicLink property
      const updatedForm = response.data;
      
      if (updatedForm.publicLink) {
        form.value.publicLink = updatedForm.publicLink;
        const slug = updatedForm.publicLink.slug;
        if (slug) {
          window.open(`/forms/public/${slug}`, '_blank');
        } else {
          console.error('Public link enabled but slug is missing');
          errorMessage.value = 'Public link enabled but slug is missing.';
          setTimeout(() => { errorMessage.value = ''; }, 5000);
        }
      } else {
        console.error('Public link not found in response:', response);
        errorMessage.value = 'Public link not found in server response.';
        setTimeout(() => { errorMessage.value = ''; }, 5000);
      }
    } else {
      console.error('Unexpected response structure:', response);
      errorMessage.value = 'Unexpected response from server.';
      setTimeout(() => { errorMessage.value = ''; }, 5000);
    }
  } catch (error) {
    console.error('Error enabling public link:', error);
    errorMessage.value = 'Failed to enable public link. Please try again.';
    setTimeout(() => {
      errorMessage.value = '';
    }, 5000);
  }
};

// Auto-save on form changes (debounced)
let autoSaveTimer = null;
let lastSavedForm = null;

watch(() => form.value, (newForm) => {
  // Skip auto-save if:
  // 1. No form ID (new form, not saved yet)
  // 2. Form name is empty
  // 3. Manual save is in progress
  // 4. Currently saving
  // 5. Form status is not 'Draft' (only Draft forms can be edited)
  // 6. Form hasn't actually changed (compare serialized versions)
  if (!formIdFromRoute.value || !form.value.name || isManualSave.value || saving.value) {
    return;
  }
  
  // Only allow auto-save for Draft forms
  if (form.value.status && form.value.status !== 'Draft') {
    return;
  }
  
  // Compare with last saved version to prevent unnecessary saves
  const serialized = JSON.stringify(newForm);
  if (serialized === lastSavedForm) {
    return;
  }
  
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    // Only auto-save if form actually changed, we're not in the middle of a save, and form is Draft
    if (!saving.value && !isManualSave.value && form.value.status === 'Draft') {
      const currentSerialized = JSON.stringify(form.value);
      if (currentSerialized !== lastSavedForm) {
        saveForm(true); // Pass true to indicate this is an auto-save
        lastSavedForm = currentSerialized;
      }
    }
  }, 3000); // Increased to 3 seconds to reduce frequency
}, { deep: true });

// Lifecycle
onMounted(() => {
  fetchForm();
});
</script>


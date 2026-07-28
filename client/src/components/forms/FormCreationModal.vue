<template>
  <Teleport to="body">
    <div
      v-if="props.isOpen"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      @click.self="handleClose"
      style="z-index: 9999;"
    >
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ isEditing ? t('forms.editFormTitle') : t('forms.createNewFormTitle') }}
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ isEditing ? t('forms.editFormSubtitle') : t('forms.createNewFormSubtitle') }}
              </p>
            </div>
            <button
              type="button"
              :aria-label="t('actions.close')"
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              @click="handleClose"
            >
              <XMarkIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <!-- Progress Stepper -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <nav :aria-label="t('forms.wizardProgressAria')">
              <ol role="list" class="divide-y divide-gray-300 dark:divide-gray-700 rounded-md border border-gray-300 dark:border-gray-700 md:flex md:divide-y-0">
                <li
                  v-for="(step, stepIdx) in steps"
                  :key="step.id"
                  class="relative md:flex md:flex-1"
                >
                  <a
                    v-if="step.status === 'complete'"
                    href="#"
                    @click.prevent="goToStep(stepIdx)"
                    class="group flex w-full items-center cursor-pointer"
                  >
                    <span class="flex items-center px-6 py-4 text-sm font-medium">
                      <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 group-hover:bg-indigo-800">
                        <CheckIcon class="size-6 text-white" aria-hidden="true" />
                      </span>
                      <span class="ml-4 text-sm font-medium text-gray-900 dark:text-white">{{ step.name }}</span>
                    </span>
                  </a>
                  <a
                    v-else-if="step.status === 'current'"
                    href="#"
                    @click.prevent
                    class="flex items-center px-6 py-4 text-sm font-medium cursor-default"
                    aria-current="step"
                  >
                    <span class="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-indigo-600">
                      <span class="text-indigo-600 dark:text-indigo-400">{{ step.id }}</span>
                    </span>
                    <span class="ml-4 text-sm font-medium text-indigo-600 dark:text-indigo-400">{{ step.name }}</span>
                  </a>
                  <a
                    v-else
                    href="#"
                    @click.prevent="goToStep(stepIdx)"
                    class="group flex items-center cursor-pointer"
                  >
                    <span class="flex items-center px-6 py-4 text-sm font-medium">
                      <span class="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600 group-hover:border-gray-400 dark:group-hover:border-gray-500">
                        <span class="text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100">{{ step.id }}</span>
                      </span>
                      <span class="ml-4 text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100">{{ step.name }}</span>
                    </span>
                  </a>
                  <template v-if="stepIdx !== steps.length - 1">
                    <!-- Arrow separator for lg screens and up -->
                    <div class="absolute top-0 right-0 hidden h-full w-5 md:block" aria-hidden="true">
                      <svg class="size-full text-gray-300 dark:text-gray-700" viewBox="0 0 22 80" fill="none" preserveAspectRatio="none">
                        <path d="M0 -2L20 40L0 82" vector-effect="non-scaling-stroke" stroke="currentcolor" stroke-linejoin="round" />
                      </svg>
                    </div>
                  </template>
                </li>
              </ol>
            </nav>
          </div>

          <!-- Step Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Step 1: Form Details -->
            <div v-if="currentStepIndex === 0" class="space-y-6">
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('forms.wizardStepFormDetails') }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {{ t('forms.wizardFormDetailsIntro') }}
                </p>
              </div>

              <div class="space-y-4">
                <!-- Form Name -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('forms.fieldFormName') }} <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="formData.name"
                    type="text"
                    required
                    maxlength="255"
                    :placeholder="t('forms.fieldFormNamePh')"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <!-- Form Type -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('forms.fieldFormType') }} <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model="formData.formType"
                    required
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="Audit">{{ t('forms.typeAudit') }}</option>
                    <option value="Survey">{{ t('forms.typeSurvey') }}</option>
                    <option value="Feedback">{{ t('forms.typeFeedback') }}</option>
                    <option value="Inspection">{{ t('forms.typeInspection') }}</option>
                    <option value="Custom">{{ t('forms.typeCustom') }}</option>
                  </select>
                </div>

                <!-- Description -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('forms.fieldDescription') }}
                  </label>
                  <textarea
                    v-model="formData.description"
                    rows="3"
                    maxlength="1000"
                    :placeholder="t('forms.fieldDescriptionPh')"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  ></textarea>
                </div>

                <!-- Visibility -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('forms.fieldVisibility') }}
                  </label>
                  <select
                    v-model="formData.visibility"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="Internal">{{ t('forms.visibilityInternal') }}</option>
                    <option value="Partner">{{ t('forms.visibilityPartner') }}</option>
                    <option value="Public">{{ t('forms.visibilityPublic') }}</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Step 2: Sections & Questions -->
            <div v-else-if="currentStepIndex === 1" class="space-y-6">
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('forms.wizardStepSectionsQuestions') }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {{ t('forms.wizardSectionsIntro') }}
                </p>
              </div>

              <!-- Sections Builder -->
              <SectionsBuilder
                :key="`sections-${currentStepIndex}-${(formData.sections || []).length}`"
                :form="formData"
                @update="handleSectionsUpdate"
              />
            </div>

            <!-- Step 3: Settings & Logic -->
            <div v-else-if="currentStepIndex === 2" class="space-y-6">
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('forms.wizardStepSettingsLogic') }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {{ t('forms.wizardSettingsIntro') }}
                </p>
              </div>

              <!-- Settings Tab -->
              <FormSettingsTab
                :key="`settings-${currentStepIndex}`"
                :form="formData"
                @update="handleSettingsUpdate"
              />
            </div>

            <!-- Step 4: Preview -->
            <div v-else-if="currentStepIndex === 3" class="space-y-6">
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('forms.wizardStepPreview') }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {{ t('forms.wizardPreviewIntro') }}
                </p>
              </div>

              <!-- Preview -->
              <div class="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <FormPreview
                  :key="`preview-${currentStepIndex}`"
                  :form="formData"
                  @close="() => {}"
                  @submit="() => {}"
                />
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              @click="handleClose"
            >
              {{ t('actions.cancel') }}
            </button>
            <div class="flex items-center gap-3">
              <button
                v-if="currentStepIndex > 0"
                type="button"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                @click="previousStep"
              >
                {{ t('actions.previous') }}
              </button>
              <button
                v-if="currentStepIndex < steps.length - 1"
                type="button"
                :disabled="!canProceed"
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                :title="!canProceed ? t('forms.nextStepBlockedTitle') : undefined"
                @click="nextStep"
              >
                {{ t('actions.next') }}
              </button>
              <button
                v-else
                type="button"
                :disabled="saving || !canSubmit"
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                @click="handleSubmit"
              >
                <span v-if="saving">{{ t('states.saving') }}</span>
                <span v-else>{{ isEditing ? t('forms.updateFormSubmit') : t('forms.createFormSubmit') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { TabGroup, TabPanels, TabPanel } from '@headlessui/vue';
import { CheckIcon, XMarkIcon } from '@heroicons/vue/24/solid';
import apiClient from '@/utils/apiClient';
import { useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import { useAuthStore } from '@/stores/authRegistry';
import SectionsBuilder from '@/components/forms/SectionsBuilder.vue';
import FormSettingsTab from '@/components/forms/FormSettingsTab.vue';
import FormPreview from '@/components/forms/FormPreview.vue';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();


const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  form: {
    type: Object,
    default: null
  }
});

// Debug: Log props on mount
console.log('FormCreationModal component mounted');
console.log('Initial isOpen prop:', props.isOpen);

// Watch isOpen prop for debugging
watch(() => props.isOpen, (newVal) => {
  console.log('FormCreationModal isOpen prop changed to:', newVal);
  console.log('Modal should be visible:', newVal);
}, { immediate: true });

const emit = defineEmits(['close', 'created', 'updated']);

const router = useRouter();
const { openTab } = useTabs();
const authStore = useAuthStore();
const getDefaultAssignedTo = () => authStore.user?._id || null;

const isEditing = computed(() => !!props.form?._id);
const saving = ref(false);
const currentStepIndex = ref(0);

const formData = ref({
  name: '',
  description: '',
  formType: 'Audit',
  visibility: 'Internal',
  status: 'Draft',
  assignedTo: getDefaultAssignedTo(),
  expiryDate: null,
  tags: [],
  approvalRequired: false,
  sections: [],
  kpiMetrics: {
    compliancePercentage: false,
    satisfactionPercentage: false,
    rating: false
  },
  scoringFormula: '(Passed / Total) × 100',
  thresholds: {
    pass: 80,
    partial: 50
  },
  autoAssignment: {
    enabled: false,
    linkTo: 'org'
  },
  workflowOnSubmit: {
    notify: [],
    createTask: false,
    updateField: null
  },
  approvalWorkflow: {
    enabled: false,
    approver: null
  },
  formVersion: 1,
  publicLink: {
    enabled: false,
    slug: ''
  },
  responseTemplate: {
    templateId: null,
    customTemplate: {
      layout: null,
      includeComparison: false,
      includeTrends: false,
      includeCharts: false,
      includeCorrectiveActions: false
    }
  }
});

const steps = computed(() => [
  {
    id: '01',
    name: t('forms.wizardStepFormDetails'),
    status: currentStepIndex.value > 0 ? 'complete' : currentStepIndex.value === 0 ? 'current' : 'upcoming'
  },
  {
    id: '02',
    name: t('forms.wizardStepSectionsQuestions'),
    status: currentStepIndex.value > 1 ? 'complete' : currentStepIndex.value === 1 ? 'current' : 'upcoming'
  },
  {
    id: '03',
    name: t('forms.wizardStepSettingsLogic'),
    status: currentStepIndex.value > 2 ? 'complete' : currentStepIndex.value === 2 ? 'current' : 'upcoming'
  },
  {
    id: '04',
    name: t('forms.wizardStepPreview'),
    status: currentStepIndex.value === 3 ? 'current' : currentStepIndex.value > 3 ? 'complete' : 'upcoming'
  }
]);

const canProceed = computed(() => {
  // Step 0: Form Details - validate mandatory fields
  if (currentStepIndex.value === 0) {
    const hasName = formData.value.name && formData.value.name.trim().length > 0;
    const hasFormType = formData.value.formType && formData.value.formType.trim().length > 0;
    return hasName && hasFormType;
  }
  
  // Step 1: Sections & Questions - validate that sections exist and have valid structure
  if (currentStepIndex.value === 1) {
    const sections = formData.value.sections || [];
    
    // Must have at least one section
    if (sections.length === 0) {
      return false;
    }
    
    // Validate each section
    for (const section of sections) {
      const subsections = section.subsections || [];
      
      // Each section must have at least one subsection
      if (subsections.length === 0) {
        return false;
      }
      
      // Validate each subsection
      for (const subsection of subsections) {
        const questions = subsection.questions || [];
        
        // Each subsection must have at least one question
        if (questions.length === 0) {
          return false;
        }
        
        // Validate each question
        for (const question of questions) {
          // Question text is mandatory (must not be empty after trimming)
          const questionText = question.questionText;
          if (!questionText || typeof questionText !== 'string' || questionText.trim().length === 0) {
            return false;
          }
          
          // If dropdown type, must have at least one non-empty option
          if (question.type === 'Dropdown') {
            const options = Array.isArray(question.options) ? question.options : [];
            const hasValidOption = options.some(opt => opt && typeof opt === 'string' && opt.trim().length > 0);
            if (!hasValidOption) {
              return false;
            }
          }
        }
      }
    }
    
    return true;
  }
  
  // Step 2: Settings & Logic - no mandatory fields, always allow proceeding
  if (currentStepIndex.value === 2) {
    return true;
  }
  
  // Step 3: Preview - no validation needed
  return true;
});

const canSubmit = computed(() => {
  return formData.value.name.trim().length > 0 && 
         formData.value.formType &&
         formData.value.sections.length > 0;
});

// Initialize form data if editing
watch(() => props.form, (newForm) => {
  if (newForm && isEditing.value) {
    Object.assign(formData.value, {
      name: newForm.name || '',
      description: newForm.description || '',
      formType: newForm.formType || 'Audit',
      visibility: newForm.visibility || 'Internal',
      status: newForm.status || 'Draft',
      assignedTo: newForm.assignedTo || null,
      expiryDate: newForm.expiryDate || null,
      tags: newForm.tags || [],
      approvalRequired: newForm.approvalRequired || false,
      sections: newForm.sections || [],
      scoringFormula: newForm.scoringFormula || '(Passed / Total) × 100',
      thresholds: newForm.thresholds || { pass: 80, partial: 50 },
      kpiMetrics: newForm.kpiMetrics || {
        compliancePercentage: false,
        satisfactionPercentage: false,
        rating: false
      }
    });
  }
}, { immediate: true });

// Reset form when modal opens/closes
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && !isEditing.value) {
    // Reset to defaults for new form
    formData.value = {
      name: '',
      description: '',
      formType: 'Audit',
      visibility: 'Internal',
      status: 'Draft',
      assignedTo: getDefaultAssignedTo(),
      expiryDate: null,
      tags: [],
      approvalRequired: false,
      sections: [],
      kpiMetrics: {
        compliancePercentage: false,
        satisfactionPercentage: false,
        rating: false
      },
      scoringFormula: '(Passed / Total) × 100',
      thresholds: {
        pass: 80,
        partial: 50
      },
      autoAssignment: {
        enabled: false,
        linkTo: 'org'
      },
      workflowOnSubmit: {
        notify: [],
        createTask: false,
        updateField: null
      },
      approvalWorkflow: {
        enabled: false,
        approver: null
      },
      formVersion: 1,
      publicLink: {
        enabled: false,
        slug: ''
      },
      responseTemplate: {
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
    currentStepIndex.value = 0;
  }
});

watch(
  () => authStore.user?._id,
  (userId) => {
    if (props.isOpen && !isEditing.value && !formData.value.assignedTo && userId) {
      formData.value.assignedTo = userId;
    }
  },
  { immediate: true }
);

const handleStepChange = (index) => {
  if (index >= 0 && index < steps.value.length) {
    currentStepIndex.value = index;
  }
};

const goToStep = (index) => {
  // Only allow going to completed steps
  // Before allowing navigation to next step, validate current step
  if (index > currentStepIndex.value && !canProceed.value) {
    if (currentStepIndex.value === 0) {
      notifications.warning(t('forms.wizardStep0RequiredAlert'));
    } else if (currentStepIndex.value === 1) {
      notifications.warning(t('forms.wizardStep1RequiredAlert'));
    }
    return;
  }

  // Allow going to any previous step or next step (if validation passes)
  if (index <= currentStepIndex.value || (index === currentStepIndex.value + 1 && canProceed.value)) {
    currentStepIndex.value = index;
  }
};

const nextStep = () => {
  // Validate before proceeding
  if (!canProceed.value) {
    // Show a message to the user about what's missing
    if (currentStepIndex.value === 0) {
      notifications.warning(t('forms.wizardStep0RequiredAlert'));
    } else if (currentStepIndex.value === 1) {
      notifications.warning(t('forms.wizardStep1RequiredAlert'));
    }
    return;
  }

  if (currentStepIndex.value < steps.value.length - 1) {
    currentStepIndex.value++;
  }
};

const previousStep = () => {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--;
  }
};

const handleSectionsUpdate = (updatedForm) => {
  // Merge all form updates from sections builder
  if (updatedForm.sections) {
    formData.value.sections = updatedForm.sections;
  }
  // Merge any other fields that might have been updated
  Object.assign(formData.value, updatedForm);
};

const handleSettingsUpdate = (updatedForm) => {
  // Merge all settings updates
  Object.assign(formData.value, updatedForm);
};

const handleSubmit = async () => {
  if (!canSubmit.value) return;

  saving.value = true;
  try {
    let response;
    if (isEditing.value) {
      response = await apiClient.put(`/forms/${props.form._id}`, formData.value);
    } else {
      response = await apiClient.post('/forms', formData.value);
    }

    if (response.success) {
      emit(isEditing.value ? 'updated' : 'created', response.data);
      
      // Navigate to form builder for the created/updated form
      const formId = response.data._id;
      openTab(`/forms/builder/${formId}`, {
        name: `form-builder-${formId}`,
        title: response.data.name || t('forms.formBuilderTabTitle'),
        component: 'FormBuilder',
        params: { formId },
        insertAdjacent: true
      });
      router.push(`/forms/builder/${formId}`);
      
      handleClose();
    } else {
      notifications.error(response.message || t('forms.saveFormFailed'));
    }
  } catch (error) {
    console.error('Error saving form:', error);
    notifications.error(error.message || t('forms.saveFormFailed'));
  } finally {
    saving.value = false;
  }
};

const handleClose = () => {
  emit('close');
};
</script>


<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-gray-800">
    <!-- Progress Stepper -->
    <div class="shrink-0 px-4 pt-4 pb-2 lg:px-6 lg:pt-5">
      <nav :aria-label="t('forms.wizardProgressAria')">
        <ol
          role="list"
          class="w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm md:flex"
        >
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
              <span class="flex items-center px-4 py-2.5 text-sm font-medium">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 group-hover:bg-indigo-800">
                  <CheckIcon class="size-4 text-white" aria-hidden="true" />
                </span>
                <span class="ml-3 text-sm font-medium text-gray-900 dark:text-white">{{ step.name }}</span>
              </span>
            </a>
            <a
              v-else-if="step.status === 'current'"
              href="#"
              @click.prevent
              class="flex items-center px-4 py-2.5 text-sm font-medium cursor-default"
              aria-current="step"
            >
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-indigo-600 text-xs font-semibold">
                <span class="text-indigo-600 dark:text-indigo-400">{{ step.id }}</span>
              </span>
              <span class="ml-3 text-sm font-medium text-indigo-600 dark:text-indigo-400">{{ step.name }}</span>
            </a>
            <a
              v-else
              href="#"
              @click.prevent="goToStep(stepIdx)"
              class="group flex items-center cursor-pointer"
            >
              <span class="flex items-center px-4 py-2.5 text-sm font-medium">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600 text-xs font-semibold group-hover:border-gray-400 dark:group-hover:border-gray-500">
                  <span class="text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100">{{ step.id }}</span>
                </span>
                <span class="ml-3 text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100">{{ step.name }}</span>
              </span>
            </a>
            <template v-if="stepIdx !== steps.length - 1">
              <div class="absolute top-0 right-0 hidden h-full w-4 md:block" aria-hidden="true">
                <svg class="size-full text-gray-200 dark:text-gray-700" viewBox="0 0 22 80" fill="none" preserveAspectRatio="none">
                  <path d="M0 -2L20 40L0 82" vector-effect="non-scaling-stroke" stroke="currentcolor" stroke-linejoin="round" />
                </svg>
              </div>
            </template>
          </li>
        </ol>
      </nav>
    </div>

    <!-- Step Content -->
    <div
      class="flex flex-1 min-h-0 flex-col bg-white dark:bg-gray-800"
      :class="currentStepKey === 'questions' ? 'overflow-hidden' : 'overflow-y-auto'"
    >
        <!-- Step: Form Details -->
        <div v-if="currentStepKey === 'details'" class="space-y-6 flex-1">
          <div class="max-w-2xl mx-auto space-y-6 w-full p-6">
            <EngagementFormDetailsStep
              v-if="isEngagementForm"
              :form="formData"
              @update="handleEngagementDetailsUpdate"
            />
            <template v-else>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('forms.tabDetailsHeading') }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {{ t('forms.wizardFormDetailsIntro') }}
                </p>
              </div>

              <div class="space-y-4">
                <div>
                  <label :class="FORM_FIELD_LABEL_CLASS" for="audit-form-name">
                    {{ t('forms.fieldFormName') }} <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="audit-form-name"
                    ref="formNameInput"
                    v-model="formData.name"
                    type="text"
                    required
                    maxlength="255"
                    :placeholder="t('forms.fieldFormNamePh')"
                    :class="FORM_FIELD_INPUT_CLASS"
                  />
                </div>

                <div>
                  <label :class="FORM_FIELD_LABEL_CLASS" for="audit-form-description">
                    {{ t('forms.fieldDescription') }}
                  </label>
                  <textarea
                    id="audit-form-description"
                    v-model="formData.description"
                    rows="3"
                    maxlength="1000"
                    :placeholder="t('forms.fieldDescriptionPh')"
                    :class="FORM_FIELD_TEXTAREA_CLASS"
                  />
                </div>

                <div>
                  <label :class="FORM_FIELD_LABEL_CLASS" for="audit-form-visibility">
                    {{ t('forms.fieldVisibility') }}
                  </label>
                  <HeadlessSelect
                    id="audit-form-visibility"
                    v-model="formData.visibility"
                    :options="auditVisibilityOptions"
                    wrapper-class="mt-2"
                  />
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Step: Questions -->
        <div v-else-if="currentStepKey === 'questions'" class="flex-1 flex flex-col min-h-0">
          <div
            v-if="showEngagementStarters"
            class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4"
          >
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.engagementStartersHeading') }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ isSurveyForm ? t('forms.engagementStartersSurveyDesc') : t('forms.engagementStartersFeedbackDesc') }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-if="!isSurveyForm"
                type="button"
                class="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                @click="applyEngagementStarter('feedback_quick')"
              >
                {{ t('forms.engagementStarterFeedbackQuick') }}
              </button>
              <template v-else>
                <button
                  type="button"
                  class="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  @click="applyEngagementStarter('survey_satisfaction')"
                >
                  {{ t('forms.engagementStarterSurveySatisfaction') }}
                </button>
                <button
                  type="button"
                  class="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  @click="applyEngagementStarter('survey_nps')"
                >
                  {{ t('forms.engagementStarterSurveyNps') }}
                </button>
              </template>
            </div>
          </div>
          <SectionsBuilder
            :key="`sections-${currentStepIndex}-${formData.formType}-${(formData.sections || []).length}`"
            class="flex-1 min-h-0"
            :form="formData"
            @update="handleSectionsUpdate"
          />
        </div>

        <!-- Step: Outcomes (Audit only) -->
        <div v-else-if="currentStepKey === 'outcomes'" class="space-y-6 flex-1">
          <div class="max-w-4xl mx-auto space-y-6 w-full p-6">
            <OutcomesAndRules
              :key="`outcomes-${currentStepIndex}`"
              :form="formData"
              @update="handleOutcomesUpdate"
            />
          </div>
        </div>

        <!-- Step: Settings (Survey / Feedback) -->
        <div v-else-if="currentStepKey === 'settings'" class="space-y-6 flex-1">
          <div class="max-w-3xl mx-auto w-full p-6">
            <EngagementFormSettingsStep
              :form="formData"
              @update="handleEngagementSettingsUpdate"
            />
          </div>
        </div>

        <!-- Step: Response Template (Audit only) -->
        <div v-else-if="currentStepKey === 'template'" class="space-y-6 flex-1 overflow-hidden flex flex-col">
          <div class="flex-1 overflow-y-auto p-6">
            <ResponseTemplateBuilder
              :key="`template-${currentStepIndex}`"
              :form="formData"
              @update="handleTemplateUpdate"
            />
          </div>
        </div>

        <!-- Step: Preview & Save / Publish -->
        <div v-else-if="currentStepKey === 'preview'" class="flex-1 flex flex-col min-h-0">
          <PreviewAndSave
            :key="`preview-save-${currentStepIndex}`"
            ref="previewAndSaveRef"
            :form="formData"
            :engagement-mode="isEngagementForm"
          />
        </div>
      </div>

    <!-- Footer Actions -->
    <div class="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div class="flex items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
            <!-- Draft saved indicator (subtle, non-intrusive) -->
            <Transition
              enter-active-class="transition ease-out duration-200"
              enter-from-class="opacity-0 translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition ease-in duration-150"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 translate-y-1"
            >
              <div
                v-if="draftSavedMessage"
                class="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
              >
                <svg class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{{ draftSavedMessage }}</span>
              </div>
            </Transition>
            <button
              @click="() => { console.log('🔵🔵🔵 CANCEL BUTTON CLICKED'); handleClose(); }"
              class="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {{ t('actions.cancel') }}
          </button>
        </div>
        <div class="flex items-center gap-3">
            <button
              v-if="currentStepIndex > 0"
              @click="previousStep"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {{ t('actions.previous') }}
            </button>
            <button
              v-if="currentStepIndex < steps.length - 1"
              @click="nextStep"
              :disabled="!canProceed"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              :title="!canProceed ? t('forms.nextStepBlockedTitle') : undefined"
            >
              {{ t('actions.next') }}
            </button>
            <button
              v-else
              @click="handleSubmit"
              :disabled="saving || !canSubmit"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="saving">{{ t('states.saving') }}</span>
              <span v-else>{{ isEngagementForm ? t('forms.engagementPublishAction') : t('actions.save') }}</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Confirmation Dialog -->
    <div
      v-if="showConfirmDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs"
      @click.self="cancelClose"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {{ t('forms.hubCreateUnsavedTitle') }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {{ t('forms.hubCreateUnsavedBody') }}
        </p>
        <div class="flex justify-end gap-3">
          <button
            @click="cancelClose"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            @click="confirmClose"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            {{ t('forms.hubCreateLeaveWithoutSaving') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, onActivated, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { CheckIcon } from '@heroicons/vue/24/solid';
import apiClient from '@/utils/apiClient';
import { useTabs } from '@/composables/useTabs';
import { useNotifications, showGlobalNotification } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';
import EngagementFormDetailsStep from '@/components/forms/EngagementFormDetailsStep.vue';
import EngagementFormSettingsStep from '@/components/forms/EngagementFormSettingsStep.vue';
import SectionsBuilder from '@/components/forms/SectionsBuilder.vue';
import FormSettingsTab from '@/components/forms/FormSettingsTab.vue';
import OutcomesAndRules from '@/components/forms/OutcomesAndRules.vue';
import ResponseTemplateBuilder from '@/components/forms/ResponseTemplateBuilder.vue';
import FormPreview from '@/components/forms/FormPreview.vue';
import PreviewAndSave from '@/components/forms/PreviewAndSave.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { PROCESS_INPUT_CLASS } from '@/utils/processDesignerConstants';
import { defaultWebformBranding, mergeWebformBranding } from '@/utils/webformBranding';
import {
  normalizeEngagementExpiryForInput,
  serializeEngagementExpiryForApi
} from '@/utils/engagementFormDisplay';

const FORM_FIELD_LABEL_CLASS = 'block text-sm/6 font-medium text-gray-900 dark:text-white';
const FORM_FIELD_INPUT_CLASS = PROCESS_INPUT_CLASS.replace('block w-full', 'block w-full mt-2');
const FORM_FIELD_TEXTAREA_CLASS = `${FORM_FIELD_INPUT_CLASS} resize-none`;

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { openTab, closeTab, findTabByPath, activeTabId, findTabById, activeTab } = useTabs();
const notifications = useNotifications();
const authStore = useAuthStore();
const getDefaultAssignedTo = () => authStore.user?._id || null;

const isEditing = computed(() => !!route.params.id || !!route.query?.editFrom);
// Helper to get the current form ID from various sources
const getFormId = () => {
  return route.params.id || formData.value._id || route.query?.editFrom || null;
};
const saving = ref(false);
const autoSaving = ref(false);
const currentStepIndex = ref(0);
const formNameInput = ref(null);
const showConfirmDialog = ref(false);
const pendingCloseAction = ref(null);
const previewAndSaveRef = ref(null);
const draftSavedMessage = ref('');
const lastSavedDraft = ref(null);
const draftSaveInProgress = ref(false);
const isInternalNavigation = ref(false);

const buildInitialFormData = (formType = 'Audit') => {
  const normalized = String(formType || 'Audit').toLowerCase();
  const isSurvey = normalized === 'survey';
  const isFeedback = normalized === 'feedback';
  const isEngagement = isSurvey || isFeedback;

  return {
  name: '',
  description: '',
  formType: isSurvey ? 'Survey' : isFeedback ? 'Feedback' : 'Audit',
  visibility: isEngagement ? 'Public' : 'Internal',
  status: 'Draft',
  assignedTo: getDefaultAssignedTo(),
  expiryDate: null,
  tags: [],
  approvalRequired: false,
  sections: [],
  kpiMetrics: {
    compliancePercentage: false,
    satisfactionPercentage: isFeedback || isSurvey,
    rating: isFeedback || isSurvey
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
    enabled: isFeedback,
    slug: ''
  },
  branding: defaultWebformBranding(),
  outcomesAndRules: {
    auditResultRule: 'any_section_fails',
    reportingMetrics: {
      overallCompliance: true,
      sectionWiseCompliance: true,
      evidenceCompletion: false,
      averageRating: false
    },
    postSubmissionSignals: {
      emitOnAuditFail: false,
      emitOnSectionFail: false,
      emitOnCriticalQuestionFail: false,
      emitOnMissingEvidence: false
    }
  },
  responseTemplate: {
    templates: [],
    activeTemplateId: null
  }
  };
};

const formData = ref(buildInitialFormData('Audit'));

const resetFormDataForNewForm = (formType = 'Audit') => {
  formData.value = buildInitialFormData(formType);
  lastSavedDraft.value = null;
  draftSaveInProgress.value = false;
  currentStepIndex.value = 0;
};

const isAuditForm = computed(() => {
  const formType = (formData.value.formType || 'audit').toLowerCase();
  return formType === 'audit';
});

const isEngagementForm = computed(() => {
  const formType = (formData.value.formType || '').toLowerCase();
  return formType === 'survey' || formType === 'feedback';
});

const isSurveyForm = computed(() => (formData.value.formType || '').toLowerCase() === 'survey');

const auditVisibilityOptions = computed(() => [
  { value: 'Internal', label: t('forms.visibilityInternal') },
  { value: 'External', label: t('forms.hubCreateVisibilityExternal') }
]);

const wizardStepKeys = computed(() => {
  if (isEngagementForm.value) {
    return ['details', 'questions', 'settings', 'preview'];
  }
  return ['details', 'questions', 'outcomes', 'template', 'preview'];
});

const currentStepKey = computed(() => wizardStepKeys.value[currentStepIndex.value] || 'details');

const stepLabels = computed(() => ({
  details: t('forms.wizardStepFormDetails'),
  questions: isEngagementForm.value
    ? t('forms.engagementWizardStepQuestions')
    : t('forms.wizardStepSectionsQuestions'),
  outcomes: t('forms.outcomesHeading'),
  template: t('forms.tabTemplateHeading'),
  settings: t('forms.engagementWizardStepSettings'),
  preview: isEngagementForm.value
    ? t('forms.engagementWizardStepPublish')
    : t('forms.previewSaveHeading')
}));

const steps = computed(() =>
  wizardStepKeys.value.map((key, index) => ({
    id: String(index + 1).padStart(2, '0'),
    key,
    name: stepLabels.value[key] || key,
    status:
      currentStepIndex.value > index
        ? 'complete'
        : currentStepIndex.value === index
          ? 'current'
          : 'upcoming'
  }))
);

const engagementQuestionCount = computed(() => {
  const sections = formData.value.sections || [];
  let count = 0;
  for (const section of sections) {
    if (section._isRootSection) {
      count += (section.subsections?.[0]?.questions || []).length;
      continue;
    }
    count += (section.questions || []).length;
    for (const sub of section.subsections || []) {
      count += (sub.questions || []).length;
    }
  }
  return count;
});

const showEngagementStarters = computed(() => {
  return isEngagementForm.value && currentStepKey.value === 'questions' && engagementQuestionCount.value === 0;
});

const canProceed = computed(() => {
  // Step 0: Form Details - validate mandatory fields
  if (currentStepKey.value === 'details') {
    const hasName = formData.value.name && formData.value.name.trim().length > 0;
    const hasFormType = formData.value.formType && formData.value.formType.trim().length > 0;
    return hasName && hasFormType;
  }
  
  // Step 1: Sections & Questions - validate that sections exist and have valid structure
  if (currentStepKey.value === 'questions') {
    const sections = formData.value.sections || [];
    const formType = (formData.value.formType || 'audit').toLowerCase();
    const isAudit = formType === 'audit';
    const isFlatMode = formType === 'survey' || formType === 'feedback';
    
    // For Audit: must have at least one visible section (exclude root section)
    if (isAudit) {
      const visibleSections = sections.filter(s => !s._isRootSection);
      if (visibleSections.length === 0) {
        return false;
      }
      
      // Validate scoring requirements for audit forms
      const scorableTypes = ['Yes-No', 'Dropdown', 'Rating', 'Number'];
      const hasScorableQuestion = (question) => {
        return scorableTypes.includes(question.type);
      };
      
      const hasValidPassCondition = (question) => {
        if (!question.scoring) {
          return false; // Scorable questions must have scoring configuration
        }
        
        const passCondition = question.scoring.passCondition || {};
        
        if (question.type === 'Yes-No') {
          return passCondition.expectedValue === 'Yes' || passCondition.expectedValue === 'No';
        } else if (question.type === 'Dropdown') {
          return Array.isArray(passCondition.passOptions) && passCondition.passOptions.length > 0;
        } else if (question.type === 'Rating') {
          return typeof passCondition.minRating === 'number' && passCondition.minRating >= 1;
        } else if (question.type === 'Number') {
          if (passCondition.rule === 'between') {
            return typeof passCondition.minValue === 'number' && typeof passCondition.maxValue === 'number';
          } else {
            return typeof passCondition.value === 'number';
          }
        }
        return false;
      };
      
      // Check that each section has at least one scorable question
      for (const section of visibleSections) {
        let sectionHasScorableQuestion = false;
        
        // Check section-level questions
        const sectionQuestions = section.questions || [];
        for (const question of sectionQuestions) {
          if (hasScorableQuestion(question)) {
            sectionHasScorableQuestion = true;
            
            // Each scorable question must have pass condition and weight ≥ 1
            // Check pass condition
            if (!hasValidPassCondition(question)) {
              return false;
            }
            
            // Check weight ≥ 1
            if (!question.scoring || !question.scoring.weight || question.scoring.weight < 1) {
              return false;
            }
          }
        }
        
        // Check subsection-level questions
        const subsections = section.subsections || [];
        for (const subsection of subsections) {
          const subsectionQuestions = subsection.questions || [];
          for (const question of subsectionQuestions) {
            if (hasScorableQuestion(question)) {
              sectionHasScorableQuestion = true;
              
              // Each scorable question must have pass condition and weight ≥ 1
              // Check pass condition
              if (!hasValidPassCondition(question)) {
                return false;
              }
              
              // Check weight ≥ 1
              if (!question.scoring || !question.scoring.weight || question.scoring.weight < 1) {
                return false;
              }
            }
          }
        }
        
        // Each section must have at least one scorable question
        if (!sectionHasScorableQuestion) {
          return false;
        }
      }
    }
    
    // For Survey/Feedback: root questions (feedback) or root questions / optional sections (survey)
    if (isFlatMode) {
      const formType = (formData.value.formType || '').toLowerCase();
      const isFeedback = formType === 'feedback';
      let hasRootQuestions = false;
      const rootSection = sections.find(s => s._isRootSection);
      if (rootSection?.subsections?.[0]?.questions) {
        hasRootQuestions = rootSection.subsections[0].questions.some(q => q?.questionText?.trim());
      }

      if (isFeedback) {
        if (!hasRootQuestions) {
          return false;
        }
      } else {
        const visibleSectionsForFlat = sections.filter(s => !s._isRootSection);
        const hasVisibleSections = visibleSectionsForFlat.length > 0;

        if (!hasRootQuestions && !hasVisibleSections) {
          return false;
        }

        if (hasVisibleSections && !hasRootQuestions) {
          const hasAnyQuestion = visibleSectionsForFlat.some((section) => {
            if ((section.questions || []).some(q => q?.questionText?.trim())) {
              return true;
            }
            return (section.subsections || []).some(
              sub => (sub.questions || []).some(q => q?.questionText?.trim())
            );
          });
          if (!hasAnyQuestion) {
            return false;
          }
        }
      }
    }
    
    // Validate all sections (including root section for flat mode)
    for (const section of sections) {
      // Validate section-level questions first
      const sectionQuestions = section.questions || [];
      for (const question of sectionQuestions) {
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
      
      const subsections = section.subsections || [];
      
      // Skip empty root sections (they're allowed to be empty)
      if (section._isRootSection && subsections.length === 0 && sectionQuestions.length === 0) {
        continue;
      }
      
      // Skip validation if no subsections (allowed in all form types including Audit)
      if (subsections.length === 0) {
        // Subsections are optional in all form types
        continue;
      }
      
      // Validate each subsection
      for (const subsection of subsections) {
        const questions = subsection.questions || [];
        
        // Skip empty subsections in flat mode (root questions might be in root section)
        if (isFlatMode && section._isRootSection && questions.length === 0) {
          continue;
        }
        
        // Empty subsections are allowed - subsections are optional
        // Only validate questions if they exist
        
        // Validate each question (if any exist)
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
  
  // Step 2: Outcomes & Rules - validate audit result rule for Audit forms
  if (currentStepKey.value === 'outcomes') {
    if (isAuditForm.value) {
      const outcomes = formData.value.outcomesAndRules || {};
      return !!outcomes.auditResultRule;
    }
    return true;
  }

  if (currentStepKey.value === 'settings') {
    return true;
  }

  if (currentStepKey.value === 'template') {
    return true;
  }

  if (currentStepKey.value === 'preview') {
    // Check if PreviewAndSave component is ready
    if (previewAndSaveRef.value && previewAndSaveRef.value.isReady !== undefined) {
      return previewAndSaveRef.value.isReady;
    }
    // If component not yet mounted, perform basic validation
    // Allow proceeding to preview step, but save will be disabled until validation passes
    return true;
  }
  
  return true;
});

const canSubmit = computed(() => {
  // Basic validation
  if (!formData.value.name.trim().length > 0 || !formData.value.formType) {
    return false;
  }
  
  // For preview step, use PreviewAndSave validation
  if (currentStepKey.value === 'preview') {
    if (previewAndSaveRef.value && previewAndSaveRef.value.isReady !== undefined) {
      return previewAndSaveRef.value.isReady;
    }
  }

  if (isEngagementForm.value) {
    return engagementQuestionCount.value > 0;
  }

  return formData.value.sections.length > 0;
});

// Check if form has unsaved changes
const hasUnsavedChanges = computed(() => {
  // Check if form name is filled
  if (formData.value.name && formData.value.name.trim().length > 0) {
    return true;
  }
  
  // Check if description is filled
  if (formData.value.description && formData.value.description.trim().length > 0) {
    return true;
  }
  
  // Check if sections have content
  if (formData.value.sections && formData.value.sections.length > 0) {
    // Check if any section has actual content (not just empty structure)
    for (const section of formData.value.sections) {
      // Check if section has name
      if (section.name && section.name.trim().length > 0 && !section._isRootSection) {
        return true;
      }
      
      // Check if section has questions
      if (section.questions && section.questions.length > 0) {
        return true;
      }
      
      // Check if section has subsections with questions
      if (section.subsections && section.subsections.length > 0) {
        for (const subsection of section.subsections) {
          if (subsection.questions && subsection.questions.length > 0) {
            return true;
          }
        }
      }
    }
  }
  
  // Check other form fields that indicate changes
  if (formData.value.tags && formData.value.tags.length > 0) {
    return true;
  }
  
  
  return false;
});

// Confirmation dialog handler
const confirmClose = () => {
  showConfirmDialog.value = false;
  if (pendingCloseAction.value) {
    pendingCloseAction.value();
    pendingCloseAction.value = null;
  }
};

const cancelClose = () => {
  showConfirmDialog.value = false;
  pendingCloseAction.value = null;
};

const applyFormTypeFromQuery = () => {
  if (route.query?.formType) {
    formData.value.formType = String(route.query.formType);
  }
};

const isNewFormCreateFlow = () => {
  return !isEditing.value && !route.query?.duplicateFrom && !route.query?.editFrom;
};

// Function to auto-save as Draft (silent, non-blocking)
const saveDraft = async (dataToSave = formData.value, showNotification = false) => {
  console.log('💾 saveDraft CALLED', {
    formName: dataToSave.name,
    formId: dataToSave._id,
    routeId: route.params.id,
    status: dataToSave.status,
    draftSaveInProgress: draftSaveInProgress.value,
    saving: saving.value,
    isEditing: isEditing.value,
    showNotification: showNotification // Log the notification flag
  });
  
  // Prevent concurrent saves for this form instance
  if (draftSaveInProgress.value || saving.value) {
    console.log('💾 saveDraft: SKIPPING - already in progress');
    return;
  }

  // Only auto-save Draft forms
  if (dataToSave.status !== 'Draft') {
    console.log('💾 saveDraft: SKIPPING - status is not Draft:', dataToSave.status);
    return;
  }

  // Check if form has meaningful data
  const hasName = dataToSave.name && dataToSave.name.trim().length > 0;
  
  // For new forms, require at least a name to create
  // For existing forms (editing), save even if empty (user might be clearing it)
  if (!isEditing.value && !hasName) {
    console.log('💾 saveDraft: SKIPPING - new form without name');
    return;
  }

  console.log('💾 saveDraft: PROCEEDING to save', {
    isEditing: isEditing.value,
    hasName,
    formId: route.params.id,
    formName: dataToSave.name,
    routePath: route.path
  });

  // Set flag to prevent concurrent saves
  draftSaveInProgress.value = true;
  autoSaving.value = true;

  try {
    // Ensure status is Draft (never auto-promote)
    // Clean the data - remove any undefined/null values that might cause issues
    // Also clean sections to ensure they have proper structure
    const cleanSections = (sections) => {
      if (!sections || !Array.isArray(sections)) return [];
      
      return sections.map(section => {
        // Ensure section has required fields
        const cleanedSection = {
          sectionId: section.sectionId || `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: section.name || t('forms.builderUntitledSection'),
          order: section.order || 0,
          weightage: section.weightage || 0,
          subsections: [],
          questions: []
        };
        
        // Clean subsections
        if (section.subsections && Array.isArray(section.subsections)) {
          cleanedSection.subsections = section.subsections.map(subsection => ({
            subsectionId: subsection.subsectionId || `subsection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: subsection.name || t('forms.builderUntitledSubsection'),
            order: subsection.order || 0,
            weightage: subsection.weightage || 0,
            questions: (subsection.questions || []).filter(q => q && q.questionText && q.questionText.trim())
          }));
        }
        
        // Clean direct questions (if any)
        if (section.questions && Array.isArray(section.questions)) {
          cleanedSection.questions = section.questions.filter(q => q && q.questionText && q.questionText.trim());
        }
        
        return cleanedSection;
      });
    };
    
    const cleanedData = {
      name: (dataToSave.name || '').trim(),
      description: (dataToSave.description || '').trim(),
      formType: dataToSave.formType || 'Audit',
      status: 'Draft', // Always Draft for auto-save
      visibility: dataToSave.visibility || 'Internal',
      sections: cleanSections(dataToSave.sections),
      formVersion: dataToSave.formVersion || 1,
      scoringFormula: dataToSave.scoringFormula || '(Passed / Total) × 100',
      thresholds: dataToSave.thresholds || { pass: 80, partial: 50 },
      kpiMetrics: dataToSave.kpiMetrics || {
        compliancePercentage: false,
        satisfactionPercentage: false,
        rating: false
      },
      outcomesAndRules: dataToSave.outcomesAndRules || {
        auditResultRule: 'any_section_fails',
        reportingMetrics: {
          overallCompliance: true,
          sectionWiseCompliance: true,
          evidenceCompletion: false,
          averageRating: false
        },
        postSubmissionSignals: {
          emitOnAuditFail: false,
          emitOnSectionFail: false,
          emitOnCriticalQuestionFail: false,
          emitOnMissingEvidence: false
        }
      },
      responseTemplate: dataToSave.responseTemplate || {
        templates: [],
        activeTemplateId: null
      }
    };
    
    // Only include optional fields if they have values
    if (dataToSave.assignedTo) cleanedData.assignedTo = dataToSave.assignedTo;
    if (dataToSave.expiryDate) {
      cleanedData.expiryDate = serializeEngagementExpiryForApi(dataToSave.expiryDate);
    }
    if (dataToSave.tags && dataToSave.tags.length > 0) cleanedData.tags = dataToSave.tags;
    if (dataToSave.approvalRequired !== undefined) cleanedData.approvalRequired = dataToSave.approvalRequired;
    if (dataToSave.autoAssignment) cleanedData.autoAssignment = dataToSave.autoAssignment;
    if (dataToSave.workflowOnSubmit) cleanedData.workflowOnSubmit = dataToSave.workflowOnSubmit;
    if (dataToSave.approvalWorkflow) cleanedData.approvalWorkflow = dataToSave.approvalWorkflow;
    
    // Handle publicLink — preserve intent; server generates slug when enabled without one
    if (dataToSave.publicLink) {
      const wantsPublicLink = dataToSave.publicLink.enabled === true
        || (isEngagementForm.value && dataToSave.visibility === 'Public');
      if (wantsPublicLink) {
        cleanedData.publicLink = {
          enabled: true,
          ...(dataToSave.publicLink.slug?.trim()
            ? { slug: dataToSave.publicLink.slug.trim() }
            : {})
        };
      } else {
        cleanedData.publicLink = { enabled: false };
      }
    }

    if (dataToSave.branding) {
      cleanedData.branding = mergeWebformBranding(dataToSave.branding);
    }

    let response;
    const existingFormId = formData.value._id || route.params.id || route.query?.editFrom;
    if (existingFormId) {
      // Update existing form as Draft
      console.log('💾 saveDraft: Updating existing form', existingFormId);
      response = await apiClient.put(`/forms/${existingFormId}`, cleanedData);
      console.log('💾 saveDraft: Update response', response);
      
      if (response.success && response.data) {
        formData.value._id = response.data._id;
        if (response.data.formId) {
          formData.value.formId = response.data.formId;
        }
      }
    } else if (hasName) {
      // Create new form as Draft (only if has name)
      console.log('💾 saveDraft: Creating new form', {
        name: cleanedData.name,
        formType: cleanedData.formType,
        route: route.path,
        dataKeys: Object.keys(cleanedData)
      });
      console.log('💾 saveDraft: Full data being sent', JSON.stringify(cleanedData, null, 2));
      response = await apiClient.post('/forms', cleanedData);
      console.log('💾 saveDraft: Create response', response);
      
      // If form was created, update route and form ID
      if (response.success && response.data?._id) {
        const formId = response.data._id;
        const newPath = `/forms/create/${formId}`;
        console.log('💾 saveDraft: Form created with ID', formId);
        
        // Update formData with new ID first
        formData.value._id = formId;
        if (response.data.formId) {
          formData.value.formId = response.data.formId;
        }
        
        // Update the current tab's path directly BEFORE route change
        // This prevents the route watcher from creating a new tab
        const currentTab = activeTab.value || findTabByPath(route.path);
        if (currentTab) {
          console.log('💾 saveDraft: Updating current tab path from', currentTab.path, 'to', newPath);
          // Update tab path and title synchronously before route change
          currentTab.path = newPath;
          currentTab.title = formData.value.name || t('forms.hubCreateLabel');
          
          // Use nextTick to ensure tab update happens before route change
          await nextTick();
        }
        
        // Update route without navigation (replace current)
        // The route watcher will see the active tab already matches and skip creating a new tab
        router.replace(newPath);
        
        // Update isEditing computed will now be true
      } else {
        console.error('💾 saveDraft: Form creation failed', response);
      }
    } else {
      // No name yet, skip save
      console.log('💾 saveDraft: No name, skipping save');
      return;
    }

    console.log('💾 saveDraft: Response received', {
      success: response?.success,
      hasResponse: !!response,
      responseKeys: response ? Object.keys(response) : [],
      showNotification: showNotification
    });

    if (response?.success) {
      // Update last saved draft
      const savedForm = response.data || draftData;
      lastSavedDraft.value = JSON.stringify(savedForm);
      
      // Store success in sessionStorage for verification (survives console clear)
      try {
        sessionStorage.setItem('lastDraftSaveSuccess', JSON.stringify({
          formId: savedForm._id,
          formName: savedForm.name,
          timestamp: Date.now(),
          route: route.path
        }));
      } catch (e) {
        // Ignore sessionStorage errors
      }
      
      // Show subtle "Draft saved" indicator (non-intrusive)
      draftSavedMessage.value = t('forms.hubCreateDraftSaved');
      setTimeout(() => {
        draftSavedMessage.value = '';
      }, 2000);
      
      // Note: Notification is now shown BEFORE saveDraft is called (in handleClose/beforeClose)
      // This ensures it persists even if the component unmounts during tab close
    } else {
      // Store failure in sessionStorage for debugging
      try {
        sessionStorage.setItem('lastDraftSaveFailure', JSON.stringify({
          response: response,
          timestamp: Date.now(),
          route: route.path
        }));
      } catch (e) {
        // Ignore sessionStorage errors
      }
    }
  } catch (error) {
    // Log full error details for debugging
    const errorResponse = error.response?.data || error.response || error;
    console.error('💾 saveDraft: ERROR saving draft', {
      message: error.message,
      status: error.status,
      response: errorResponse,
      errorData: error.response?.data,
      fullError: error
    });
    
    // Store error in sessionStorage for debugging
    try {
      sessionStorage.setItem('lastDraftSaveError', JSON.stringify({
        message: error.message,
        status: error.status,
        response: errorResponse,
        errorData: error.response?.data,
        timestamp: Date.now(),
        route: route.path,
        formName: dataToSave.name,
        formId: dataToSave._id
      }));
    } catch (e) {
      // Ignore sessionStorage errors
    }
    
    // Silent failure for auto-save (don't interrupt user)
    console.warn('Auto-save Draft failed:', error.message, error.response?.data);
  } finally {
    draftSaveInProgress.value = false;
    autoSaving.value = false;
  }
};

// NOTE: Auto-save Draft only on:
// 1. Page refresh/close (beforeunload)
// 2. Tab close (beforeClose)
// 3. Cancel button click (handleClose)
// 
// We do NOT auto-save on form data changes, step changes, or navigation
// User must explicitly save via the Save button to persist changes

// Handle beforeunload (page refresh/close) - show confirmation and save Draft before leaving
const handleBeforeUnload = (e) => {
  // Don't show confirmation for internal navigation (tab close within app)
  if (isInternalNavigation.value) {
    return;
  }
  
  // Check if there are unsaved changes
  if (hasUnsavedChanges.value) {
    // Show browser confirmation dialog
    // Modern browsers ignore custom messages and show their own generic message
    e.preventDefault();
    e.returnValue = ''; // Chrome requires returnValue to be set
    return ''; // Some browsers require a return value
  }
  
  // Save Draft before leaving (if in Draft status)
  // Note: beforeunload is synchronous and limited, so we use sendBeacon for forms with ID
  // For new forms, we rely on tab close handler or cancel button which can use async saveDraft
  const hasName = formData.value.name && formData.value.name.trim();
  const shouldSave = formData.value.status === 'Draft' && 
                    !draftSaveInProgress.value &&
                    (isEditing.value || hasName);
  
  if (shouldSave) {
    // For forms with ID, use sendBeacon for reliable save on page unload
    const formId = getFormId();
    if (isEditing.value && formId) {
      try {
        const draftData = {
          ...formData.value,
          status: 'Draft'
        };
        const blob = new Blob([JSON.stringify(draftData)], { type: 'application/json' });
        navigator.sendBeacon(`/api/forms/${formId}`, blob);
      } catch (err) {
        console.warn('Failed to save Draft on unload:', err);
      }
    }
    // For new forms without ID, sendBeacon doesn't work well with POST
    // They will be saved via tab close handler or cancel button instead
  }
};

// Set up beforeClose callback for tab close
const setupTabCloseHandler = () => {
  // CRITICAL: Always use the active tab first, not findTabByPath
  // findTabByPath returns the FIRST tab with that path, which might be the wrong one!
  let currentTab = activeTab.value;
  
  // Only fallback to path search if active tab doesn't match
  if (!currentTab || (currentTab.path !== '/forms/create' && !currentTab.path.startsWith('/forms/create/'))) {
    // Try to find by current route path first
    currentTab = findTabByPath(route.path);
    // Last resort: find any /forms/create tab (but this is risky with multiple forms)
    if (!currentTab) {
      currentTab = findTabByPath('/forms/create');
    }
  }
  
  console.log('🔵 setupTabCloseHandler: Looking for tab', {
    activeTabId: activeTabId.value,
    activeTabPath: activeTab.value?.path,
    activeTabIdMatches: activeTab.value?.id === activeTabId.value,
    routePath: route.path,
    foundTab: currentTab?.id,
    foundTabPath: currentTab?.path,
    foundTabMatchesActive: currentTab?.id === activeTabId.value
  });
  
  if (currentTab) {
    // Capture tab ID in closure to ensure we reference the correct tab
    const tabId = currentTab.id;
    const tabPath = currentTab.path;
    
    // Add beforeClose callback - save Draft before closing (no blocking)
    currentTab.beforeClose = async () => {
      console.log('🔵🔵🔵 Tab beforeClose called for tab:', tabId, 'path:', tabPath);
      console.log('🔵 Tab beforeClose called for tab:', tabId, 'path:', tabPath);
      
      // Mark as internal navigation to prevent beforeunload confirmation
      isInternalNavigation.value = true;
      
      // If form is Draft, save it before closing
      // Don't check hasUnsavedChanges - just save if form has name or is being edited
      const hasName = formData.value.name && formData.value.name.trim();
      const shouldSave = formData.value.status === 'Draft' && 
                        !draftSaveInProgress.value &&
                        (isEditing.value || hasName);
      
      console.log('🔵 Tab beforeClose: Checking if should save', {
        status: formData.value.status,
        draftSaveInProgress: draftSaveInProgress.value,
        isEditing: isEditing.value,
        hasName: hasName,
        formName: formData.value.name,
        formId: formData.value._id,
        routePath: route.path,
        shouldSave
      });
      
      if (shouldSave) {
        console.log('🔵 Tab beforeClose: Saving draft...');
        // TODO: Re-enable notifications later
        // Show notification using global function to ensure it persists after component unmounts
        // showGlobalNotification('Draft saved successfully', 5000);
        // console.log('🔵 Tab beforeClose: Notification shown, now saving draft...');
        try {
          await saveDraft(formData.value, false);
          console.log('🔵 Tab beforeClose: Draft save complete');
        } catch (error) {
          console.error('🔵 Tab beforeClose: Error saving draft:', error);
        }
      } else {
        console.log('🔵 Tab beforeClose: Not saving - conditions not met', {
          status: formData.value.status,
          draftSaveInProgress: draftSaveInProgress.value,
          isEditing: isEditing.value,
          hasName: hasName,
          shouldSave
        });
      }
      
      // Reset flag after a short delay to allow navigation to complete
      setTimeout(() => {
        isInternalNavigation.value = false;
      }, 100);
      
      // Always allow close (Draft is auto-saved)
      return true;
    };
    console.log('🔵 Tab close handler set up for tab:', currentTab.id);
  } else {
    console.warn('⚠️ Tab close handler: No tab found for route:', route.path);
  }
};

// Load form data if editing and focus first field by default
onMounted(async () => {
  console.log('🔵 onMounted: Component mounted', {
    route: route.path,
    routeId: route.params.id,
    isEditing: isEditing.value,
    formName: formData.value.name,
    formId: formData.value._id
  });
  
  if (formNameInput.value) {
    formNameInput.value.focus();
  }
  // Add beforeunload listener for page refresh/close
  window.addEventListener('beforeunload', handleBeforeUnload);

  // If a formType is provided via query (from the picker), prefill it
  const queryFormType = route.query?.formType ? String(route.query.formType) : null;

  // Check if we're duplicating or editing a form via query parameter
  const duplicateFromId = route.query?.duplicateFrom;
  const editFromId = route.query?.editFrom;
  
  // Reset state for new forms (when not editing and not duplicating)
  if (!isEditing.value && !duplicateFromId && !editFromId) {
    console.log('🔵 onMounted: Resetting state for new form');
    resetFormDataForNewForm(queryFormType || 'Audit');
    
    console.log('🔵 onMounted: State reset complete for new form', {
      formName: formData.value.name,
      formId: formData.value._id,
      status: formData.value.status,
      lastSavedDraft: lastSavedDraft.value,
      draftSaveInProgress: draftSaveInProgress.value
    });
  } else if (isEditing.value && route.params.id) {
    console.log('🔵 onMounted: Editing existing form', {
      formId: route.params.id,
      formName: formData.value.name
    });
  } else if (editFromId) {
    console.log('🔵 onMounted: Editing form via query parameter', {
      editFromId: editFromId
    });
  } else if (duplicateFromId) {
    console.log('🔵 onMounted: Duplicating form', {
      duplicateFromId: duplicateFromId
    });
  }

  // Load form data for editing (via route params)
  if (isEditing.value && route.params.id) {
    try {
      const response = await apiClient.get(`/forms/${route.params.id}`);
      if (response.success && response.data) {
        const loadedForm = response.data;
        Object.assign(formData.value, {
          name: loadedForm.name || '',
          description: loadedForm.description || '',
          formType: loadedForm.formType || 'Audit',
          visibility: loadedForm.visibility || 'Internal',
          // If form is Ready/Active/Archived, keep that status
          // If form is Draft, ensure it stays Draft
          status: loadedForm.status || 'Draft',
          assignedTo: response.data.assignedTo || null,
          expiryDate: normalizeEngagementExpiryForInput(response.data.expiryDate),
          tags: response.data.tags || [],
          approvalRequired: response.data.approvalRequired || false,
          sections: response.data.sections || [],
          scoringFormula: response.data.scoringFormula || '(Passed / Total) × 100',
          thresholds: response.data.thresholds || { pass: 80, partial: 50 },
          kpiMetrics: response.data.kpiMetrics || {
            compliancePercentage: false,
            satisfactionPercentage: false,
            rating: false
          },
          outcomesAndRules: response.data.outcomesAndRules || {
            auditResultRule: 'any_section_fails',
            reportingMetrics: {
              overallCompliance: true,
              sectionWiseCompliance: true,
              evidenceCompletion: false,
              averageRating: false
            },
            postSubmissionSignals: {
              emitOnAuditFail: false,
              emitOnSectionFail: false,
              emitOnCriticalQuestionFail: false,
              emitOnMissingEvidence: false
            }
          },
          publicLink: response.data.publicLink ? { ...response.data.publicLink } : {
            enabled: false,
            slug: ''
          },
          workflowOnSubmit: response.data.workflowOnSubmit ? { ...response.data.workflowOnSubmit } : {
            notify: [],
            createTask: false,
            updateField: null
          },
          branding: mergeWebformBranding(response.data.branding)
        });
        
        // Initialize last saved draft for comparison
        lastSavedDraft.value = JSON.stringify(loadedForm);
      }
    } catch (error) {
      console.error('Error loading form:', error);
    }
  }
  
  // Load form data for editing (via query parameter)
  if (editFromId && !route.params.id) {
    try {
      const response = await apiClient.get(`/forms/${editFromId}`);
      if (response.success && response.data) {
        const loadedForm = response.data;
        Object.assign(formData.value, {
          name: loadedForm.name || '',
          description: loadedForm.description || '',
          formType: loadedForm.formType || 'Audit',
          visibility: loadedForm.visibility || 'Internal',
          // Keep the original status
          status: loadedForm.status || 'Draft',
          assignedTo: response.data.assignedTo || null,
          expiryDate: normalizeEngagementExpiryForInput(response.data.expiryDate),
          tags: response.data.tags ? [...response.data.tags] : [],
          approvalRequired: response.data.approvalRequired || false,
          sections: response.data.sections ? JSON.parse(JSON.stringify(response.data.sections)) : [],
          scoringFormula: response.data.scoringFormula || '(Passed / Total) × 100',
          thresholds: response.data.thresholds ? { ...response.data.thresholds } : { pass: 80, partial: 50 },
          kpiMetrics: response.data.kpiMetrics ? { ...response.data.kpiMetrics } : {
            compliancePercentage: false,
            satisfactionPercentage: false,
            rating: false
          },
          autoAssignment: response.data.autoAssignment ? { ...response.data.autoAssignment } : {
            enabled: false,
            linkTo: 'org'
          },
          workflowOnSubmit: response.data.workflowOnSubmit ? { ...response.data.workflowOnSubmit } : {
            notify: [],
            createTask: false,
            updateField: null
          },
          approvalWorkflow: response.data.approvalWorkflow ? { ...response.data.approvalWorkflow } : {
            enabled: false,
            approver: null
          },
          formVersion: response.data.formVersion || 1,
          publicLink: response.data.publicLink ? { ...response.data.publicLink } : {
            enabled: false,
            slug: ''
          },
          branding: mergeWebformBranding(response.data.branding),
          outcomesAndRules: response.data.outcomesAndRules ? {
            auditResultRule: response.data.outcomesAndRules.auditResultRule || 'any_section_fails',
            reportingMetrics: response.data.outcomesAndRules.reportingMetrics ? { ...response.data.outcomesAndRules.reportingMetrics } : {
              overallCompliance: true,
              sectionWiseCompliance: true,
              evidenceCompletion: false,
              averageRating: false
            },
            postSubmissionSignals: response.data.outcomesAndRules.postSubmissionSignals ? { ...response.data.outcomesAndRules.postSubmissionSignals } : {
              emitOnAuditFail: false,
              emitOnSectionFail: false,
              emitOnCriticalQuestionFail: false,
              emitOnMissingEvidence: false
            }
          } : {
            auditResultRule: 'any_section_fails',
            reportingMetrics: {
              overallCompliance: true,
              sectionWiseCompliance: true,
              evidenceCompletion: false,
              averageRating: false
            },
            postSubmissionSignals: {
              emitOnAuditFail: false,
              emitOnSectionFail: false,
              emitOnCriticalQuestionFail: false,
              emitOnMissingEvidence: false
            }
          },
          responseTemplate: response.data.responseTemplate ? {
            templates: response.data.responseTemplate.templates ? [...response.data.responseTemplate.templates] : [],
            activeTemplateId: response.data.responseTemplate.activeTemplateId || null
          } : {
            templates: [],
            activeTemplateId: null
          }
        });
        
        // Keep the _id so it can be saved as an update
        formData.value._id = loadedForm._id;
        formData.value.formId = loadedForm._id;
        
        // Initialize last saved draft for comparison
        lastSavedDraft.value = JSON.stringify(loadedForm);
        
        console.log('🔵 onMounted: Form loaded for editing via query parameter', {
          formName: formData.value.name,
          formId: formData.value._id,
          status: formData.value.status,
          sectionsCount: formData.value.sections?.length || 0
        });
      }
    } catch (error) {
      console.error('Error loading form for editing:', error);
      notifications.error(t('forms.hubCreateLoadEditFailed'));
    }
  }
  
  // Load form data for duplication
  if (duplicateFromId && !isEditing.value && !editFromId) {
    try {
      const response = await apiClient.get(`/forms/${duplicateFromId}`);
      if (response.success && response.data) {
        const sourceForm = response.data;
        // Prefill all form data but ensure it's treated as a new form
        Object.assign(formData.value, {
          name: t('forms.rtTemplateDuplicateName', { name: sourceForm.name || t('forms.hubUntitledForm') }),
          description: sourceForm.description || '',
          formType: sourceForm.formType || 'Audit',
          visibility: sourceForm.visibility || 'Internal',
          status: 'Draft', // Always set to Draft for duplicated forms
          assignedTo: sourceForm.assignedTo || null,
          expiryDate: normalizeEngagementExpiryForInput(sourceForm.expiryDate),
          tags: sourceForm.tags ? [...sourceForm.tags] : [],
          approvalRequired: sourceForm.approvalRequired || false,
          sections: sourceForm.sections ? JSON.parse(JSON.stringify(sourceForm.sections)) : [],
          scoringFormula: sourceForm.scoringFormula || '(Passed / Total) × 100',
          thresholds: sourceForm.thresholds ? { ...sourceForm.thresholds } : { pass: 80, partial: 50 },
          kpiMetrics: sourceForm.kpiMetrics ? { ...sourceForm.kpiMetrics } : {
            compliancePercentage: false,
            satisfactionPercentage: false,
            rating: false
          },
          autoAssignment: sourceForm.autoAssignment ? { ...sourceForm.autoAssignment } : {
            enabled: false,
            linkTo: 'org'
          },
          workflowOnSubmit: sourceForm.workflowOnSubmit ? { ...sourceForm.workflowOnSubmit } : {
            notify: [],
            createTask: false,
            updateField: null
          },
          approvalWorkflow: sourceForm.approvalWorkflow ? { ...sourceForm.approvalWorkflow } : {
            enabled: false,
            approver: null
          },
          formVersion: 1, // Reset version for new form
          publicLink: {
            enabled: false,
            slug: '' // Don't copy public link
          },
          branding: mergeWebformBranding(sourceForm.branding),
          outcomesAndRules: sourceForm.outcomesAndRules ? {
            auditResultRule: sourceForm.outcomesAndRules.auditResultRule || 'any_section_fails',
            reportingMetrics: sourceForm.outcomesAndRules.reportingMetrics ? { ...sourceForm.outcomesAndRules.reportingMetrics } : {
              overallCompliance: true,
              sectionWiseCompliance: true,
              evidenceCompletion: false,
              averageRating: false
            },
            postSubmissionSignals: sourceForm.outcomesAndRules.postSubmissionSignals ? { ...sourceForm.outcomesAndRules.postSubmissionSignals } : {
              emitOnAuditFail: false,
              emitOnSectionFail: false,
              emitOnCriticalQuestionFail: false,
              emitOnMissingEvidence: false
            }
          } : {
            auditResultRule: 'any_section_fails',
            reportingMetrics: {
              overallCompliance: true,
              sectionWiseCompliance: true,
              evidenceCompletion: false,
              averageRating: false
            },
            postSubmissionSignals: {
              emitOnAuditFail: false,
              emitOnSectionFail: false,
              emitOnCriticalQuestionFail: false,
              emitOnMissingEvidence: false
            }
          },
          responseTemplate: sourceForm.responseTemplate ? {
            templates: sourceForm.responseTemplate.templates ? [...sourceForm.responseTemplate.templates] : [],
            activeTemplateId: sourceForm.responseTemplate.activeTemplateId || null
          } : {
            templates: [],
            activeTemplateId: null
          }
        });
        
        // Don't copy _id - this ensures it's treated as a new form
        delete formData.value._id;
        delete formData.value.formId; // Don't copy formId either
        
        // Reset last saved draft for new duplicated form
        lastSavedDraft.value = null;
        // Reset draft save flag
        draftSaveInProgress.value = false;
        // Reset step to first step
        currentStepIndex.value = 0;
        
        console.log('🔵 onMounted: Form duplicated and prefilled', {
          formName: formData.value.name,
          status: formData.value.status,
          sectionsCount: formData.value.sections?.length || 0
        });
      }
    } catch (error) {
      console.error('Error loading form for duplication:', error);
      notifications.error(t('forms.hubCreateLoadDuplicateFailed'));
    }
  }
  
  // Set up tab close handler after a delay to ensure tab is created
  setTimeout(() => {
    console.log('🔵 onMounted: Setting up tab close handler');
    setupTabCloseHandler();
  }, 300);
});

// Handle keep-alive component activation
// This is called when a cached component is activated (switched to)
onActivated(() => {
  if (isNewFormCreateFlow() && route.query?.formType) {
    const queryType = String(route.query.formType);
    if (formData.value.formType !== queryType) {
      resetFormDataForNewForm(queryType);
    }
  }

  // Re-setup tab close handler when component is activated
  setTimeout(() => {
    setupTabCloseHandler();
  }, 300);
});

onBeforeUnmount(() => {
  // Store form data in sessionStorage IMMEDIATELY as backup
  // This happens synchronously before any async operations
  const formToSave = {
    name: formData.value.name,
    description: formData.value.description,
    formType: formData.value.formType,
    status: formData.value.status || 'Draft',
    sections: formData.value.sections || [],
    _id: formData.value._id,
    route: route.path,
    timestamp: Date.now()
  };
  
  // Always store in sessionStorage as backup, even if save fails
  try {
    const existingBackups = JSON.parse(sessionStorage.getItem('form-create-draft-backups') || '[]');
    existingBackups.push(formToSave);
    // Keep only last 5 backups
    if (existingBackups.length > 5) {
      existingBackups.shift();
    }
    sessionStorage.setItem('form-create-draft-backups', JSON.stringify(existingBackups));
    sessionStorage.setItem('form-create-draft-last-unmount', JSON.stringify(formToSave));
  } catch (e) {
    // Ignore sessionStorage errors
  }
  
  if (typeof autoSaveTimer !== 'undefined' && autoSaveTimer !== null) {
    clearTimeout(autoSaveTimer);
  }
  window.removeEventListener('beforeunload', handleBeforeUnload);
  
  // Final save attempt before component unmounts (critical fallback)
  // This runs when the component is about to be destroyed, regardless of how it's closed
  if (formData.value.status === 'Draft' && !draftSaveInProgress.value) {
    const hasName = formData.value.name && formData.value.name.trim();
    const shouldSave = isEditing.value || hasName;
    
    if (shouldSave) {
      // Store attempt in sessionStorage
      try {
        sessionStorage.setItem('form-create-draft-unmount-attempt', JSON.stringify({
          formName: formData.value.name,
          formId: formData.value._id,
          isEditing: isEditing.value,
          route: route.path,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Ignore
      }
      
      // Try to save - use sendBeacon as fallback if component unmounts too quickly
      const savePromise = saveDraft(formData.value);
      
      // Also try sendBeacon for immediate save (works even if component unmounts)
      if (!isEditing.value && hasName) {
        // New form - can't use sendBeacon with POST, but try anyway
        try {
          const draftData = {
            ...formData.value,
            status: 'Draft'
          };
          // Note: sendBeacon doesn't work well with POST, but we'll try
          const blob = new Blob([JSON.stringify(draftData)], { type: 'application/json' });
          // This won't work for new forms, but we have the sessionStorage backup
        } catch (e) {
          // Ignore
        }
      } else if (isEditing.value) {
        // Existing form - use sendBeacon for immediate save
        const formId = getFormId();
        if (formId) {
          try {
            const draftData = {
              ...formData.value,
              status: 'Draft'
            };
            const blob = new Blob([JSON.stringify(draftData)], { type: 'application/json' });
            navigator.sendBeacon(`/api/forms/${formId}`, blob);
          } catch (e) {
            // Ignore
          }
        }
      }
      
      // Don't await - let it run in background
      savePromise.catch(err => {
        // Store error in sessionStorage
        try {
          sessionStorage.setItem('form-create-draft-unmount-error', JSON.stringify({
            error: err.message,
            formName: formData.value.name,
            formId: formData.value._id,
            timestamp: Date.now(),
            route: route.path
          }));
        } catch (e) {
          // Ignore
        }
      });
    }
  }
});

// Keep form type in sync if query changes (e.g., opened with a different type)
watch(() => route.query.formType, (newType, oldType) => {
  if (!newType) return;

  const nextType = String(newType);
  if (isNewFormCreateFlow() && oldType && String(oldType) !== nextType) {
    resetFormDataForNewForm(nextType);
    return;
  }

  applyFormTypeFromQuery();
});

watch(
  () => authStore.user?._id,
  (userId) => {
    if (!isEditing.value && !formData.value.assignedTo && userId) {
      formData.value.assignedTo = userId;
    }
  },
  { immediate: true }
);

// Update tab close handler when unsaved changes state changes
watch(hasUnsavedChanges, () => {
  setupTabCloseHandler();
});

// Re-setup tab close handler when route changes (for keep-alive scenarios)
watch(() => route.path, () => {
  // Small delay to ensure tab is updated
  setTimeout(() => {
    setupTabCloseHandler();
  }, 100);
});

// Watch form name changes and auto-save when name is entered (for new forms)
// This ensures the form is saved even if tab close handler doesn't work
// NOTE: Removed name watcher - Draft forms now only save on:
// 1. Tab close (beforeClose callback)
// 2. Cancel button click (handleClose)
// 3. Page refresh/close (beforeunload)
// This prevents auto-save while user is actively typing

// Watch for route changes to reset state when creating a new form
watch(() => route.params.id, (newId, oldId) => {
  // If route changed from editing (has ID) to new form (no ID), reset state
  if (oldId && !newId) {
    const queryFormType = route.query?.formType ? String(route.query.formType) : formData.value.formType || 'Audit';
    resetFormDataForNewForm(queryFormType);
  }
  // If route changed from new form (no ID) to editing (has ID), update lastSavedDraft
  else if (!oldId && newId) {
    // Form was just created, lastSavedDraft should already be set by saveDraft
    // But we'll set it here as well to be safe
    if (!lastSavedDraft.value) {
      lastSavedDraft.value = JSON.stringify(formData.value);
    }
  }
});


const goToStep = (index) => {
  if (index > currentStepIndex.value && !canProceed.value) {
    showStepValidationAlert();
    return;
  }

  if (index <= currentStepIndex.value || (index === currentStepIndex.value + 1 && canProceed.value)) {
    currentStepIndex.value = index;
  }
};

const nextStep = () => {
  if (!canProceed.value) {
    showStepValidationAlert();
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

const generateEngagementId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const buildEngagementQuestion = (type, questionText, extra = {}) => ({
  questionId: generateEngagementId('Q'),
  type,
  questionText,
  helpText: '',
  required: extra.required ?? false,
  options: extra.options || [],
  order: extra.order ?? 0,
  ...extra
});

const ensureEngagementTargetQuestions = () => {
  if (!formData.value.sections) {
    formData.value.sections = [];
  }

  let rootSection = formData.value.sections.find((s) => s._isRootSection);
  if (!rootSection) {
    rootSection = {
      sectionId: generateEngagementId('SEC'),
      name: '',
      weightage: 0,
      subsections: [{
        subsectionId: generateEngagementId('SUB'),
        name: '',
        weightage: 0,
        questions: [],
        order: 0
      }],
      questions: [],
      order: 0,
      _isRootSection: true
    };
    formData.value.sections.unshift(rootSection);
  }

  const isFeedback = formData.value.formType?.toLowerCase() === 'feedback';
  const visibleSection = !isFeedback
    ? formData.value.sections.find((s) => !s._isRootSection)
    : null;
  if (visibleSection) {
    if (!visibleSection.subsections?.length) {
      visibleSection.subsections = [{
        subsectionId: generateEngagementId('SUB'),
        name: t('forms.hubCreateSubsectionDefault', { number: 1 }),
        weightage: 0,
        questions: [],
        order: 0
      }];
    }
    if (!visibleSection.subsections[0].questions) {
      visibleSection.subsections[0].questions = [];
    }
    return visibleSection.subsections[0].questions;
  }

  if (!rootSection.subsections?.[0]) {
    rootSection.subsections = [{
      subsectionId: generateEngagementId('SUB'),
      name: '',
      weightage: 0,
      questions: [],
      order: 0
    }];
  }
  if (!rootSection.subsections[0].questions) {
    rootSection.subsections[0].questions = [];
  }
  return rootSection.subsections[0].questions;
};

const applyEngagementStarter = (starterKey) => {
  const questions = ensureEngagementTargetQuestions();
  const isFeedback = formData.value.formType?.toLowerCase() === 'feedback';

  const starterSets = {
    feedback_quick: [
      buildEngagementQuestion('Rating', t('forms.engagementStarterFeedbackRating'), { required: true, order: 0 }),
      buildEngagementQuestion('Textarea', t('forms.engagementStarterFeedbackComment'), { order: 1 })
    ],
    survey_satisfaction: [
      buildEngagementQuestion('Rating', t('forms.engagementStarterSurveyRating'), { required: true, order: 0 }),
      buildEngagementQuestion('Dropdown', t('forms.engagementStarterSurveyEase'), {
        required: true,
        order: 1,
        options: [
          t('forms.engagementStarterSurveyEaseOpt1'),
          t('forms.engagementStarterSurveyEaseOpt2'),
          t('forms.engagementStarterSurveyEaseOpt3'),
          t('forms.engagementStarterSurveyEaseOpt4'),
          t('forms.engagementStarterSurveyEaseOpt5')
        ]
      }),
      buildEngagementQuestion('Textarea', t('forms.engagementStarterSurveyImprove'), { order: 2 })
    ],
    survey_nps: [
      buildEngagementQuestion('Dropdown', t('forms.engagementStarterNpsQuestion'), {
        required: true,
        order: 0,
        options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
      }),
      buildEngagementQuestion('Textarea', t('forms.engagementStarterNpsFollowUp'), { order: 1 })
    ]
  };

  const selected = starterSets[starterKey];
  if (!selected) return;

  if (isFeedback && starterKey !== 'feedback_quick') return;

  questions.splice(0, questions.length, ...selected.map((q, index) => ({
    ...q,
    order: index
  })));

  // Trigger SectionsBuilder sync when structure markers are intact.
  formData.value.sections = [...formData.value.sections];
};

const handleEngagementDetailsUpdate = (updatedForm) => {
  Object.assign(formData.value, updatedForm);
};

const handleEngagementSettingsUpdate = (updatedForm) => {
  Object.assign(formData.value, updatedForm);
};

const showStepValidationAlert = () => {
  if (currentStepKey.value === 'details') {
    notifications.warning(t('forms.wizardStep0RequiredAlert'));
    return;
  }
  if (currentStepKey.value === 'questions') {
    notifications.warning(isEngagementForm.value
      ? t('forms.engagementQuestionsRequiredAlert')
      : t('forms.hubCreateStep1RequiredAlert'));
    return;
  }
  if (currentStepKey.value === 'outcomes' && isAuditForm.value) {
    notifications.warning(t('forms.hubCreateAuditRuleRequired'));
  }
};

const handleSectionsUpdate = (updatedForm) => {
  if (updatedForm.sections) {
    formData.value.sections = updatedForm.sections;
  }
  Object.assign(formData.value, updatedForm);
};

const handleSettingsUpdate = (updatedForm) => {
  Object.assign(formData.value, updatedForm);
};

const handleOutcomesUpdate = (updatedForm) => {
  // Merge outcomes and rules updates
  Object.assign(formData.value, updatedForm);
};

const handleTemplateUpdate = (updatedForm) => {
  // Merge response template updates
  Object.assign(formData.value, updatedForm);
};

// Clean form data before submission (remove empty subsections)
const getEngagementPersistSectionName = (formName) => {
  const trimmed = String(formName || '').trim();
  return trimmed || t('forms.engagementDefaultSectionName');
};

const getEngagementPersistSubsectionName = (index = 0) => {
  return t('forms.hubCreateSubsectionDefault', { number: index + 1 });
};

const normalizeEngagementSectionsForSubmit = (cleaned) => {
  const formType = (cleaned.formType || '').toLowerCase();
  if (formType !== 'survey' && formType !== 'feedback') return;

  const sections = cleaned.sections || [];
  const rootSection = sections.find((s) => s._isRootSection);
  const rootQuestions = (rootSection?.subsections?.[0]?.questions || [])
    .filter((q) => q?.questionText?.trim());
  const visibleSections = sections.filter((s) => !s._isRootSection);

  const visibleHasQuestions = visibleSections.some((section) => {
    if (section.questions?.length) return true;
    return (section.subsections || []).some((sub) => sub.questions?.length);
  });

  if (rootQuestions.length > 0 && !visibleHasQuestions) {
    cleaned.sections = [{
      sectionId: rootSection?.sectionId || generateEngagementId('SEC'),
      name: getEngagementPersistSectionName(cleaned.name),
      weightage: 0,
      subsections: [{
        subsectionId: rootSection?.subsections?.[0]?.subsectionId || generateEngagementId('SUB'),
        name: getEngagementPersistSubsectionName(0),
        weightage: 0,
        questions: rootQuestions,
        order: 0
      }],
      questions: [],
      order: 0
    }];
  } else {
    cleaned.sections = visibleSections;
  }
};

const cleanFormDataForSubmit = (data) => {
  const cleaned = JSON.parse(JSON.stringify(data));
  const isEngagementForm = ['survey', 'feedback'].includes(String(cleaned.formType || '').toLowerCase());
  normalizeEngagementSectionsForSubmit(cleaned);
  if (cleaned.sections && Array.isArray(cleaned.sections)) {
    cleaned.sections = cleaned.sections
      .filter(section => {
        if (section._isRootSection) return false;
        if (isEngagementForm) {
          if (section.questions?.some(q => q?.questionText?.trim())) return true;
          return (section.subsections || []).some(
            sub => (sub.questions || []).some(q => q?.questionText?.trim())
          );
        }
        if (!section.name || !section.name.trim()) return false;
        return true;
      })
      .map(section => {
        const cleanedSection = { ...section };
        delete cleanedSection._isRootSection;

        if (isEngagementForm && (!cleanedSection.name || !cleanedSection.name.trim())) {
          cleanedSection.name = getEngagementPersistSectionName(cleaned.name);
        }
        
        // Clean section-level questions
        if (cleanedSection.questions && Array.isArray(cleanedSection.questions)) {
          cleanedSection.questions = cleanedSection.questions.filter(question => {
            return question.questionText && question.questionText.trim();
          });
        }
        
        // Clean subsections: remove empty ones (no questions)
        if (cleanedSection.subsections && Array.isArray(cleanedSection.subsections)) {
          cleanedSection.subsections = cleanedSection.subsections
            .map((subsection, index) => {
              const cleanedSubsection = { ...subsection };
              
              // Filter out questions with empty questionText
              if (cleanedSubsection.questions && Array.isArray(cleanedSubsection.questions)) {
                cleanedSubsection.questions = cleanedSubsection.questions.filter(question => {
                  return question.questionText && question.questionText.trim();
                });
              }
              
              if (!cleanedSubsection.name || !cleanedSubsection.name.trim()) {
                cleanedSubsection.name = isEngagementForm
                  ? getEngagementPersistSubsectionName(index)
                  : t('forms.hubCreateSubsectionDefault', { number: index + 1 });
              }
              
              return cleanedSubsection;
            })
            .filter(subsection => {
              // Remove subsections that have no questions
              const hasQuestions = subsection.questions && subsection.questions.length > 0;
              return hasQuestions;
            });
        }
        
        return cleanedSection;
      });
  }
  if (cleaned.expiryDate) {
    cleaned.expiryDate = serializeEngagementExpiryForApi(cleaned.expiryDate);
  }
  return cleaned;
};

const handleSubmit = async () => {
  // This is the EXPLICIT Save action in final step
  // Only here do we transition Draft → Ready
  
  // Validate before transitioning to Ready
  if (!canSubmit.value) {
    // Show validation errors if PreviewAndSave component is available
    if (previewAndSaveRef.value && previewAndSaveRef.value.validationErrors) {
      const errors = previewAndSaveRef.value.validationErrors;
      if (errors.length > 0) {
        notifications.error(t('forms.hubCreateValidationFixPrefix', { issues: errors.join('\n') }));
        return;
      }
    }
    return;
  }

  console.log('💾 saveForm: Function called', {
    isEditing: isEditing.value,
    formId: getFormId(),
    formName: formData.value.name,
    status: formData.value.status
  });
  
  saving.value = true;
  try {
    // Clean form data before submission (remove empty subsections)
    const cleanedFormData = cleanFormDataForSubmit(formData.value);

    if (isEngagementForm.value) {
      const wantsPublicLink = cleanedFormData.publicLink?.enabled === true
        || cleanedFormData.visibility === 'Public';
      if (wantsPublicLink) {
        cleanedFormData.publicLink = {
          enabled: true,
          ...(cleanedFormData.publicLink?.slug?.trim()
            ? { slug: cleanedFormData.publicLink.slug.trim() }
            : {})
        };
      }
    }
    
    // EXPLICIT transition: Draft → Ready
    // This is the ONLY place where status changes from Draft
    // Auto-save never changes status, only explicit Save does
    cleanedFormData.status = isEngagementForm.value ? 'Active' : 'Ready';
    
    let response;
    const existingFormId = getFormId();
    if (existingFormId) {
      console.log('💾 saveForm: Updating form:', existingFormId);
      response = await apiClient.put(`/forms/${existingFormId}`, cleanedFormData);
    } else {
      console.log('💾 saveForm: Creating new form');
      response = await apiClient.post('/forms', cleanedFormData);
    }

    console.log('💾 saveForm: Save response:', {
      success: response.success,
      formId: response.data?._id,
      formName: response.data?.name
    });

    if (response.success) {
      // Mark as internal navigation to prevent beforeunload confirmation
      isInternalNavigation.value = true;
      
      // Get the form ID
      const formId = response.data._id;
      
      // Store the current edit tab ID before navigation changes the active tab
      // The edit tab path could be /forms/create or /forms/create?editFrom=ID
      const currentActiveTab = activeTab.value;
      let editTabId = null;
      
      // Check if current active tab is the edit tab
      if (currentActiveTab && currentActiveTab.path.startsWith('/forms/create')) {
        editTabId = currentActiveTab.id;
      } else {
        // Try to find by full path (includes query params like ?editFrom=...)
        const tabByFullPath = findTabByPath(route.fullPath);
        if (tabByFullPath && tabByFullPath.path.startsWith('/forms/create')) {
          editTabId = tabByFullPath.id;
        } else {
          // Fallback: try base path without query params
          const tabByPath = findTabByPath(route.path);
          if (tabByPath && tabByPath.path.startsWith('/forms/create')) {
            editTabId = tabByPath.id;
          }
        }
      }
      
      // Open the form detail tab (this also navigates to it and makes it active)
      openTab(`/forms/${formId}/detail`, {
        title: response.data.name || t('forms.tabDetailsHeading'),
        icon: 'clipboard-document',
        insertAdjacent: true
      });
      
      // Close the edit tab if it exists
      if (editTabId) {
        // Wait for Vue's reactivity to update and the detail tab to become active
        await nextTick();
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Find the tab again by ID to get the latest reference
        const editTabToClose = findTabById(editTabId);
        if (editTabToClose) {
          // Remove beforeClose callback to allow closing
          // Do this right before closing to prevent setupTabCloseHandler from interfering
          editTabToClose.beforeClose = null;
          
          // Close the tab
          try {
            await closeTab(editTabId);
          } catch (err) {
            console.error('Error closing edit tab:', err);
          }
        }
      }
    } else {
      notifications.error(response.message || t('forms.saveFormFailed'));
    }
  } catch (error) {
    console.error('Error saving form:', error);
    console.error('Error response:', error.response?.data || error);
    console.error('Error response full:', JSON.stringify(error.response?.data || error, null, 2));
    console.error('Form data being sent:', JSON.stringify(formData.value, null, 2));
    
    // Get detailed error message - prioritize actual error over generic message
    let errorMessage = t('forms.saveFormFailed');
    if (error.response?.data) {
      // Check for actual error first (more specific)
      if (error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (error.response.data.message && error.response.data.message !== 'Error creating form.') {
        // Use message if it's not the generic one
        errorMessage = error.response.data.message;
      } else if (error.response.data.message) {
        // Fallback to message even if generic
        errorMessage = error.response.data.message;
      } else if (typeof error.response.data === 'string') {
        errorMessage = error.response.data;
      } else {
        errorMessage = JSON.stringify(error.response.data);
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Show detailed error in console and alert
    console.error('Detailed error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: errorMessage
    });
    
    notifications.error(t('forms.hubCreateSaveError', { detail: errorMessage }));
  } finally {
    saving.value = false;
  }
};

const handleClose = async () => {
  console.log('🔵🔵🔵 handleClose: Function called - START');
  console.log('🔵 handleClose: Function called');
  
  // Mark as internal navigation to prevent beforeunload confirmation
  isInternalNavigation.value = true;
  
  // If form is Draft, save it before closing (no confirmation needed)
  // Check both new and existing forms
  const hasName = formData.value.name && formData.value.name.trim();
  const shouldSave = formData.value.status === 'Draft' && 
                    !draftSaveInProgress.value &&
                    (isEditing.value || hasName);
  
  console.log('🔵 handleClose: Checking save conditions', {
    hasName,
    status: formData.value.status,
    draftSaveInProgress: draftSaveInProgress.value,
    isEditing: isEditing.value,
    shouldSave
  });
  
  // Find the current tab before closing
  let currentTab = activeTab.value;
  if (!currentTab || (currentTab.path !== '/forms/create' && !currentTab.path.startsWith('/forms/create/'))) {
    currentTab = findTabByPath(route.path) || findTabByPath('/forms/create');
  }
  
  if (shouldSave) {
    console.log('🔵 handleClose: Saving draft...');
    // TODO: Re-enable notifications later
    // Show notification using global function to ensure it persists after component unmounts
    // showGlobalNotification('Draft saved successfully', 5000);
    // console.log('🔵 handleClose: Notification shown, now saving draft...');
    try {
      await saveDraft(formData.value, false);
      console.log('🔵 handleClose: Draft save complete');
    } catch (error) {
      console.error('🔵 handleClose: Error saving draft:', error);
    }
    // Clear the beforeClose callback since we've already saved
    // This prevents double-saving when closeTab calls beforeClose
    if (currentTab) {
      currentTab.beforeClose = null;
    }
  } else {
    console.log('🔵 handleClose: Not saving - conditions not met');
  }
  
  // Reset flag after a short delay to allow navigation to complete
  setTimeout(() => {
    isInternalNavigation.value = false;
  }, 100);
  
  // Always allow close (Draft is auto-saved, no blocking)
  if (currentTab) {
    closeTab(currentTab.id);
  } else {
    router.back();
  }
};
</script>




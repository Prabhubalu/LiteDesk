<template>
  <div class="space-y-6">

    <div
      v-if="form"
      :class="formSurfaceClass"
      :style="brandingStyle"
    >
      <!-- Form Header -->
      <div v-if="!hideHeader" class="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <img
          v-if="isEngagementForm && branding.logoUrl"
          :src="resolveLogoUrl(branding.logoUrl)"
          alt=""
          class="mx-auto mb-4 max-h-12 w-auto object-contain"
        />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ form.name }}</h1>
        <p v-if="form.description" class="text-gray-600 dark:text-gray-400">{{ form.description }}</p>
        <div class="flex items-center gap-4 mt-2">
          <span class="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
            {{ form.formType }}
          </span>
          <span
            v-if="form.status"
            class="text-xs px-2 py-1 rounded font-medium"
            :class="{
              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300': form.status === 'Draft',
              'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300': form.status === 'Ready',
              'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300': form.status === 'Active',
              'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400': form.status === 'Archived'
            }"
          >
            {{ form.status }}
          </span>
        </div>
      </div>

      <!-- Form Sections -->
      <form @submit.prevent="handleSubmit" class="space-y-8">
        <div
          v-for="(section, sectionIndex) in visibleSections"
          :key="section.sectionId || sectionIndex"
          class="space-y-4"
        >
          <!-- Section Header (only show if section has a name) -->
          <h2 v-if="shouldShowEngagementSectionTitle(form, section)" class="text-xl font-semibold text-gray-900 dark:text-white border-b pb-2">
            {{ section.name }}
          </h2>

          <!-- Section-level Questions (before subsections) -->
          <div v-if="section.questions && section.questions.length > 0" class="space-y-4">
            <div
              v-for="(question, qIndex) in section.questions"
              :key="question.questionId || qIndex"
              v-show="isQuestionVisible(question)"
              class="space-y-2"
            >
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ question.questionText }}
                <span v-if="question.mandatory" class="text-red-500">*</span>
              </label>

              <!-- Render question based on type -->
              <TextQuestion
                v-if="question.type === 'Text' || question.type === 'Email' || question.type === 'Number'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <TextareaQuestion
                v-else-if="question.type === 'Textarea'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <DateQuestion
                v-else-if="question.type === 'Date'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <DropdownQuestion
                v-else-if="question.type === 'Dropdown'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <RatingQuestion
                v-else-if="question.type === 'Rating'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <YesNoQuestion
                v-else-if="question.type === 'Yes-No'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <FileQuestion
                v-else-if="question.type === 'File'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                :readOnly="readOnly"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <SignatureQuestion
                v-else-if="question.type === 'Signature'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
            </div>
          </div>

          <!-- Subsections -->
          <div
            v-for="(subsection, subIndex) in section.subsections"
            :key="subsection.subsectionId || subIndex"
            class="ml-4 space-y-3"
          >
            <!-- Subsection Header (only show if subsection has a name) -->
            <h3 v-if="shouldShowEngagementSubsectionTitle(form, section, subsection)" class="text-lg font-medium text-gray-800 dark:text-gray-200">
              {{ subsection.name }}
            </h3>

            <!-- Questions -->
            <div
              v-for="(question, qIndex) in subsection.questions"
              :key="question.questionId || qIndex"
              v-show="isQuestionVisible(question)"
              class="space-y-2"
            >
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ question.questionText }}
                <span v-if="question.mandatory" class="text-red-500">*</span>
              </label>

              <!-- Render question based on type -->
              <TextQuestion
                v-if="question.type === 'Text' || question.type === 'Email' || question.type === 'Number'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <TextareaQuestion
                v-else-if="question.type === 'Textarea'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <DateQuestion
                v-else-if="question.type === 'Date'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <DropdownQuestion
                v-else-if="question.type === 'Dropdown'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <RatingQuestion
                v-else-if="question.type === 'Rating'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <YesNoQuestion
                v-else-if="question.type === 'Yes-No'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <FileQuestion
                v-else-if="question.type === 'File'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                :readOnly="readOnly"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
              <SignatureQuestion
                v-else-if="question.type === 'Signature'"
                :question="question"
                :value="previewData[question.questionId]"
                :form="form"
                :form-type="form.formType"
                @update="(val) => updateAnswer(question.questionId, val)"
                @evidence-update="handleEvidenceUpdate"
              />
            </div>
          </div>
        </div>

        <!-- Submit Button (hidden in read-only mode) -->
        <div v-if="!readOnly" class="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            :class="isEngagementForm
              ? 'px-6 py-2 text-white rounded-lg font-medium transition-all bg-[var(--wf-accent)] hover:opacity-90'
              : 'px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-all'"
          >
            {{ t('forms.previewSubmitForm') }}
          </button>
        </div>
      </form>
    </div>

    <div v-else class="text-center py-12 text-gray-600 dark:text-gray-400">
      {{ t('forms.previewNoData') }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TextQuestion from './question-types/TextQuestion.vue';
import TextareaQuestion from './question-types/TextareaQuestion.vue';
import DateQuestion from './question-types/DateQuestion.vue';
import DropdownQuestion from './question-types/DropdownQuestion.vue';
import RatingQuestion from './question-types/RatingQuestion.vue';
import YesNoQuestion from './question-types/YesNoQuestion.vue';
import FileQuestion from './question-types/FileQuestion.vue';
import SignatureQuestion from './question-types/SignatureQuestion.vue';
import {
  shouldShowEngagementSectionTitle,
  shouldShowEngagementSubsectionTitle
} from '@/utils/engagementFormDisplay';
import {
  mergeWebformBranding,
  webformBrandingCssVars,
  webformBrandingSurfaceClasses
} from '@/utils/webformBranding';
import { resolveWebformImageUrl } from '@/utils/webformFormatters';

const { t } = useI18n();

const props = defineProps({
  form: {
    type: Object,
    required: true
  },
  readOnly: {
    type: Boolean,
    default: false
  },
  hideHeader: {
    type: Boolean,
    default: false
  },
  embedded: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'submit']);

const previewData = ref({});
const evidenceData = ref({});

const isEngagementForm = computed(() => {
  const formType = String(props.form?.formType || '').toLowerCase();
  return formType === 'survey' || formType === 'feedback';
});

const branding = computed(() => mergeWebformBranding(props.form?.branding));
const brandingStyle = computed(() => (
  isEngagementForm.value ? webformBrandingCssVars(branding.value) : {}
));

const formSurfaceClass = computed(() => {
  if (props.embedded) {
    return isEngagementForm.value
      ? ['p-4 sm:p-6', webformBrandingSurfaceClasses(branding.value)].join(' ')
      : 'p-4 sm:p-6';
  }
  if (isEngagementForm.value) {
    return ['bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6', webformBrandingSurfaceClasses(branding.value)].join(' ');
  }
  return 'bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6';
});

const resolveLogoUrl = (url) => resolveWebformImageUrl(url);

// Get visible sections (filter out root sections for flat mode, unless they hold all questions)
const visibleSections = computed(() => {
  if (!props.form?.sections) return [];

  const sections = props.form.sections;
  const nonRootSections = sections.filter((section) => !section._isRootSection);

  if (nonRootSections.length > 0) {
    return nonRootSections;
  }

  const rootSection = sections.find((section) => section._isRootSection);
  if (!rootSection) return [];

  const hasRootQuestions =
    (rootSection.questions || []).length > 0 ||
    (rootSection.subsections || []).some((sub) => (sub.questions || []).length > 0);

  return hasRootQuestions ? [rootSection] : [];
});

// Check if a question should be visible based on conditional logic
// This function is called in the template, and Vue will track reactive dependencies
const isQuestionVisible = (question) => {
  // If no conditional logic, always show
  if (!question.conditionalLogic?.showIf?.questionId) {
    return true;
  }

  const { questionId: conditionalQuestionId, operator, value: expectedValue } = question.conditionalLogic.showIf;
  
  // Get the answer to the conditional question
  // Accessing previewData.value here makes Vue track this dependency
  const conditionalAnswer = previewData.value[conditionalQuestionId];
  
  // If no answer yet, hide the question
  if (conditionalAnswer === undefined || conditionalAnswer === null || conditionalAnswer === '') {
    return false;
  }

  // Evaluate based on operator
  switch (operator) {
    case 'equals':
      return String(conditionalAnswer) === String(expectedValue);
    case 'notEquals':
      return String(conditionalAnswer) !== String(expectedValue);
    case 'contains':
      return String(conditionalAnswer).toLowerCase().includes(String(expectedValue).toLowerCase());
    case 'notContains':
      return !String(conditionalAnswer).toLowerCase().includes(String(expectedValue).toLowerCase());
    case 'greaterThan':
      return Number(conditionalAnswer) > Number(expectedValue);
    case 'lessThan':
      return Number(conditionalAnswer) < Number(expectedValue);
    default:
      return true;
  }
};

const updateAnswer = (questionId, value) => {
  previewData.value[questionId] = value;
};

const handleEvidenceUpdate = ({ questionId, evidence }) => {
  if (!evidenceData.value[questionId]) {
    evidenceData.value[questionId] = {};
  }
  evidenceData.value[questionId] = evidence;
};

const validateEvidence = () => {
  if (!props.form || props.form.formType?.toLowerCase() !== 'audit') {
    return true; // No validation needed for non-audit forms
  }

  // Check all questions with evidence requirements
  for (const section of props.form.sections || []) {
    // Check section-level questions
    for (const question of section.questions || []) {
      if (!question.evidence?.enabled) continue;
      
      const answer = previewData.value[question.questionId];
      if (!answer) continue; // Skip if no answer selected
      
      // Find matching rule
      const rule = question.evidence.rules?.find(r => {
        if (question.type === 'Rating') {
          return r.when === String(answer);
        }
        return r.when === answer;
      });
      
      if (!rule) continue; // No rule for this answer
      
      const evidence = evidenceData.value[question.questionId] || {};
      
      // Check required evidence
      if (rule.comment?.required === 'required' && !evidence.comment?.trim()) {
        return false;
      }
      if (rule.image?.required === 'required' && !evidence.image) {
        return false;
      }
      if (rule.video?.required === 'required' && !evidence.video) {
        return false;
      }
    }
    
    // Check subsection-level questions
    for (const subsection of section.subsections || []) {
      for (const question of subsection.questions || []) {
        if (!question.evidence?.enabled) continue;
        
        const answer = previewData.value[question.questionId];
        if (!answer) continue; // Skip if no answer selected
        
        // Find matching rule
        const rule = question.evidence.rules?.find(r => {
          if (question.type === 'Rating') {
            return r.when === String(answer);
          }
          return r.when === answer;
        });
        
        if (!rule) continue; // No rule for this answer
        
        const evidence = evidenceData.value[question.questionId] || {};
        
        // Check required evidence
        if (rule.comment?.required === 'required' && !evidence.comment?.trim()) {
          return false;
        }
        if (rule.image?.required === 'required' && !evidence.image) {
          return false;
        }
        if (rule.video?.required === 'required' && !evidence.video) {
          return false;
        }
      }
    }
  }
  
  return true;
};

const handleSubmit = () => {
  // In read-only mode, do nothing
  if (props.readOnly) {
    return;
  }
  
  if (!validateEvidence()) {
    alert(t('forms.evidenceAddRequiredHint'));
    return;
  }
  
  emit('submit', {
    answers: previewData.value,
    evidence: evidenceData.value
  });
};

// Initialize preview data when form changes
watch(() => props.form, (newForm) => {
  previewData.value = {};
  if (newForm && newForm.sections) {
    newForm.sections.forEach(section => {
      // Handle section-level questions
      if (section.questions && Array.isArray(section.questions)) {
        section.questions.forEach(question => {
          if (question.questionId) {
            // Initialize with appropriate default value based on question type
            if (question.type === 'Rating') {
              previewData.value[question.questionId] = null;
            } else {
              previewData.value[question.questionId] = '';
            }
          }
        });
      }
      
      // Handle subsection-level questions
      if (section.subsections && Array.isArray(section.subsections)) {
        section.subsections.forEach(subsection => {
          if (subsection.questions && Array.isArray(subsection.questions)) {
            subsection.questions.forEach(question => {
              if (question.questionId) {
                // Initialize with appropriate default value based on question type
                if (question.type === 'Rating') {
                  previewData.value[question.questionId] = null;
                } else {
                  previewData.value[question.questionId] = '';
                }
              }
            });
          }
        });
      }
    });
  }
}, { immediate: true, deep: true });
</script>


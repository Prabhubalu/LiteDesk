<template>
  <div
    class="min-h-screen py-8 px-4"
    :class="pageUsesDefaultBackground ? 'bg-gray-50 dark:bg-gray-900' : webformBrandingSurfaceClasses(pageBranding)"
    :style="pageBrandingStyle"
  >
    <div class="max-w-3xl mx-auto">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div
          class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full animate-spin mx-auto mb-4"
          :style="{ borderTopColor: pageBranding.themeColor }"
        ></div>
        <p class="text-gray-600 dark:text-gray-400">{{ t('forms.builderShellLoading') }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
        <svg class="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">{{ t('forms.hubFillNotFoundTitle') }}</h2>
        <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      </div>

      <!-- Form Display -->
      <div
        v-else-if="form"
        class="rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8 bg-white dark:bg-gray-800"
        :class="webformBrandingSurfaceClasses(pageBranding)"
        :style="cardBrandingStyle"
      >
        <!-- Form Header -->
        <div class="mb-8">
          <img
            v-if="pageBranding.logoUrl"
            :src="resolveLogoUrl(pageBranding.logoUrl)"
            alt=""
            class="mx-auto mb-4 max-h-14 w-auto object-contain"
          />
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ form.name }}</h1>
          <p v-if="form.description" class="text-gray-600 dark:text-gray-400">{{ form.description }}</p>
          <div class="flex items-center gap-4 mt-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{{ t('forms.hubPublicFormIdLabel', { id: form.formId }) }}</span>
            <span v-if="form.formType">{{ t('forms.hubPublicTypeLabel', { type: form.formType }) }}</span>
          </div>
        </div>

        <!-- Form Sections -->
        <form @submit.prevent="submitForm" class="space-y-8">
          <div
            v-for="(section, sectionIndex) in visibleSections"
            :key="section.sectionId || sectionIndex"
            class="space-y-4"
          >
            <h2 v-if="shouldShowEngagementSectionTitle(form, section)" class="text-xl font-semibold text-gray-900 dark:text-white mb-4">{{ section.name }}</h2>

            <!-- Section-level questions -->
            <div v-if="section.questions && section.questions.length > 0" class="space-y-4">
              <div v-for="(question, qIndex) in section.questions" :key="question.questionId || qIndex" class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ question.questionText }}
                  <span v-if="question.mandatory" class="text-red-500">*</span>
                </label>

                <TextQuestion
                  v-if="question.type === 'Text' || question.type === 'Email' || question.type === 'Number'"
                  :question="question"
                  :value="formData[question.questionId]"
                  :form="form"
                  :form-type="form?.formType"
                  @update="(val) => updateAnswer(question.questionId, val)"
                />
                <TextareaQuestion
                  v-else-if="question.type === 'Textarea'"
                  :question="question"
                  :value="formData[question.questionId]"
                  :form="form"
                  :form-type="form?.formType"
                  @update="(val) => updateAnswer(question.questionId, val)"
                />
                <DateQuestion
                  v-else-if="question.type === 'Date'"
                  :question="question"
                  :value="formData[question.questionId]"
                  :form="form"
                  :form-type="form?.formType"
                  @update="(val) => updateAnswer(question.questionId, val)"
                />
                <DropdownQuestion
                  v-else-if="question.type === 'Dropdown'"
                  :question="question"
                  :value="formData[question.questionId]"
                  :form="form"
                  :form-type="form?.formType"
                  @update="(val) => updateAnswer(question.questionId, val)"
                />
                <RatingQuestion
                  v-else-if="question.type === 'Rating'"
                  :question="question"
                  :value="formData[question.questionId]"
                  :form="form"
                  :form-type="form?.formType"
                  @update="(val) => updateAnswer(question.questionId, val)"
                />
                <YesNoQuestion
                  v-else-if="question.type === 'Yes-No'"
                  :question="question"
                  :value="formData[question.questionId]"
                  :form="form"
                  :form-type="form?.formType"
                  @update="(val) => updateAnswer(question.questionId, val)"
                />
                <FileQuestion
                  v-else-if="question.type === 'File'"
                  :question="question"
                  :value="formData[question.questionId]"
                  :form="form"
                  :form-type="form?.formType"
                  @update="(val) => updateAnswer(question.questionId, val)"
                />
                <SignatureQuestion
                  v-else-if="question.type === 'Signature'"
                  :question="question"
                  :value="formData[question.questionId]"
                  :form="form"
                  :form-type="form?.formType"
                  @update="(val) => updateAnswer(question.questionId, val)"
                />
              </div>
            </div>
            
            <!-- Subsections -->
            <div
              v-for="(subsection, subIndex) in section.subsections"
              :key="subsection.subsectionId || subIndex"
              class="mb-6"
              :class="shouldShowEngagementSubsectionTitle(form, section, subsection) ? 'ml-4' : ''"
            >
              <h3 v-if="shouldShowEngagementSubsectionTitle(form, section, subsection)" class="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">{{ subsection.name }}</h3>
              
              <!-- Questions -->
              <div class="space-y-4" :class="shouldShowEngagementSubsectionTitle(form, section, subsection) ? 'ml-4' : ''">
                <div v-for="(question, qIndex) in subsection.questions" :key="question.questionId || qIndex" class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {{ question.questionText }}
                    <span v-if="question.mandatory" class="text-red-500">*</span>
                  </label>

                  <TextQuestion
                    v-if="question.type === 'Text' || question.type === 'Email' || question.type === 'Number'"
                    :question="question"
                    :value="formData[question.questionId]"
                    :form="form"
                    :form-type="form?.formType"
                    @update="(val) => updateAnswer(question.questionId, val)"
                  />
                  <TextareaQuestion
                    v-else-if="question.type === 'Textarea'"
                    :question="question"
                    :value="formData[question.questionId]"
                    :form="form"
                    :form-type="form?.formType"
                    @update="(val) => updateAnswer(question.questionId, val)"
                  />
                  <DateQuestion
                    v-else-if="question.type === 'Date'"
                    :question="question"
                    :value="formData[question.questionId]"
                    :form="form"
                    :form-type="form?.formType"
                    @update="(val) => updateAnswer(question.questionId, val)"
                  />
                  <DropdownQuestion
                    v-else-if="question.type === 'Dropdown'"
                    :question="question"
                    :value="formData[question.questionId]"
                    :form="form"
                    :form-type="form?.formType"
                    @update="(val) => updateAnswer(question.questionId, val)"
                  />
                  <RatingQuestion
                    v-else-if="question.type === 'Rating'"
                    :question="question"
                    :value="formData[question.questionId]"
                    :form="form"
                    :form-type="form?.formType"
                    @update="(val) => updateAnswer(question.questionId, val)"
                  />
                  <YesNoQuestion
                    v-else-if="question.type === 'Yes-No'"
                    :question="question"
                    :value="formData[question.questionId]"
                    :form="form"
                    :form-type="form?.formType"
                    @update="(val) => updateAnswer(question.questionId, val)"
                  />
                  <FileQuestion
                    v-else-if="question.type === 'File'"
                    :question="question"
                    :value="formData[question.questionId]"
                    :form="form"
                    :form-type="form?.formType"
                    @update="(val) => updateAnswer(question.questionId, val)"
                  />
                  <SignatureQuestion
                    v-else-if="question.type === 'Signature'"
                    :question="question"
                    :value="formData[question.questionId]"
                    :form="form"
                    :form-type="form?.formType"
                    @update="(val) => updateAnswer(question.questionId, val)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              :disabled="submitting"
              class="px-6 py-3 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--wf-accent)] hover:opacity-90"
            >
              <span v-if="submitting">{{ t('forms.hubFillSubmitting') }}</span>
              <span v-else>{{ t('forms.previewSubmitForm') }}</span>
            </button>
          </div>
        </form>

        <!-- Success Message -->
        <div v-if="submitted" class="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
          <svg class="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 class="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">{{ t('forms.hubFillSubmitSuccessTitle') }}</h2>
          <p class="text-green-600 dark:text-green-400">{{ t('forms.hubPublicThankYou') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import TextQuestion from '@/components/forms/question-types/TextQuestion.vue';
import TextareaQuestion from '@/components/forms/question-types/TextareaQuestion.vue';
import DateQuestion from '@/components/forms/question-types/DateQuestion.vue';
import DropdownQuestion from '@/components/forms/question-types/DropdownQuestion.vue';
import RatingQuestion from '@/components/forms/question-types/RatingQuestion.vue';
import YesNoQuestion from '@/components/forms/question-types/YesNoQuestion.vue';
import FileQuestion from '@/components/forms/question-types/FileQuestion.vue';
import SignatureQuestion from '@/components/forms/question-types/SignatureQuestion.vue';
import {
  shouldShowEngagementSectionTitle,
  shouldShowEngagementSubsectionTitle,
  getVisibleFormSections,
  forEachFormQuestion
} from '@/utils/engagementFormDisplay';
import {
  mergeWebformBranding,
  webformBrandingCssVars,
  webformBrandingSurfaceClasses
} from '@/utils/webformBranding';
import { resolveWebformImageUrl } from '@/utils/webformFormatters';

const { t } = useI18n();
const route = useRoute();
const slug = route.params.slug;

const loading = ref(true);
const error = ref(null);
const form = ref(null);
const formData = ref({});
const submitting = ref(false);
const submitted = ref(false);

const pageBranding = computed(() => mergeWebformBranding(form.value?.branding));
const pageUsesDefaultBackground = computed(() => !pageBranding.value.backgroundColor);
const pageBrandingStyle = computed(() => webformBrandingCssVars(pageBranding.value));
const cardBrandingStyle = computed(() => webformBrandingCssVars(pageBranding.value));
const visibleSections = computed(() => getVisibleFormSections(form.value?.sections));

const resolveLogoUrl = (url) => resolveWebformImageUrl(url);

const initializeFormData = () => {
  formData.value = {};
  if (form.value?.sections) {
    forEachFormQuestion(form.value.sections, (question) => {
      formData.value[question.questionId] = '';
    });
  }
};

const fetchForm = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch(`/api/public/forms/${slug}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const response = await res.json().catch(() => ({}));

    if (res.ok && response.success && response.data) {
      form.value = response.data;
      initializeFormData();
    } else if (res.status === 410) {
      error.value = response.message || t('forms.hubPublicFormExpired');
    } else {
      error.value = response.message || t('forms.hubPublicFormNotFound');
    }
  } catch (err) {
    console.error('Error fetching form:', err);
    error.value = err.message || t('forms.hubPublicLoadFailed');
  } finally {
    loading.value = false;
  }
};

const updateAnswer = (questionId, value) => {
  formData.value[questionId] = value;
};

const submitForm = async () => {
  submitting.value = true;
  try {
    // Prepare submission data - backend expects responseDetails array
    const responseDetails = Object.keys(formData.value)
      .filter(questionId => formData.value[questionId] !== '' && formData.value[questionId] !== null)
      .map(questionId => {
        let sectionId = '';
        let subsectionId = '';

        if (form.value.sections) {
          forEachFormQuestion(form.value.sections, (question, section, subsection) => {
            if (question.questionId === questionId) {
              sectionId = section.sectionId;
              subsectionId = subsection?.subsectionId || '';
            }
          });
        }
        
        return {
          questionId,
          sectionId: sectionId || undefined,
          subsectionId: subsectionId || undefined,
          answer: formData.value[questionId]
        };
      });

    const submissionData = {
      responseDetails,
      linkedTo: null // Can be set if linking to a CRM entity
    };

    // Public endpoint - use fetch directly since apiClient might require auth
    const response = await fetch(`/api/public/forms/${slug}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submissionData)
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
      console.error('Form submission error:', responseData);
      throw new Error(responseData.message || responseData.error || `Server error: ${response.status}`);
    }

    if (responseData && responseData.success) {
      submitted.value = true;
      // Reset form after 3 seconds
      setTimeout(() => {
        submitted.value = false;
        initializeFormData();
      }, 3000);
    }
  } catch (err) {
    console.error('Error submitting form:', err);
    error.value = err.message || t('forms.hubPublicSubmitFailed');
    // Clear error after 5 seconds
    setTimeout(() => {
      error.value = null;
    }, 5000);
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  fetchForm();
});
</script>

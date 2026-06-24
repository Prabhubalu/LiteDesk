<template>
  <div class="space-y-6">
    <!-- Type hero -->
    <div
      class="rounded-2xl border p-6 sm:p-8"
      :class="heroClasses"
    >
      <div class="flex items-start gap-4">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          :class="iconBadgeClasses"
        >
          <component :is="typeIcon" class="h-6 w-6" />
        </div>
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wider opacity-80">
            {{ typeLabel }}
          </p>
          <h3 class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
            {{ heroTitle }}
          </h3>
          <p class="mt-2 text-sm leading-relaxed opacity-90">
            {{ heroDescription }}
          </p>
        </div>
      </div>
    </div>

    <div class="space-y-5">
      <!-- Form name -->
      <div>
        <label :class="FORM_FIELD_LABEL_CLASS" for="engagement-form-name">
          {{ t('forms.fieldFormName') }} <span class="text-red-500">*</span>
        </label>
        <input
          id="engagement-form-name"
          v-model="localForm.name"
          type="text"
          maxlength="255"
          :placeholder="namePlaceholder"
          :class="FORM_FIELD_INPUT_CLASS"
        />
      </div>

      <!-- Description / intro -->
      <div>
        <label :class="FORM_FIELD_LABEL_CLASS" for="engagement-form-intro">
          {{ introLabel }}
        </label>
        <textarea
          id="engagement-form-intro"
          v-model="localForm.description"
          rows="3"
          maxlength="1000"
          :placeholder="introPlaceholder"
          :class="FORM_FIELD_TEXTAREA_CLASS"
        />
        <p :class="FORM_FIELD_HINT_CLASS">
          {{ introHint }}
        </p>
      </div>

      <!-- Visibility -->
      <div>
        <label :class="FORM_FIELD_LABEL_CLASS" for="engagement-form-visibility">
          {{ t('forms.fieldVisibility') }}
        </label>
        <HeadlessSelect
          id="engagement-form-visibility"
          v-model="localForm.visibility"
          :options="visibilityOptions"
          wrapper-class="mt-2"
        />
        <p v-if="selectedVisibilityDescription" :class="FORM_FIELD_HINT_CLASS">
          {{ selectedVisibilityDescription }}
        </p>
      </div>

      <!-- Survey expiry -->
      <div v-if="isSurvey">
        <label :class="FORM_FIELD_LABEL_CLASS" for="engagement-form-expiry">
          {{ t('forms.fieldExpiryDate') }}
        </label>
        <DateTimePicker
          id="engagement-form-expiry"
          v-model="localForm.expiryDate"
          :input-class="FORM_DATE_INPUT_CLASS"
        />
        <p :class="FORM_FIELD_HINT_CLASS">
          {{ t('forms.engagementExpiryHint') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon
} from '@heroicons/vue/24/outline';
import DateTimePicker from '@/components/common/DateTimePicker.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { normalizeEngagementExpiryForInput } from '@/utils/engagementFormDisplay';
import { PROCESS_INPUT_CLASS } from '@/utils/processDesignerConstants';

const FORM_FIELD_LABEL_CLASS = 'block text-sm/6 font-medium text-gray-900 dark:text-white';
const FORM_FIELD_INPUT_CLASS = PROCESS_INPUT_CLASS.replace('block w-full', 'block w-full mt-2');
const FORM_FIELD_TEXTAREA_CLASS = `${FORM_FIELD_INPUT_CLASS} resize-none`;
const FORM_FIELD_HINT_CLASS = 'mt-1 text-xs text-gray-500 dark:text-gray-400';
const FORM_DATE_INPUT_CLASS = `${FORM_FIELD_INPUT_CLASS} cursor-pointer`;

const { t } = useI18n();

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

const initializeLocalForm = () => {
  const formData = props.form || {};
  return {
    ...formData,
    name: formData.name || '',
    description: formData.description || '',
    formType: formData.formType || 'Survey',
    visibility: formData.visibility || 'Public',
    expiryDate: normalizeEngagementExpiryForInput(formData.expiryDate)
  };
};

const localForm = ref(initializeLocalForm());
let isSyncing = false;
let lastEmittedForm = null;

const formTypeLower = computed(() => (localForm.value.formType || 'survey').toLowerCase());
const isSurvey = computed(() => formTypeLower.value === 'survey');
const isFeedback = computed(() => formTypeLower.value === 'feedback');

const typeLabel = computed(() => {
  if (isFeedback.value) return t('forms.typeFeedback');
  return t('forms.typeSurvey');
});

const typeIcon = computed(() => isFeedback.value ? HandThumbUpIcon : ChatBubbleLeftRightIcon);

const heroClasses = computed(() => {
  if (isFeedback.value) {
    return 'border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-gray-900';
  }
  return 'border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-gray-900';
});

const iconBadgeClasses = computed(() => {
  return isFeedback.value ? 'bg-emerald-500' : 'bg-blue-500';
});

const heroTitle = computed(() => {
  if (isFeedback.value) return t('forms.engagementDetailsFeedbackTitle');
  return t('forms.engagementDetailsSurveyTitle');
});

const heroDescription = computed(() => {
  if (isFeedback.value) return t('forms.engagementDetailsFeedbackDesc');
  return t('forms.engagementDetailsSurveyDesc');
});

const namePlaceholder = computed(() => {
  if (isFeedback.value) return t('forms.engagementNamePhFeedback');
  return t('forms.engagementNamePhSurvey');
});

const introLabel = computed(() => {
  if (isFeedback.value) return t('forms.engagementIntroLabelFeedback');
  return t('forms.engagementIntroLabelSurvey');
});

const introPlaceholder = computed(() => {
  if (isFeedback.value) return t('forms.engagementIntroPhFeedback');
  return t('forms.engagementIntroPhSurvey');
});

const introHint = computed(() => {
  if (isFeedback.value) return t('forms.engagementIntroHintFeedback');
  return t('forms.engagementIntroHintSurvey');
});

const visibilityOptions = computed(() => [
  {
    value: 'Public',
    label: t('forms.visibilityPublic'),
    description: t('forms.engagementVisibilityPublicDesc')
  },
  {
    value: 'Partner',
    label: t('forms.visibilityPartner'),
    description: t('forms.engagementVisibilityPartnerDesc')
  },
  {
    value: 'Internal',
    label: t('forms.visibilityInternal'),
    description: t('forms.engagementVisibilityInternalDesc')
  }
]);

const selectedVisibilityDescription = computed(() => {
  const selected = visibilityOptions.value.find((option) => option.value === localForm.value.visibility);
  return selected?.description || '';
});

watch(() => props.form?.formType, (newType) => {
  if (newType && newType !== localForm.value.formType) {
    isSyncing = true;
    localForm.value = initializeLocalForm();
    lastEmittedForm = null;
    setTimeout(() => { isSyncing = false; }, 100);
  }
});

watch(() => localForm.value, (newForm) => {
  if (!isSyncing) {
    const serialized = JSON.stringify(newForm);
    if (serialized !== lastEmittedForm) {
      lastEmittedForm = serialized;
      emit('update', JSON.parse(serialized));
    }
  }
}, { deep: true });
</script>

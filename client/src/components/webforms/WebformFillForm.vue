<template>
  <div
    :class="[WEBFORM_CARD_CLASS, webformBrandingSurfaceClasses(branding), 'overflow-visible']"
    :style="brandingStyle"
  >
    <div
      v-if="webform.headerImageUrl"
      :class="WEBFORM_CARD_HEADER_IMAGE_WRAP_CLASS"
    >
      <img
        :src="resolveWebformImageUrl(webform.headerImageUrl)"
        alt=""
        class="h-36 w-full object-cover"
      >
    </div>

    <div class="overflow-visible p-6 sm:p-8">
      <header class="mb-6">
        <img
          v-if="branding.logoUrl"
          :src="resolveWebformImageUrl(branding.logoUrl)"
          alt=""
          class="mx-auto mb-4 max-h-12 w-auto object-contain"
        >
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ webform.name || t('webforms.defaultName') }}</h1>
        <p v-if="webform.description" class="mt-2 text-gray-600 dark:text-gray-400">{{ webform.description }}</p>
        <p v-if="preview" class="mt-3 text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          {{ t('webforms.builderPreviewMode') }}
        </p>
      </header>

        <div v-if="!sortedFields.length" class="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          {{ t('webforms.builderPreviewNoFields') }}
        </div>

      <form v-else class="overflow-visible" @submit.prevent="handleSubmit">
        <div v-if="multiStepActive && currentStep" class="mb-6">
          <div v-if="showProgress" class="mb-3">
            <div class="mb-2 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              <span>{{ t('webforms.multiStepProgress', { current: currentStepIndex + 1, total: orderedSteps.length }) }}</span>
              <span>{{ Math.round(((currentStepIndex + 1) / orderedSteps.length) * 100) }}%</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                class="h-full rounded-full transition-all duration-300"
                :class="WEBFORM_ACCENT_BG_CLASS"
                :style="{ width: `${((currentStepIndex + 1) / orderedSteps.length) * 100}%` }"
              />
            </div>
          </div>
          <div v-if="orderedSteps.length > 1" class="flex flex-wrap gap-2">
            <span
              v-for="(step, index) in orderedSteps"
              :key="step.stepId"
              class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
              :class="index === currentStepIndex
                ? WEBFORM_MULTI_STEP_CHIP_ACTIVE_CLASS
                : index < currentStepIndex
                  ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  : 'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500'"
            >
              {{ step.title || t('webforms.multiStepUntitled', { number: index + 1 }) }}
            </span>
          </div>
          <div v-if="currentStep.description" class="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {{ currentStep.description }}
          </div>
          <h2 v-else-if="currentStep.title" class="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
            {{ currentStep.title }}
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-5 overflow-visible sm:grid-cols-2">
          <div
            v-if="!activeVisibleFields.length"
            class="sm:col-span-2 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400"
          >
            {{ t('webforms.multiStepNoVisibleFields') }}
          </div>
          <div
            v-for="field in activeVisibleFields"
            :key="field.fieldId"
            :class="[
              field.columnWidth === 'half' ? 'sm:col-span-1' : 'sm:col-span-2',
              'overflow-visible'
            ]"
            :data-field-id="field.fieldId"
          >
            <label
              v-if="!isCheckboxFieldType(field.type)"
              class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {{ field.label }}
              <span v-if="isFieldRequired(field)" class="text-red-500">*</span>
            </label>
            <p v-if="field.helpText" class="mb-1 text-xs text-gray-500 dark:text-gray-400">{{ field.helpText }}</p>

            <input
              v-if="isNativeInputFieldType(field.type)"
              :value="modelValue[field.fieldId]"
              :type="htmlInputTypeForFieldType(field.type)"
              :required="isFieldRequired(field) && !preview"
              :placeholder="field.placeholder || ''"
              :disabled="disabled || isFieldReadonly(field)"
              :class="fieldInputClass(field.fieldId)"
              @input="onFieldInput(field.fieldId, $event.target.value)"
            />

            <textarea
              v-else-if="isTextareaFieldType(field.type)"
              :value="modelValue[field.fieldId]"
              :required="isFieldRequired(field) && !preview"
              :disabled="disabled || isFieldReadonly(field)"
              rows="4"
              :class="fieldInputClass(field.fieldId)"
              @input="onFieldInput(field.fieldId, $event.target.value)"
            />

            <PicklistComboboxField
              v-else-if="isSingleSelectFieldType(field.type) || isRadioFieldType(field.type)"
              :model-value="modelValue[field.fieldId] ?? ''"
              :options="fieldOptions(field)"
              :disabled="disabled || isFieldReadonly(field)"
              :has-error="!!fieldErrors[field.fieldId]"
              :placeholder="field.placeholder || selectPlaceholder"
              @update:model-value="onFieldInput(field.fieldId, $event)"
            />

            <TagMultiPicklistField
              v-else-if="isMultiPicklistFieldType(field.type)"
              :model-value="multiSelectValue(field.fieldId)"
              :options="fieldOptions(field)"
              :disabled="disabled || isFieldReadonly(field)"
              :has-error="!!fieldErrors[field.fieldId]"
              :placeholder="field.placeholder || selectPlaceholder"
              @update:model-value="onFieldInput(field.fieldId, $event)"
            />

            <label v-else-if="isCheckboxFieldType(field.type)" class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                :checked="!!modelValue[field.fieldId]"
                :disabled="disabled || isFieldReadonly(field)"
                :class="['rounded border-gray-300 disabled:opacity-60', WEBFORM_ACCENT_CONTROL_CLASS]"
                @change="onFieldInput(field.fieldId, $event.target.checked)"
              />
              <span>
                {{ field.placeholder || field.label }}
                <span v-if="isFieldRequired(field)" class="text-red-500">*</span>
              </span>
            </label>

            <div v-else-if="isFileFieldType(field.type)" class="space-y-2">
              <input
                type="file"
                :disabled="disabled || preview || !publicSlug || fileUploadState[field.fieldId]?.uploading"
                :class="fieldInputClass(field.fieldId)"
                @change="onFileSelected(field, $event)"
              />
              <p v-if="preview" class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('webforms.fileFieldPreviewHint') }}
              </p>
              <p v-else-if="!publicSlug" class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('webforms.fileFieldUnavailable') }}
              </p>
              <p v-if="fileUploadState[field.fieldId]?.uploading" class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('webforms.fileFieldUploading') }}
              </p>
              <p v-if="fileUploadState[field.fieldId]?.error" class="text-xs text-red-600 dark:text-red-400">
                {{ fileUploadState[field.fieldId].error }}
              </p>
              <div
                v-if="modelValue[field.fieldId]?.fileName"
                class="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/60"
              >
                <span class="truncate text-gray-700 dark:text-gray-300">{{ modelValue[field.fieldId].fileName }}</span>
                <button
                  v-if="!disabled && !preview"
                  type="button"
                  class="shrink-0 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                  @click="clearFileField(field.fieldId)"
                >
                  {{ t('webforms.fileFieldRemove') }}
                </button>
              </div>
            </div>

            <input
              v-else
              :value="modelValue[field.fieldId]"
              type="text"
              :required="isFieldRequired(field) && !preview"
              :placeholder="field.placeholder || ''"
              :disabled="disabled || isFieldReadonly(field)"
              :class="fieldInputClass(field.fieldId)"
              @input="onFieldInput(field.fieldId, $event.target.value)"
            />

            <p v-if="fieldErrors[field.fieldId]" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ fieldErrors[field.fieldId] }}
            </p>
          </div>
        </div>

        <p v-if="submitError" class="mt-5 text-sm text-red-600 dark:text-red-400">{{ submitError }}</p>

        <slot name="before-actions" />

        <WebformFormActionsBar
          :form-actions="webform.formActions"
          :preview="preview"
          :disabled="disabled"
          :submitting="submitting"
          :submit-label="preview ? t('webforms.builderPreviewSubmit') : ''"
          :theme-color="branding.themeColor"
          :step-mode="multiStepActive"
          :show-back="multiStepActive && currentStepIndex > 0"
          :show-next="multiStepActive && !isLastStep"
          :show-submit="!multiStepActive || isLastStep"
          @reset="handleReset"
          @back="goToPreviousStep"
          @next="goToNextStep"
        />
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { resolveWebformImageUrl } from '@/utils/webformFormatters';
import { mergeWebformBranding, webformBrandingCssVars, webformBrandingSurfaceClasses } from '@/utils/webformBranding';
import {
  WEBFORM_ACCENT_BG_CLASS,
  WEBFORM_ACCENT_CONTROL_CLASS,
  WEBFORM_CARD_CLASS,
  WEBFORM_CARD_HEADER_IMAGE_WRAP_CLASS,
  WEBFORM_FIELD_INPUT_CLASS,
  WEBFORM_FIELD_INPUT_ERROR_CLASS,
  WEBFORM_FIELD_INPUT_FOCUS_CLASS,
  WEBFORM_MULTI_STEP_CHIP_ACTIVE_CLASS
} from '@/utils/webformUiClasses';
import WebformFormActionsBar from '@/components/webforms/WebformFormActionsBar.vue';
import TagMultiPicklistField from '@/components/common/TagMultiPicklistField.vue';
import PicklistComboboxField from '@/components/common/PicklistComboboxField.vue';
import { validateWebformFields } from '@/utils/webformFieldValidation';
import { uploadPublicWebformFile } from '@/utils/webformFileUpload';
import { filterVisibleWebformFields } from '@/utils/webformConditionalLogic';
import {
  filterVisibleWebformFieldsWithDependencies,
  getWebformFieldDependencyState,
  resolveWebformModuleFields
} from '@/utils/webformModuleFields';
import {
  filterVisibleFieldsForStep,
  isMultiStepFormActive,
  orderedWebformSteps
} from '@/utils/webformMultiStep';
import {
  htmlInputTypeForFieldType,
  isCheckboxFieldType,
  isFileFieldType,
  isMultiPicklistFieldType,
  isNativeInputFieldType,
  isRadioFieldType,
  isSingleSelectFieldType,
  isTextareaFieldType,
  normalizeWebformFieldType
} from '@/utils/webformFieldTypeUtils';

const props = defineProps({
  webform: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
  preview: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  submitError: { type: String, default: '' },
  publicSlug: { type: String, default: '' }
});

const emit = defineEmits(['submit', 'update:modelValue', 'reset', 'validation-failed']);

const { t } = useI18n();
const fieldErrors = ref({});
const fileUploadState = ref({});
const currentStepIndex = ref(0);

const branding = computed(() => mergeWebformBranding(props.webform?.branding));

const multiStepActive = computed(() => isMultiStepFormActive(props.webform));
const orderedSteps = computed(() => orderedWebformSteps(props.webform));
const currentStep = computed(() => orderedSteps.value[currentStepIndex.value] || null);
const isLastStep = computed(() =>
  !multiStepActive.value || currentStepIndex.value >= orderedSteps.value.length - 1
);
const showProgress = computed(() => props.webform?.multiStep?.showProgress !== false);

const brandingStyle = computed(() => webformBrandingCssVars(branding.value));

const selectPlaceholder = computed(() => {
  const value = t('webforms.publicSelectOption');
  return value && !String(value).startsWith('[missing:') ? value : 'Select an option';
});

function fieldInputClass(fieldId) {
  const hasError = !!fieldErrors.value[fieldId];
  return [
    WEBFORM_FIELD_INPUT_CLASS,
    hasError ? WEBFORM_FIELD_INPUT_ERROR_CLASS : WEBFORM_FIELD_INPUT_FOCUS_CLASS
  ];
}

const sortedFields = computed(() => {
  const fields = Array.isArray(props.webform?.fields) ? [...props.webform.fields] : [];
  return fields
    .map((field) => ({ ...field, type: normalizeWebformFieldType(field.type) }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

const moduleKey = computed(() => String(props.webform?.targetModuleKey || '').trim());
const moduleFields = computed(() => resolveWebformModuleFields(props.webform));

const visibleFields = computed(() => {
  if (moduleKey.value) {
    return filterVisibleWebformFieldsWithDependencies(
      sortedFields.value,
      props.modelValue,
      moduleKey.value,
      moduleFields.value
    );
  }
  return filterVisibleWebformFields(sortedFields.value, props.modelValue);
});

const activeVisibleFields = computed(() => {
  if (!multiStepActive.value || !currentStep.value) return visibleFields.value;
  return filterVisibleFieldsForStep(
    sortedFields.value,
    props.webform,
    currentStep.value.stepId,
    props.modelValue
  );
});

watch(
  () => [props.webform?.multiStep?.enabled, orderedSteps.value.length],
  () => {
    currentStepIndex.value = 0;
  }
);

function validationOptions() {
  return {
    moduleKey: moduleKey.value,
    allFields: sortedFields.value,
    moduleFields: moduleFields.value
  };
}

function fieldDependencyState(field) {
  if (!moduleKey.value) {
    return {
      visible: true,
      required: field.required === true,
      allowedOptions: null
    };
  }
  return getWebformFieldDependencyState(
    field,
    sortedFields.value,
    props.modelValue,
    moduleKey.value,
    moduleFields.value
  );
}

function isFieldRequired(field) {
  return fieldDependencyState(field).required === true;
}

function isFieldReadonly(field) {
  return fieldDependencyState(field).readonly === true;
}

function applyDependencySetValues(values) {
  if (!moduleKey.value) return values;
  const next = { ...values };
  for (const field of sortedFields.value) {
    const state = getWebformFieldDependencyState(
      field,
      sortedFields.value,
      next,
      moduleKey.value,
      moduleFields.value
    );
    if (state.setValue !== null && state.setValue !== undefined) {
      next[field.fieldId] = state.setValue;
    }
  }
  return next;
}

function fieldOptions(field) {
  const state = fieldDependencyState(field);
  if (Array.isArray(state.allowedOptions) && state.allowedOptions.length) {
    return state.allowedOptions;
  }
  return Array.isArray(field.options) ? field.options : [];
}

function validationMessages() {
  return {
    required: (label) => t('webforms.validationRequired', { label }),
    emailInvalid: (label) => t('webforms.validationEmailInvalid', { label }),
    phoneInvalid: (label) => t('webforms.validationPhoneInvalid', { label }),
    fileInvalid: (label) => t('webforms.validationFileInvalid', { label })
  };
}

function clearFieldError(fieldId) {
  if (!fieldErrors.value[fieldId]) return;
  const next = { ...fieldErrors.value };
  delete next[fieldId];
  fieldErrors.value = next;
}

function handleSubmit() {
  if (props.preview) return;
  if (multiStepActive.value && !isLastStep.value) {
    goToNextStep();
    return;
  }

  const result = validateWebformFields(visibleFields.value, props.modelValue, validationMessages(), validationOptions());
  fieldErrors.value = result.errors;

  if (!result.valid) {
    emit('validation-failed', result);
    if (result.firstErrorFieldId) {
      const el = document.querySelector(`[data-field-id="${result.firstErrorFieldId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  emit('submit');
}

function goToPreviousStep() {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value -= 1;
    fieldErrors.value = {};
  }
}

function goToNextStep() {
  if (props.preview) {
    if (!isLastStep.value) currentStepIndex.value += 1;
    return;
  }

  const result = validateWebformFields(
    activeVisibleFields.value,
    props.modelValue,
    validationMessages(),
    validationOptions()
  );
  fieldErrors.value = result.errors;

  if (!result.valid) {
    emit('validation-failed', result);
    if (result.firstErrorFieldId) {
      const el = document.querySelector(`[data-field-id="${result.firstErrorFieldId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  if (!isLastStep.value) {
    currentStepIndex.value += 1;
    fieldErrors.value = {};
  }
}

function emptyValueForField(field) {
  if (isCheckboxFieldType(field.type)) return false;
  if (isFileFieldType(field.type)) return null;
  if (isMultiPicklistFieldType(field.type)) return [];
  return '';
}

function handleReset() {
  const next = {};
  for (const field of sortedFields.value) {
    next[field.fieldId] = emptyValueForField(field);
  }
  fieldErrors.value = {};
  fileUploadState.value = {};
  currentStepIndex.value = 0;
  emit('update:modelValue', next);
  emit('reset');
}

function onFieldInput(fieldId, value) {
  clearFieldError(fieldId);
  updateField(fieldId, value);
}

function multiSelectValue(fieldId) {
  const value = props.modelValue[fieldId];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((part) => part.trim()).filter(Boolean);
  }
  return [];
}

function updateField(fieldId, value) {
  emit('update:modelValue', applyDependencySetValues({ ...props.modelValue, [fieldId]: value }));
}

function setFileUploadState(fieldId, patch) {
  fileUploadState.value = {
    ...fileUploadState.value,
    [fieldId]: {
      ...(fileUploadState.value[fieldId] || {}),
      ...patch
    }
  };
}

async function onFileSelected(field, event) {
  const input = event.target;
  const file = input?.files?.[0];
  if (!file || !field?.fieldId) return;

  clearFieldError(field.fieldId);

  if (props.preview || !props.publicSlug) {
    updateField(field.fieldId, {
      uploadToken: 'preview',
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size
    });
    if (input) input.value = '';
    return;
  }

  setFileUploadState(field.fieldId, { uploading: true, error: '' });

  try {
    const uploaded = await uploadPublicWebformFile({
      slug: props.publicSlug,
      fieldId: field.fieldId,
      file
    });
    updateField(field.fieldId, uploaded);
    setFileUploadState(field.fieldId, { uploading: false, error: '' });
  } catch (error) {
    setFileUploadState(field.fieldId, {
      uploading: false,
      error: error?.message || t('webforms.fileFieldUploadFailed')
    });
  } finally {
    if (input) input.value = '';
  }
}

function clearFileField(fieldId) {
  clearFieldError(fieldId);
  setFileUploadState(fieldId, { uploading: false, error: '' });
  updateField(fieldId, null);
}
</script>

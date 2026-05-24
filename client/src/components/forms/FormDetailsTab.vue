<template>
  <div class="space-y-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.tabDetailsHeading') }}</h2>

    <!-- Form ID (Read-only if exists) -->
    <div v-if="form?.formId" class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {{ t('forms.fieldFormId') }}
      </label>
      <input
        type="text"
        :value="form.formId"
        disabled
        class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 font-mono text-sm"
      />
    </div>

    <!-- Form Name -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.fieldFormName') }} <span class="text-red-500">*</span>
      </label>
      <input
        v-model="localForm.name"
        type="text"
        :placeholder="t('forms.fieldFormNamePh')"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>

    <!-- Description -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.fieldDescription') }}
      </label>
      <textarea
        v-model="localForm.description"
        rows="3"
        :placeholder="t('forms.fieldFormDescriptionPh')"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      ></textarea>
    </div>

    <!-- Form Type -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.fieldFormType') }} <span class="text-red-500">*</span>
      </label>
      <select
        v-model="localForm.formType"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      >
        <option value="Audit">{{ t('forms.typeAudit') }}</option>
        <option value="Survey">{{ t('forms.typeSurvey') }}</option>
        <option value="Feedback">{{ t('forms.typeFeedback') }}</option>
        <option value="Inspection">{{ t('forms.typeInspection') }}</option>
        <option value="Custom">{{ t('forms.typeCustom') }}</option>
      </select>
    </div>

    <!-- Visibility and Status -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.fieldVisibility') }}
        </label>
        <select
          v-model="localForm.visibility"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="Internal">{{ t('forms.visibilityInternal') }}</option>
          <option value="Partner">{{ t('forms.visibilityPartner') }}</option>
          <option value="Public">{{ t('forms.visibilityPublic') }}</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.fieldStatus') }}
        </label>
        <select
          v-model="localForm.status"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="Draft">{{ t('forms.statusDraft') }}</option>
          <option value="Ready">{{ t('forms.statusReady') }}</option>
          <option value="Active">{{ t('forms.statusActive') }}</option>
          <option value="Archived">{{ t('forms.statusArchived') }}</option>
        </select>
      </div>
    </div>

    <!-- Expiry Date (for Surveys) -->
    <div v-if="localForm.formType === 'Survey'">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.fieldExpiryDate') }}
      </label>
      <input
        v-model="localForm.expiryDate"
        type="date"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
        @click="openDatePicker"
      />
    </div>

    <!-- Tags -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.fieldTags') }}
      </label>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="(tag, index) in localForm.tags"
          :key="index"
          class="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
        >
          {{ tag }}
          <button
            @click="removeTag(index)"
            class="hover:text-indigo-900 dark:hover:text-indigo-100"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
        <input
          v-model="newTag"
          @keyup.enter="addTag"
          type="text"
          :placeholder="t('forms.fieldAddTagPh')"
          class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>
    </div>

    <!-- Approval Required -->
    <label class="flex items-center">
      <HeadlessCheckbox
        v-model="localForm.approvalRequired"
        checkbox-class="w-4 h-4"
      />
      <span class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('forms.fieldApprovalRequired') }}
      </span>
    </label>

    <!-- Notes -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.fieldNotes') }}
      </label>
      <textarea
        v-model="localForm.notes"
        rows="4"
        :placeholder="t('forms.fieldNotesPh')"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { openDatePicker } from '@/utils/dateUtils';

const { t } = useI18n();

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

// Initialize localForm with proper defaults
const initializeLocalForm = () => {
  const formData = props.form || {};
  return {
    name: formData.name || '',
    description: formData.description || '',
    formType: formData.formType || 'Audit',
    visibility: formData.visibility || 'Internal',
    status: formData.status || 'Draft',
    expiryDate: formData.expiryDate || null,
    tags: Array.isArray(formData.tags) ? [...formData.tags] : [],
    approvalRequired: formData.approvalRequired || false,
    notes: formData.notes || '',
    ...formData
  };
};

const localForm = ref(initializeLocalForm());
const newTag = ref('');
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

const addTag = () => {
  if (newTag.value.trim() && !localForm.value.tags.includes(newTag.value.trim())) {
    localForm.value.tags.push(newTag.value.trim());
    newTag.value = '';
  }
};

const removeTag = (index) => {
  localForm.value.tags.splice(index, 1);
};
</script>

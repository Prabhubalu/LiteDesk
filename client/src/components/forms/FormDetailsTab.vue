<template>
  <div class="space-y-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Form Details</h2>

    <!-- Form ID (Read-only if exists) -->
    <div v-if="form?.formId" class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Form ID
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
        Form Name <span class="text-red-500">*</span>
      </label>
      <input
        v-model="localForm.name"
        type="text"
        placeholder="Enter form name"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
    </div>

    <!-- Description -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Description
      </label>
      <textarea
        v-model="localForm.description"
        rows="3"
        placeholder="Enter form description"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      ></textarea>
    </div>

    <!-- Form Type and Linked Module -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Form Type <span class="text-red-500">*</span>
        </label>
        <select
          v-model="localForm.formType"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option value="Audit">Audit</option>
          <option value="Survey">Survey</option>
          <option value="Feedback">Feedback</option>
          <option value="Inspection">Inspection</option>
          <option value="Custom">Custom</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Linked Module
        </label>
        <select
          v-model="localForm.linkedModule"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option :value="null">None</option>
          <option value="Organization">Organization</option>
          <option value="Deal">Deal</option>
          <option value="Task">Task</option>
          <option value="Event">Event</option>
          <option value="Lead">Lead</option>
          <option value="Contact">Contact</option>
        </select>
      </div>
    </div>

    <!-- Visibility and Status -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Visibility
        </label>
        <select
          v-model="localForm.visibility"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option value="Internal">Internal</option>
          <option value="Partner">Partner</option>
          <option value="Public">Public</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Status
        </label>
        <select
          v-model="localForm.status"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option value="Draft">Draft</option>
          <option value="Active">Active</option>
          <option value="Closed">Closed</option>
        </select>
      </div>
    </div>

    <!-- Expiry Date (for Surveys) -->
    <div v-if="localForm.formType === 'Survey'">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Expiry Date
      </label>
      <input
        v-model="localForm.expiryDate"
        type="date"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
    </div>

    <!-- Tags -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Tags
      </label>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="(tag, index) in localForm.tags"
          :key="index"
          class="inline-flex items-center gap-1 px-3 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-sm"
        >
          {{ tag }}
          <button
            @click="removeTag(index)"
            class="hover:text-brand-900 dark:hover:text-brand-100"
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
          placeholder="Add tag..."
          class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>
    </div>

    <!-- Approval Required -->
    <div class="flex items-center">
      <input
        v-model="localForm.approvalRequired"
        type="checkbox"
        id="approvalRequired"
        class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
      />
      <label for="approvalRequired" class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        Approval Required
      </label>
    </div>

    <!-- Notes -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Notes
      </label>
      <textarea
        v-model="localForm.notes"
        rows="4"
        placeholder="Internal notes about this form"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

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
    linkedModule: formData.linkedModule || null,
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


<template>
  <div class="space-y-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Form Settings</h2>

    <!-- KPI Metrics -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        KPI Metrics
      </label>
      <div class="space-y-2">
        <label class="flex items-center">
          <input
            v-model="kpiMetrics"
            type="checkbox"
            value="Compliance %"
            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Compliance Percentage</span>
        </label>
        <label class="flex items-center">
          <input
            v-model="kpiMetrics"
            type="checkbox"
            value="Satisfaction %"
            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Satisfaction Percentage</span>
        </label>
        <label class="flex items-center">
          <input
            v-model="kpiMetrics"
            type="checkbox"
            value="Avg Rating"
            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Average Rating</span>
        </label>
      </div>
    </div>

    <!-- Scoring Formula -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Scoring Formula
      </label>
      <input
        v-model="localForm.scoringFormula"
        type="text"
        placeholder="e.g., (Passed / Total) * 100"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Formula for calculating overall form score
      </p>
    </div>

    <!-- Thresholds -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Pass Threshold (%)
        </label>
        <input
          v-model.number="localForm.thresholds.pass"
          type="number"
          min="0"
          max="100"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Partial Threshold (%)
        </label>
        <input
          v-model.number="localForm.thresholds.partial"
          type="number"
          min="0"
          max="100"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>
    </div>

    <!-- Auto Assignment -->
    <div>
      <label class="flex items-center mb-2">
        <input
          v-model="localForm.autoAssignment.enabled"
          type="checkbox"
          id="autoAssignment"
          class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
        />
        <span class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Auto Assignment</span>
      </label>
      <div v-if="localForm.autoAssignment.enabled" class="ml-6 mt-2">
        <select
          v-model="localForm.autoAssignment.linkTo"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option value="org">Organization</option>
          <option value="deal">Deal</option>
          <option value="task">Task</option>
          <option value="event">Event</option>
        </select>
      </div>
    </div>

    <!-- Workflow On Submit -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Workflow On Submit
      </label>
      <div class="space-y-2">
        <label class="flex items-center">
          <input
            v-model="localForm.workflowOnSubmit.createTask"
            type="checkbox"
            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Create Task</span>
        </label>
        <div v-if="localForm.workflowOnSubmit.createTask" class="ml-6 mt-2">
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Update Field</label>
          <select
            v-model="localForm.workflowOnSubmit.updateField"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option :value="null">None</option>
            <option value="status">Status</option>
            <option value="stage">Stage</option>
            <option value="custom">Custom Field</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Approval Workflow -->
    <div>
      <label class="flex items-center mb-2">
        <input
          v-model="localForm.approvalWorkflow.enabled"
          type="checkbox"
          id="approvalWorkflow"
          class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
        />
        <span class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Require Approval</span>
      </label>
      <div v-if="localForm.approvalWorkflow.enabled" class="ml-6 mt-2">
        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Approver</label>
        <select
          v-model="localForm.approvalWorkflow.approver"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option :value="null">Select Approver</option>
          <option v-for="user in users" :key="user._id" :value="user._id">
            {{ user.firstName }} {{ user.lastName }} ({{ user.email }})
          </option>
        </select>
      </div>
    </div>

    <!-- Assigned To -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Assigned To
      </label>
      <select
        v-model="localForm.assignedTo"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      >
        <option :value="null">Unassigned</option>
        <option v-for="user in users" :key="user._id" :value="user._id">
          {{ user.firstName }} {{ user.lastName }} ({{ user.email }})
        </option>
      </select>
    </div>

    <!-- Form Version -->
    <div v-if="localForm.formVersion">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Form Version
      </label>
      <input
        :value="localForm.formVersion"
        type="number"
        disabled
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
      />
    </div>

    <!-- Public Link -->
    <div v-if="localForm.publicLink?.enabled" class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Public Link
      </label>
      <div class="flex items-center gap-2">
        <input
          :value="localForm.publicLink.url"
          type="text"
          readonly
          class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <button
          @click="copyPublicLink"
          class="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium"
        >
          Copy
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

const users = ref([]);

// Initialize localForm with proper defaults
const initializeLocalForm = () => {
  const formData = props.form || {};
  return {
    ...formData,
    autoAssignment: formData.autoAssignment || { enabled: false, linkTo: 'org' },
    workflowOnSubmit: formData.workflowOnSubmit || { createTask: false, updateField: null, notify: [] },
    approvalWorkflow: formData.approvalWorkflow || { enabled: false, approver: null },
    thresholds: formData.thresholds || { pass: 80, partial: 50 }
  };
};

const localForm = ref(initializeLocalForm());
let isSyncing = false;
let lastEmittedForm = null;

const kpiMetrics = computed({
  get: () => localForm.value.kpiMetrics || [],
  set: (value) => {
    localForm.value.kpiMetrics = value;
  }
});

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

const fetchUsers = async () => {
  try {
    const response = await apiClient('/users?limit=100', {
      method: 'GET'
    });
    
    if (response.success) {
      users.value = Array.isArray(response.data) ? response.data : [];
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    users.value = [];
  }
};

onMounted(() => {
  fetchUsers();
});

const copyPublicLink = () => {
  if (localForm.value.publicLink?.url) {
    navigator.clipboard.writeText(localForm.value.publicLink.url);
    // You can add a toast notification here
    alert('Public link copied to clipboard!');
  }
};
</script>


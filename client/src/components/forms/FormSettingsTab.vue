<template>
  <div class="space-y-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.tabSettingsHeading') }}</h2>

    <!-- KPI Metrics -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.settingsKpiMetrics') }}
      </label>
      <div class="space-y-2">
        <label class="flex items-center">
          <HeadlessCheckbox
            :checked="isKpiMetricSelected('compliancePercentage')"
            checkbox-class="w-4 h-4"
            @change="toggleKpiMetric('compliancePercentage', $event.target.checked)"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ t('forms.settingsKpiCompliance') }}</span>
        </label>
        <label class="flex items-center">
          <HeadlessCheckbox
            :checked="isKpiMetricSelected('satisfactionPercentage')"
            checkbox-class="w-4 h-4"
            @change="toggleKpiMetric('satisfactionPercentage', $event.target.checked)"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ t('forms.settingsKpiSatisfaction') }}</span>
        </label>
        <label class="flex items-center">
          <HeadlessCheckbox
            :checked="isKpiMetricSelected('rating')"
            checkbox-class="w-4 h-4"
            @change="toggleKpiMetric('rating', $event.target.checked)"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ t('forms.settingsKpiAvgRating') }}</span>
        </label>
      </div>
    </div>

    <!-- Scoring Formula -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.settingsScoringFormula') }}
      </label>
      <input
        v-model="localForm.scoringFormula"
        type="text"
        :placeholder="t('forms.settingsScoringFormulaPh')"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {{ t('forms.settingsScoringFormulaHint') }}
      </p>
    </div>

    <!-- Thresholds -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.settingsPassThreshold') }}
        </label>
        <input
          v-model.number="localForm.thresholds.pass"
          type="number"
          min="0"
          max="100"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.settingsPartialThreshold') }}
        </label>
        <input
          v-model.number="localForm.thresholds.partial"
          type="number"
          min="0"
          max="100"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>
    </div>

    <!-- Auto Assignment -->
    <div>
      <label class="flex items-center mb-2">
        <HeadlessCheckbox
          v-model="localForm.autoAssignment.enabled"
          id="autoAssignment"
          checkbox-class="w-4 h-4"
        />
        <span class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.settingsAutoAssignment') }}</span>
      </label>
      <div v-if="localForm.autoAssignment.enabled" class="ml-6 mt-2">
        <select
          v-model="localForm.autoAssignment.linkTo"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="org">{{ t('forms.settingsLinkOrganization') }}</option>
          <option value="deal">{{ t('forms.settingsLinkDeal') }}</option>
          <option value="task">{{ t('forms.settingsLinkTask') }}</option>
          <option value="event">{{ t('forms.settingsLinkEvent') }}</option>
        </select>
      </div>
    </div>

    <!-- Workflow On Submit -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.settingsWorkflowOnSubmit') }}
      </label>
      <div class="space-y-2">
        <label class="flex items-center">
          <HeadlessCheckbox
            v-model="localForm.workflowOnSubmit.createTask"
            checkbox-class="w-4 h-4"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ t('forms.settingsCreateTask') }}</span>
        </label>
        <div v-if="localForm.workflowOnSubmit.createTask" class="ml-6 mt-2">
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.settingsUpdateField') }}</label>
          <select
            v-model="localForm.workflowOnSubmit.updateField"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option :value="null">{{ t('forms.settingsUpdateFieldNone') }}</option>
            <option value="status">{{ t('forms.settingsUpdateFieldStatus') }}</option>
            <option value="stage">{{ t('forms.settingsUpdateFieldStage') }}</option>
            <option value="custom">{{ t('forms.settingsUpdateFieldCustom') }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Approval Workflow -->
    <div>
      <label class="flex items-center mb-2">
        <HeadlessCheckbox
          v-model="localForm.approvalWorkflow.enabled"
          id="approvalWorkflow"
          checkbox-class="w-4 h-4"
        />
        <span class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.settingsRequireApproval') }}</span>
      </label>
      <div v-if="localForm.approvalWorkflow.enabled" class="ml-6 mt-2">
        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.settingsApprover') }}</label>
        <select
          v-model="localForm.approvalWorkflow.approver"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option :value="null">{{ t('forms.settingsSelectApprover') }}</option>
          <option v-for="user in users" :key="user._id" :value="user._id">
            {{ user.firstName }} {{ user.lastName }} ({{ user.email }})
          </option>
        </select>
      </div>
    </div>

    <!-- Assigned To -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.settingsAssignedTo') }}
      </label>
      <select
        v-model="localForm.assignedTo"
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      >
        <option :value="null">{{ t('records.editableUnassigned') }}</option>
        <option v-for="user in users" :key="user._id" :value="user._id">
          {{ user.firstName }} {{ user.lastName }} ({{ user.email }})
        </option>
      </select>
    </div>

    <!-- Form Version -->
    <div v-if="localForm.formVersion">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('forms.settingsFormVersion') }}
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
        {{ t('forms.settingsPublicLink') }}
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
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          {{ t('actions.copy') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

const users = ref([]);

// Initialize localForm with proper defaults
const normalizeKpiMetrics = (kpiMetrics) => {
  if (Array.isArray(kpiMetrics)) {
    return {
      compliancePercentage: kpiMetrics.includes('Compliance %'),
      satisfactionPercentage: kpiMetrics.includes('Satisfaction %'),
      rating: kpiMetrics.includes('Avg Rating') || kpiMetrics.includes('Rating'),
    };
  }
  return {
    compliancePercentage: false,
    satisfactionPercentage: false,
    rating: false,
    ...(kpiMetrics && typeof kpiMetrics === 'object' ? kpiMetrics : {}),
  };
};

const initializeLocalForm = () => {
  const formData = props.form || {};
  return {
    ...formData,
    kpiMetrics: normalizeKpiMetrics(formData.kpiMetrics),
    autoAssignment: formData.autoAssignment || { enabled: false, linkTo: 'org' },
    workflowOnSubmit: formData.workflowOnSubmit || { createTask: false, updateField: null, notify: [] },
    approvalWorkflow: formData.approvalWorkflow || { enabled: false, approver: null },
    thresholds: formData.thresholds || { pass: 80, partial: 50 }
  };
};

const localForm = ref(initializeLocalForm());
let isSyncing = false;
let lastEmittedForm = null;

const isKpiMetricSelected = (key) => Boolean(localForm.value.kpiMetrics?.[key]);

const toggleKpiMetric = (key, checked) => {
  if (!localForm.value.kpiMetrics) {
    localForm.value.kpiMetrics = {
      compliancePercentage: false,
      satisfactionPercentage: false,
      rating: false,
    };
  }
  localForm.value.kpiMetrics[key] = checked;
};

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
    alert(t('forms.settingsPublicLinkCopied'));
  }
};
</script>

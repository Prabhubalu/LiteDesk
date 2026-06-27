<template>
  <div class="space-y-8">
    <!-- Step 3 Header -->
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('forms.outcomesHeading') }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ t('forms.outcomesSubtitle') }}
      </p>
    </div>

    <!-- 1. Audit Result Rules (PRIMARY) -->
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
      <div class="mb-4">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">
          {{ t('forms.outcomesAuditRulesHeading') }}
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('forms.outcomesAuditRulesDesc') }}
        </p>
      </div>

      <div class="space-y-4">
        <label class="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            :value="'any_section_fails'"
            v-model="localOutcomes.auditResultRule"
            class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:ring-2"
          />
          <div class="flex-1">
            <span class="block text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.outcomesRuleAnySectionFails') }}
            </span>
            <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              {{ t('forms.outcomesRuleAnySectionFailsHint') }}
            </span>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            :value="'overall_score_below_threshold'"
            v-model="localOutcomes.auditResultRule"
            class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:ring-2"
          />
          <div class="flex-1">
            <span class="block text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.outcomesRuleOverallScore') }}
            </span>
            <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              {{ t('forms.outcomesRuleOverallScoreHint') }}
            </span>
          </div>
        </label>
      </div>

      <!-- Overall Score Calculation (Read-only) -->
      <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('forms.outcomesOverallScoreCalc') }}</p>
        <p class="text-sm text-gray-600 dark:text-gray-400 font-mono">
          {{ scoringFormulaDisplay }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
          {{ t('forms.outcomesOverallScoreCalcHint') }}
        </p>
      </div>
    </div>

    <!-- 2. Reporting Metrics -->
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
      <div class="mb-4">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">
          {{ t('forms.outcomesReportingHeading') }}
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('forms.outcomesReportingDesc') }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {{ t('forms.outcomesReportingTemplateHint') }}
        </p>
      </div>

      <div class="space-y-3">
        <label class="flex items-center gap-3 cursor-pointer">
          <HeadlessCheckbox
            v-model="localOutcomes.reportingMetrics.overallCompliance"
            checkbox-class="w-4 h-4"
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.outcomesMetricOverallCompliance') }}
            </span>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ t('forms.outcomesMetricOverallComplianceHint') }}
            </p>
          </div>
        </label>

        <label class="flex items-center gap-3 cursor-pointer">
          <HeadlessCheckbox
            v-model="localOutcomes.reportingMetrics.sectionWiseCompliance"
            checkbox-class="w-4 h-4"
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.outcomesMetricSectionWise') }}
            </span>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ t('forms.outcomesMetricSectionWiseHint') }}
            </p>
          </div>
        </label>

        <label class="flex items-center gap-3 cursor-pointer">
          <HeadlessCheckbox
            v-model="localOutcomes.reportingMetrics.evidenceCompletion"
            checkbox-class="w-4 h-4"
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.outcomesMetricEvidence') }}
            </span>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ t('forms.outcomesMetricEvidenceHint') }}
            </p>
          </div>
        </label>

        <label 
          v-if="hasRatingQuestions"
          class="flex items-center gap-3 cursor-pointer"
        >
          <HeadlessCheckbox
            v-model="localOutcomes.reportingMetrics.averageRating"
            checkbox-class="w-4 h-4"
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.settingsKpiAvgRating') }}
            </span>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ t('forms.outcomesMetricAvgRatingHint') }}
            </p>
          </div>
        </label>
      </div>
    </div>

    <!-- 3. Post-Submission Signals (Events) -->
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
      <div class="mb-4">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">
          {{ t('forms.outcomesPostSubmissionHeading') }}
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('forms.outcomesPostSubmissionDesc') }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {{ t('forms.outcomesPostSubmissionAutomationHint') }}
        </p>
      </div>

      <div class="space-y-3">
        <label class="flex items-center gap-3 cursor-pointer">
          <HeadlessCheckbox
            v-model="localOutcomes.postSubmissionSignals.emitOnAuditFail"
            checkbox-class="w-4 h-4"
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.outcomesEmitAuditFail') }}
            </span>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ t('forms.outcomesEmitAuditFailHint') }}
            </p>
          </div>
        </label>

        <label class="flex items-center gap-3 cursor-pointer">
          <HeadlessCheckbox
            v-model="localOutcomes.postSubmissionSignals.emitOnSectionFail"
            checkbox-class="w-4 h-4"
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.outcomesEmitSectionFail') }}
            </span>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ t('forms.outcomesEmitSectionFailHint') }}
            </p>
          </div>
        </label>

        <label class="flex items-center gap-3 cursor-pointer">
          <HeadlessCheckbox
            v-model="localOutcomes.postSubmissionSignals.emitOnCriticalQuestionFail"
            checkbox-class="w-4 h-4"
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.outcomesEmitCriticalFail') }}
            </span>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ t('forms.outcomesEmitCriticalFailHint') }}
            </p>
          </div>
        </label>

        <label class="flex items-center gap-3 cursor-pointer">
          <HeadlessCheckbox
            v-model="localOutcomes.postSubmissionSignals.emitOnMissingEvidence"
            checkbox-class="w-4 h-4"
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.outcomesEmitMissingEvidence') }}
            </span>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ t('forms.outcomesEmitMissingEvidenceHint') }}
            </p>
          </div>
        </label>
      </div>
    </div>

    <!-- 4. Governance (Read-Only) -->
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-700/30">
      <div class="mb-4">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">
          {{ t('forms.outcomesGovernanceHeading') }}
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('forms.outcomesGovernanceDesc') }}
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('forms.fieldFormType') }}
          </label>
          <input
            :value="formType"
            type="text"
            disabled
            class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 cursor-not-allowed"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('forms.settingsFormVersion') }}
          </label>
          <input
            :value="formVersion"
            type="text"
            disabled
            class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

// Initialize outcomes structure with defaults
const initializeOutcomes = () => {
  const formData = props.form || {};
  const existingOutcomes = formData.outcomesAndRules || {};
  
  return {
    auditResultRule: existingOutcomes.auditResultRule || 'any_section_fails',
    reportingMetrics: {
      overallCompliance: existingOutcomes.reportingMetrics?.overallCompliance ?? true,
      sectionWiseCompliance: existingOutcomes.reportingMetrics?.sectionWiseCompliance ?? true,
      evidenceCompletion: existingOutcomes.reportingMetrics?.evidenceCompletion ?? false,
      averageRating: existingOutcomes.reportingMetrics?.averageRating ?? false
    },
    postSubmissionSignals: {
      emitOnAuditFail: existingOutcomes.postSubmissionSignals?.emitOnAuditFail ?? false,
      emitOnSectionFail: existingOutcomes.postSubmissionSignals?.emitOnSectionFail ?? false,
      emitOnCriticalQuestionFail: existingOutcomes.postSubmissionSignals?.emitOnCriticalQuestionFail ?? false,
      emitOnMissingEvidence: existingOutcomes.postSubmissionSignals?.emitOnMissingEvidence ?? false
    }
  };
};

const localOutcomes = ref(initializeOutcomes());
let isSyncing = false;
let lastEmittedValue = null;
let lastFormId = null;

// Check if form has rating questions
const hasRatingQuestions = computed(() => {
  const sections = props.form?.sections || [];
  for (const section of sections) {
    // Check section-level questions
    const sectionQuestions = section.questions || [];
    if (sectionQuestions.some(q => q.type === 'Rating')) {
      return true;
    }
    
    // Check subsection-level questions
    const subsections = section.subsections || [];
    for (const subsection of subsections) {
      const subsectionQuestions = subsection.questions || [];
      if (subsectionQuestions.some(q => q.type === 'Rating')) {
        return true;
      }
    }
  }
  return false;
});

// Display scoring formula (read-only)
const scoringFormulaDisplay = computed(() => {
  const formula = props.form?.scoringFormula || '(Passed / Total) × 100';
  return formula;
});

// Form type and version (read-only)
const formType = computed(() => {
  return props.form?.formType || 'Audit';
});

const formVersion = computed(() => {
  return props.form?.formVersion || 1;
});

// Sync when form ID changes (new form loaded)
watch(() => props.form?._id, (newId) => {
  if (newId && newId !== lastFormId) {
    lastFormId = newId;
    isSyncing = true;
    localOutcomes.value = initializeOutcomes();
    lastEmittedValue = null;
    setTimeout(() => { isSyncing = false; }, 100);
  }
}, { immediate: true });

// Watch localOutcomes and emit updates
watch(() => localOutcomes.value, (newValue) => {
  if (!isSyncing) {
    const serialized = JSON.stringify(newValue);
    if (serialized !== lastEmittedValue) {
      lastEmittedValue = serialized;
      emit('update', {
        ...props.form,
        outcomesAndRules: JSON.parse(serialized)
      });
    }
  }
}, { deep: true });

// Initialize on mount
onMounted(() => {
  localOutcomes.value = initializeOutcomes();
});
</script>


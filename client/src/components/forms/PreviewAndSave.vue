<template>
  <div class="flex-1 flex flex-col min-h-0 p-6">
    <!-- Header -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('forms.previewSaveHeading') }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ engagementMode ? t('forms.engagementPreviewIntro') : t('forms.previewSaveIntro') }}
      </p>
    </div>

    <!-- 2-Column Layout -->
    <div class="flex-1 flex gap-6 min-h-0">
      <!-- Left Column: Tabbed Review Content (Scrollable) -->
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
        <!-- Tabs (audit only — engagement forms have a single preview) -->
        <div v-if="!engagementMode" class="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          <button
            @click="activeTab = 'execution'"
            class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
            :class="activeTab === 'execution' 
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' 
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
          >
            {{ t('forms.previewTabExecution') }}
          </button>
          <button
            @click="activeTab = 'outcome'"
            class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
            :class="activeTab === 'outcome' 
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' 
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
          >
            {{ t('forms.previewTabOutcome') }}
          </button>
        </div>

        <!-- Tab Content (Scrollable) -->
        <div class="flex-1 overflow-y-auto">
          <!-- Execution preview (default for engagement; tabbed for audit) -->
          <div v-if="engagementMode || activeTab === 'execution'" class="space-y-4">
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ t('forms.previewExecutionTitle') }}
                </h4>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {{ t('forms.previewExecutionIntro') }}
                </p>
              </div>
              <div class="p-6">
                <FormPreview
                  :form="form"
                  :read-only="true"
                  @close="() => {}"
                  @submit="() => {}"
                />
              </div>
            </div>
          </div>

          <!-- Outcome Tab -->
          <div v-if="activeTab === 'outcome'" class="space-y-4">
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ t('forms.previewOutcomeTitle') }}
                </h4>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {{ t('forms.previewOutcomeIntro') }}
                </p>
              </div>
              <div class="p-6 space-y-6">
                <!-- Audit Result Rules (Audit forms only) -->
                <div v-if="isAuditForm" class="space-y-3">
                  <h5 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.previewAuditResultRules') }}</h5>
                  <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div class="flex items-start gap-3">
                      <div class="flex-1">
                        <span class="block text-sm font-medium text-gray-900 dark:text-white">
                          {{ auditResultRuleLabel }}
                        </span>
                        <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {{ auditResultRuleDescription }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Reporting Metrics -->
                <div v-if="isAuditForm" class="space-y-3">
                  <h5 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.previewReportingMetrics') }}</h5>
                  <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-2">
                    <div
                      v-for="metric in enabledMetrics"
                      :key="metric.key"
                      class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      <span>{{ metric.label }}</span>
                    </div>
                    <div v-if="enabledMetrics.length === 0" class="text-sm text-gray-500 dark:text-gray-400 italic">
                      {{ t('forms.previewNoMetricsEnabled') }}
                    </div>
                  </div>
                </div>

                <!-- Report Template Preview -->
                <div class="space-y-3">
                  <h5 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.previewReportTemplate') }}</h5>
                  <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div class="mb-3">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ t('forms.previewActiveTemplate', { name: activeTemplateName }) }}
                      </span>
                    </div>
                    <div class="space-y-3 mt-4">
                      <div
                        v-for="(block, index) in reportBlocks"
                        :key="block.id || index"
                        class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                      >
                        <ReportBlockPreview :block="block" />
                      </div>
                      <div v-if="reportBlocks.length === 0" class="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">
                        {{ t('forms.previewNoBlocksInTemplate') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Final Readiness Check (Sticky) -->
      <div class="w-96 flex-shrink-0">
        <div class="sticky top-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <h4 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('forms.previewReadinessTitle') }}
            </h4>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {{ t('forms.previewReadinessIntro') }}
            </p>
          </div>
          <div class="p-6 max-h-[calc(100vh-var(--tabbar-offset)-300px)] overflow-y-auto">
            <div class="space-y-3">
              <!-- Checklist Items -->
              <div
                v-for="item in readinessChecklist"
                :key="item.key"
                class="flex items-start gap-3"
              >
                <div class="flex-shrink-0 mt-0.5">
                  <svg
                    v-if="item.status === 'complete'"
                    class="w-5 h-5 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <svg
                    v-else
                    class="w-5 h-5 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="flex-1">
                  <span
                    class="block text-sm font-medium"
                    :class="item.status === 'complete' ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'"
                  >
                    {{ item.label }}
                  </span>
                  <span
                    v-if="item.message"
                    class="block text-xs mt-1"
                    :class="item.status === 'complete' ? 'text-gray-500 dark:text-gray-400' : 'text-red-500 dark:text-red-400'"
                  >
                    {{ item.message }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Validation Messages -->
            <div v-if="validationErrors.length > 0" class="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h5 class="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                {{ t('forms.previewFixIssuesHeading') }}
              </h5>
              <ul class="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-400">
                <li v-for="error in validationErrors" :key="error">{{ error }}</li>
              </ul>
            </div>

            <!-- Success Message -->
            <div v-else-if="isReady" class="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                <span class="text-sm font-medium text-green-800 dark:text-green-300">
                  {{ t('forms.previewFormReadySaved') }}
                </span>
              </div>
              <p class="text-xs text-green-700 dark:text-green-400 mt-2">
                {{ engagementMode ? t('forms.engagementPreviewReadyDesc') : t('forms.previewFormSavedNotLiveYet') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import FormPreview from './FormPreview.vue';
import ReportBlockPreview from './report-blocks/ReportBlockPreview.vue';

const { t } = useI18n();

const props = defineProps({
  form: {
    type: Object,
    required: true
  },
  engagementMode: {
    type: Boolean,
    default: false
  }
});

// Active tab state (default: execution)
const activeTab = ref('execution');

const isAuditForm = computed(() => {
  const formType = (props.form?.formType || 'audit').toLowerCase();
  return formType === 'audit';
});

// Audit Result Rule Display
const auditResultRule = computed(() => {
  return props.form?.outcomesAndRules?.auditResultRule || 'any_section_fails';
});

const auditResultRuleLabel = computed(() => {
  const rules = {
    any_section_fails: t('forms.previewAuditFailAnySection'),
    overall_score_below_threshold: t('forms.previewAuditOverallScoreOnly')
  };
  return rules[auditResultRule.value] || auditResultRule.value;
});

const auditResultRuleDescription = computed(() => {
  const descriptions = {
    any_section_fails: t('forms.previewAuditFailAnySectionDesc'),
    overall_score_below_threshold: t('forms.previewAuditOverallScoreOnlyDesc')
  };
  return descriptions[auditResultRule.value] || '';
});

// Reporting Metrics
const reportingMetrics = computed(() => {
  return props.form?.outcomesAndRules?.reportingMetrics || {
    overallCompliance: true,
    sectionWiseCompliance: true,
    evidenceCompletion: false,
    averageRating: false
  };
});

const enabledMetrics = computed(() => {
  const metrics = [
    { key: 'overallCompliance', label: t('forms.previewMetricOverallCompliance') },
    { key: 'sectionWiseCompliance', label: t('forms.previewMetricSectionWise') },
    { key: 'evidenceCompletion', label: t('forms.previewMetricEvidenceCompletion') },
    { key: 'averageRating', label: t('forms.previewMetricAverageRating') }
  ];
  return metrics.filter((m) => reportingMetrics.value[m.key]);
});

// Report Template
// If no template is configured, use default template structure
const defaultTemplateBlocks = [
  {
    id: 'default_heading',
    type: 'heading',
    content: t('forms.previewDefaultReportHeading'),
    level: 1
  },
  {
    id: 'default_summary',
    type: 'audit_summary',
    showOverallScore: true,
    showResult: true
  },
  {
    id: 'default_section_results',
    type: 'section_results',
    showCompliancePercentage: true
  }
];

const activeTemplate = computed(() => {
  const templates = props.form?.responseTemplate?.templates || [];
  const activeId = props.form?.responseTemplate?.activeTemplateId;
  
  if (activeId) {
    return templates.find(t => t.id === activeId) || templates[0] || null;
  }
  
  return templates[0] || null;
});

const activeTemplateName = computed(() => {
  if (activeTemplate.value) {
    return activeTemplate.value.name || t('forms.previewDefaultTemplateName');
  }
  return t('forms.previewDefaultTemplateName');
});

const reportBlocks = computed(() => {
  // If a template is configured, use its blocks
  if (activeTemplate.value && activeTemplate.value.blocks) {
    return activeTemplate.value.blocks;
  }
  // Otherwise, show default template blocks
  return defaultTemplateBlocks;
});

// Readiness Checklist
const readinessChecklist = computed(() => {
  const checklist = [];
  
  // Sections & Questions
  const sections = props.form?.sections || [];
  const visibleSections = sections.filter(s => !s._isRootSection);
  
  // For flat mode (Survey/Feedback), check for root questions
  let hasContent = false;
  if (!isAuditForm.value) {
    const rootSection = sections.find(s => s._isRootSection);
    if (rootSection && rootSection.subsections && rootSection.subsections.length > 0) {
      const rootQuestions = rootSection.subsections[0].questions || [];
      hasContent = rootQuestions.length > 0 || visibleSections.length > 0;
    } else {
      hasContent = visibleSections.length > 0;
    }
  } else {
    hasContent = visibleSections.length > 0;
  }
  
  checklist.push({
    key: 'sections',
    label: t('forms.previewChecklistSections'),
    status: hasContent ? 'complete' : 'incomplete',
    message: hasContent
      ? (isAuditForm.value
          ? t('forms.previewChecklistSectionsOkAudit', { count: visibleSections.length })
          : t('forms.previewChecklistSectionsOkSurvey'))
      : t('forms.previewChecklistSectionsMissing')
  });
  
  // Scoring (Audit only)
  if (isAuditForm.value) {
    const hasScoring = checkScoringConfiguration();
    checklist.push({
      key: 'scoring',
      label: t('forms.previewChecklistScoring'),
      status: hasScoring ? 'complete' : 'incomplete',
      message: hasScoring ? t('forms.previewChecklistScoringOk') : t('forms.previewChecklistScoringMissing')
    });
  }
  
  // Outcome Rule (Audit only)
  if (isAuditForm.value) {
    const hasOutcomeRule = !!props.form?.outcomesAndRules?.auditResultRule;
    checklist.push({
      key: 'outcomeRule',
      label: t('forms.previewChecklistOutcome'),
      status: hasOutcomeRule ? 'complete' : 'incomplete',
      message: hasOutcomeRule ? auditResultRuleLabel.value : t('forms.previewChecklistOutcomeMissing')
    });
  }
  
  // Response Template (Audit only)
  if (!props.engagementMode) {
    const hasTemplate = activeTemplate.value !== null;
    const templateName = hasTemplate ? activeTemplateName.value : t('forms.previewDefaultTemplateName');
    checklist.push({
      key: 'template',
      label: t('forms.previewChecklistTemplate'),
      status: 'complete',
      message: t('forms.previewChecklistUsingTemplate', {
        name: templateName,
        suffix: !hasTemplate ? t('forms.previewChecklistTemplateDefaultSuffix') : ''
      })
    });
  } else {
    const isPublic = props.form?.visibility === 'Public' || props.form?.publicLink?.enabled;
    checklist.push({
      key: 'distribution',
      label: t('forms.engagementPreviewChecklistDistribution'),
      status: isPublic ? 'complete' : 'incomplete',
      message: isPublic
        ? t('forms.engagementPreviewChecklistDistributionOk')
        : t('forms.engagementPreviewChecklistDistributionMissing')
    });

    if (props.form?.kpiMetrics?.rating || props.form?.kpiMetrics?.satisfactionPercentage) {
      checklist.push({
        key: 'analytics',
        label: t('forms.engagementPreviewChecklistAnalytics'),
        status: 'complete',
        message: t('forms.engagementPreviewChecklistAnalyticsOk')
      });
    }
  }
  
  return checklist;
});

// Check scoring configuration for audit forms
const checkScoringConfiguration = () => {
  const sections = props.form?.sections || [];
  const visibleSections = sections.filter(s => !s._isRootSection);
  
  if (visibleSections.length === 0) return false;
  
  const scorableTypes = ['Yes-No', 'Dropdown', 'Rating', 'Number'];
  
  for (const section of visibleSections) {
    let sectionHasScorableQuestion = false;
    
    // Check section-level questions
    const sectionQuestions = section.questions || [];
    for (const question of sectionQuestions) {
      if (scorableTypes.includes(question.type)) {
        sectionHasScorableQuestion = true;
        
        if (!question.scoring || !question.scoring.weight || question.scoring.weight < 1) {
          return false;
        }
        
        const passCondition = question.scoring.passCondition || {};
        if (!hasValidPassCondition(question, passCondition)) {
          return false;
        }
      }
    }
    
    // Check subsection-level questions
    const subsections = section.subsections || [];
    for (const subsection of subsections) {
      const subsectionQuestions = subsection.questions || [];
      for (const question of subsectionQuestions) {
        if (scorableTypes.includes(question.type)) {
          sectionHasScorableQuestion = true;
          
          if (!question.scoring || !question.scoring.weight || question.scoring.weight < 1) {
            return false;
          }
          
          const passCondition = question.scoring.passCondition || {};
          if (!hasValidPassCondition(question, passCondition)) {
            return false;
          }
        }
      }
    }
    
    if (!sectionHasScorableQuestion) {
      return false;
    }
  }
  
  return true;
};

const hasValidPassCondition = (question, passCondition) => {
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

// Validation Errors
const validationErrors = computed(() => {
  const errors = [];
  
  const checklist = readinessChecklist.value;
  for (const item of checklist) {
    if (item.status === 'incomplete') {
      errors.push(item.message || item.label);
    }
  }
  
  return errors;
});

// Is Ready
const isReady = computed(() => {
  return validationErrors.value.length === 0;
});

// Expose validation state to parent
defineExpose({
  isReady,
  validationErrors
});
</script>


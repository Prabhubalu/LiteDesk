<template>
  <div
    @click="$emit('select')"
    class="group relative bg-white dark:bg-gray-800 border-2 rounded-lg p-4 cursor-pointer transition-all"
    :class="
      isSelected
        ? 'border-indigo-500 shadow-lg ring-2 ring-indigo-200 dark:ring-indigo-900'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
    "
  >
    <!-- Lock Icon for Mandatory Blocks -->
    <div v-if="block.mandatory || block.locked" class="absolute top-2 left-2">
      <div class="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded" :title="t('forms.rbpCoreBlockTitle')">
        <LockClosedIcon class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
      </div>
    </div>

    <!-- Block Actions -->
    <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        v-if="index > 0 && !isCoreBlockRestricted('up')"
        @click.stop="$emit('move-up')"
        class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        :title="t('forms.rbpMoveUp')"
      >
        <ChevronUpIcon class="w-4 h-4" />
      </button>
      <button
        v-if="index < maxIndex && !isCoreBlockRestricted('down')"
        @click.stop="$emit('move-down')"
        class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        :title="t('forms.rbpMoveDown')"
      >
        <ChevronDownIcon class="w-4 h-4" />
      </button>
      <button
        v-if="!block.mandatory"
        @click.stop="$emit('delete')"
        class="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
        :title="t('actions.delete')"
      >
        <TrashIcon class="w-4 h-4" />
      </button>
    </div>

    <!-- Block Content Preview -->
    <div class="pr-20">
      <!-- Heading Block -->
      <div v-if="block.type === 'heading'" class="space-y-1">
        <component
          :is="`h${block.level || 1}`"
          class="font-bold text-gray-900 dark:text-white"
          :class="{
            'text-2xl': block.level === 1,
            'text-xl': block.level === 2,
            'text-lg': block.level === 3
          }"
        >
          {{ block.content || t('forms.rtDefaultHeadingContent') }}
        </component>
      </div>

      <!-- Text Block -->
      <div v-else-if="block.type === 'text'" class="text-gray-700 dark:text-gray-300">
        {{ block.content || t('forms.rtDefaultTextContent') }}
      </div>

      <!-- Divider Block -->
      <div v-else-if="block.type === 'divider'" class="border-t border-gray-300 dark:border-gray-600 my-2"></div>

      <!-- Report Identity Block (Core) -->
      <div v-else-if="block.type === 'report_identity'" class="space-y-2">
        <div class="flex items-center gap-2">
          <DocumentCheckIcon class="w-5 h-5 text-indigo-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeReportIdentity') }}</span>
          <span class="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{{ t('forms.rbpCoreSuffix') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          <span v-if="block.config?.showAuditId">{{ t('forms.rbpSampleAuditId') }}</span>
          <span v-if="block.config?.showDates" class="ml-2">{{ t('forms.rbpSampleDates') }}</span>
          <span v-if="block.config?.showRound" class="ml-2">{{ t('forms.rbpSampleRound') }}</span>
        </div>
      </div>

      <!-- Overall Performance Block (Core) -->
      <div v-else-if="block.type === 'overall_performance'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ChartBarIcon class="w-5 h-5 text-indigo-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeOverallPerformance') }}</span>
          <span class="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{{ t('forms.rbpCoreSuffix') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          <span v-if="block.config?.showScore">{{ t('forms.rbpSampleScore') }}</span>
          <span v-if="block.config?.showRating" class="ml-2">{{ t('forms.rbpSampleRating') }}</span>
          <span v-if="block.config?.showBenchmark" class="ml-2">{{ t('forms.rbpSampleBenchmark') }}</span>
        </div>
      </div>

      <!-- Section Breakdown Block (Core) -->
      <div v-else-if="block.type === 'section_breakdown'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ClipboardDocumentListIcon class="w-5 h-5 text-indigo-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeSectionBreakdown') }}</span>
          <span class="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{{ t('forms.rbpCoreSuffix') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.rbpSectionBreakdownDesc') }}
          <span v-if="block.config?.showPassFailCounts">{{ t('forms.rbpWithPassFailCounts') }}</span>
        </div>
      </div>

      <!-- Audit Summary Block (Legacy) -->
      <div v-else-if="block.type === 'audit_summary'" class="space-y-2">
        <div class="flex items-center gap-2">
          <DocumentCheckIcon class="w-5 h-5 text-indigo-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeAuditSummary') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          <span v-if="block.showOverallScore">{{ t('forms.rbpSampleOverallScore') }}</span>
          <span v-if="block.showResult" class="ml-2">{{ t('forms.rbpSampleResultPass') }}</span>
        </div>
      </div>

      <!-- Overall Score Block -->
      <div v-else-if="block.type === 'overall_score'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ChartBarIcon class="w-5 h-5 text-indigo-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeOverallScore') }}</span>
        </div>
        <div class="text-lg font-bold text-indigo-600 dark:text-indigo-400">{{ t('forms.rbpSampleScorePercent') }}</div>
      </div>

      <!-- Section Results Block -->
      <div v-else-if="block.type === 'section_results'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ClipboardDocumentListIcon class="w-5 h-5 text-indigo-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeSectionResults') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.rbpSectionResultsDesc') }}</div>
      </div>

      <!-- Failed Questions Block -->
      <div v-else-if="block.type === 'failed_questions'" class="space-y-2">
        <div class="flex items-center gap-2">
          <XCircleIcon class="w-5 h-5 text-red-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeFailedQuestions') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.rbpFailedQuestionsDesc') }}</div>
      </div>

      <!-- Evidence Gallery Block -->
      <div v-else-if="block.type === 'evidence_gallery'" class="space-y-2">
        <div class="flex items-center gap-2">
          <PhotoIcon class="w-5 h-5 text-indigo-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeEvidenceGallery') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.rbpEvidenceGalleryDesc') }}</div>
      </div>

      <!-- Corrective Actions Block -->
      <div v-else-if="block.type === 'corrective_actions'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ArrowPathIcon class="w-5 h-5 text-blue-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeCorrectiveActions') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.rbpCorrectiveActionsDesc') }}</div>
      </div>

      <!-- Comparison Block -->
      <div v-else-if="block.type === 'comparison'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ArrowTrendingUpIcon class="w-5 h-5 text-blue-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeComparison') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.rbpComparisonDesc') }}</div>
      </div>

      <!-- Trend Block -->
      <div v-else-if="block.type === 'trend'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ChartBarIcon class="w-5 h-5 text-blue-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeTrend') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.rbpTrendDesc') }}</div>
      </div>

      <!-- Narrative Summary Block (INSIGHTS) -->
      <div v-else-if="block.type === 'narrative_summary'" class="space-y-2">
        <div class="flex items-center gap-2">
          <DocumentTextIcon class="w-5 h-5 text-indigo-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rtBlockNarrativeSummary') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.rbpNarrativeDesc') }}
          <span v-if="block.config?.includeScoreContext">{{ t('forms.rbpIncludesScoreContext') }}</span>
          <span v-if="block.config?.includeTopAreas">{{ t('forms.rbpMentionsTopAreas') }}</span>
        </div>
      </div>

      <!-- Top & Bottom Areas Block (INSIGHTS) -->
      <div v-else-if="block.type === 'top_bottom_areas'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ChartBarIcon class="w-5 h-5 text-indigo-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rtBlockTopBottom') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.rbpTopBottomDesc', { top: block.config?.topCount || 5, bottom: block.config?.bottomCount || 5 }) }}
          <span v-if="block.config?.layout">{{ t('forms.rbpLayoutSuffix', { layout: block.config.layout }) }}</span>
        </div>
      </div>

      <!-- Non-Compliance Summary Block (INSIGHTS) -->
      <div v-else-if="block.type === 'non_compliance_summary'" class="space-y-2">
        <div class="flex items-center gap-2">
          <XCircleIcon class="w-5 h-5 text-red-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rtBlockNonCompliance') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.rbpNonComplianceBy', {
            groupBy: block.config?.showByDepartment
              ? t('forms.rbpGroupByDepartment')
              : t('forms.rbpGroupByCategory')
          }) }}
          <span v-if="block.config?.showPreviousComparison">{{ t('forms.rbpWithPreviousComparison') }}</span>
        </div>
      </div>

      <!-- Performance Trends Block (TRENDS) -->
      <div v-else-if="block.type === 'performance_trends'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ArrowTrendingUpIcon class="w-5 h-5 text-blue-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rtBlockPerformanceTrends') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.rbpPerformanceTrendsDesc', { count: block.config?.periodCount || 5 }) }}
          <span v-if="block.config?.chartType">{{ t('forms.rbpChartSuffix', { chartType: block.config.chartType }) }}</span>
          <span v-if="block.config?.metrics">{{ t('forms.rbpMetricsSuffix', { metrics: block.config.metrics.join(', ') }) }}</span>
        </div>
      </div>

      <!-- Detailed Findings Block (DETAILS) -->
      <div v-else-if="block.type === 'detailed_findings'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ClipboardDocumentListIcon class="w-5 h-5 text-purple-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rtBlockDetailedFindings') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.rbpDetailedFindingsDesc') }}
          <span v-if="block.config?.showOnlyFailed">{{ t('forms.rbpFailedOnlySuffix') }}</span>
          <span v-if="block.config?.showEvidence">{{ t('forms.rbpWithEvidenceSuffix') }}</span>
          <span v-if="block.config?.showComments">{{ t('forms.rbpWithCommentsSuffix') }}</span>
        </div>
      </div>

      <!-- Action Items Summary Block (DETAILS) -->
      <div v-else-if="block.type === 'action_items_summary'" class="space-y-2">
        <div class="flex items-center gap-2">
          <ArrowPathIcon class="w-5 h-5 text-purple-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rtBlockActionItems') }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.rbpActionItemsDesc') }}
          <span v-if="block.config?.showStatus">{{ t('forms.rbpWithStatusSuffix') }}</span>
          <span v-if="block.config?.showDates">{{ t('forms.rbpWithDatesSuffix') }}</span>
          <span v-if="block.config?.showFromPreviousAudits">{{ t('forms.rbpFromPreviousAuditsSuffix') }}</span>
        </div>
      </div>

      <!-- Chart Blocks -->
      <div v-else-if="['line_chart', 'bar_chart', 'pie_chart'].includes(block.type)" class="space-y-2">
        <div class="flex items-center gap-2">
          <ChartBarIcon v-if="block.type === 'line_chart' || block.type === 'bar_chart'" class="w-5 h-5 text-green-500" />
          <ChartPieIcon v-else class="w-5 h-5 text-green-500" />
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ block.title || chartBlockTypeLabel(block.type) }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.rbpMetricLabel', { metric: block.metric || t('forms.rbpMetricNa') }) }}
        </div>
      </div>

      <!-- Unknown Block Type -->
      <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic">
        {{ t('forms.rbpUnknownBlockType', { type: block.type }) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  TrashIcon,
  LockClosedIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ChartPieIcon,
  PhotoIcon,
  XCircleIcon,
  ClipboardDocumentListIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

const props = defineProps({
  block: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  maxIndex: {
    type: Number,
    required: true
  }
});

defineEmits(['select', 'delete', 'move-up', 'move-down']);

const CHART_BLOCK_TYPE_KEYS = {
  line_chart: 'rbTypeLineChart',
  bar_chart: 'rbTypeBarChart',
  pie_chart: 'rbTypePieChart'
};

const chartBlockTypeLabel = (type) => {
  const key = CHART_BLOCK_TYPE_KEYS[type];
  return key ? t(`forms.${key}`) : type;
};

// Check if core block movement is restricted
const isCoreBlockRestricted = (direction) => {
  if (!props.block.mandatory) return false;

  // Core blocks (first 3) cannot move out of their positions
  if (direction === 'up' && props.index < 3) {
    return true; // Cannot move up if in first 3 positions
  }
  if (direction === 'down' && props.index < 2) {
    return true; // Cannot move down if in first 2 positions (would move out of core range)
  }

  return false;
};
</script>

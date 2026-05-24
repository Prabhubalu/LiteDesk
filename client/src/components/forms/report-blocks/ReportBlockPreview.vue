<template>
  <div class="space-y-1">
    <!-- Heading Block -->
    <div v-if="block.type === 'heading'">
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

    <!-- Audit Summary Block -->
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
      <div class="text-xs text-gray-500 dark:text-gray-400">
        <span v-if="block.showCompliancePercentage">{{ t('forms.rbpShowsComplianceBySection') }}</span>
        <span v-if="block.showFailedSections" class="ml-2">{{ t('forms.rbpIncludesFailedSections') }}</span>
      </div>
    </div>

    <!-- Failed Questions Block -->
    <div v-else-if="block.type === 'failed_questions'" class="space-y-2">
      <div class="flex items-center gap-2">
        <XCircleIcon class="w-5 h-5 text-red-500" />
        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeFailedQuestions') }}</span>
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('forms.rbpFailedQuestionsDesc') }}
        <span v-if="block.showSectionName">{{ t('forms.rbpWithSectionNames') }}</span>
        <span v-if="block.showEvidence">{{ t('forms.rbpWithEvidenceSuffix') }}</span>
      </div>
    </div>

    <!-- Evidence Gallery Block -->
    <div v-else-if="block.type === 'evidence_gallery'" class="space-y-2">
      <div class="flex items-center gap-2">
        <PhotoIcon class="w-5 h-5 text-indigo-500" />
        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeEvidenceGallery') }}</span>
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('forms.rbpEvidenceGalleryDesc') }}
        <span v-if="block.layout">{{ t('forms.rbpLayoutSuffix', { layout: block.layout }) }}</span>
        <span v-if="block.showThumbnails">{{ t('forms.rbpWithThumbnailsSuffix') }}</span>
      </div>
    </div>

    <!-- Corrective Actions Block -->
    <div v-else-if="block.type === 'corrective_actions'" class="space-y-2">
      <div class="flex items-center gap-2">
        <ArrowPathIcon class="w-5 h-5 text-blue-500" />
        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeCorrectiveActions') }}</span>
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('forms.rbpCorrectiveActionsShortDesc') }}
        <span v-if="block.showStatus">{{ t('forms.rbpWithStatusSuffix') }}</span>
        <span v-if="block.showDates">{{ t('forms.rbpWithDatesSuffix') }}</span>
      </div>
    </div>

    <!-- Comparison Block -->
    <div v-else-if="block.type === 'comparison'" class="space-y-2">
      <div class="flex items-center gap-2">
        <ArrowTrendingUpIcon class="w-5 h-5 text-blue-500" />
        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeComparison') }}</span>
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('forms.rbpComparisonDesc') }}
        <span v-if="block.metrics">{{ t('forms.rbpMetricsInline', { metrics: block.metrics.join(', ') }) }}</span>
        <span v-if="block.period">{{ t('forms.rbpPeriodInline', { period: block.period }) }}</span>
      </div>
    </div>

    <!-- Trend Block -->
    <div v-else-if="block.type === 'trend'" class="space-y-2">
      <div class="flex items-center gap-2">
        <ChartBarIcon class="w-5 h-5 text-blue-500" />
        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.rbTypeTrend') }}</span>
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('forms.rbpTrendAuditsCount', { count: block.periodCount || 5 }) }}
        <span v-if="block.metrics">{{ t('forms.rbpMetricsInline', { metrics: block.metrics.join(', ') }) }}</span>
      </div>
    </div>

    <!-- Chart Blocks -->
    <div v-else-if="['line_chart', 'bar_chart', 'pie_chart'].includes(block.type)" class="space-y-2">
      <div class="flex items-center gap-2">
        <ChartBarIcon v-if="block.type === 'line_chart' || block.type === 'bar_chart'" class="w-5 h-5 text-green-500" />
        <ChartPieIcon v-else class="w-5 h-5 text-green-500" />
        <span class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ block.title || chartBlockTypeLabel(block.type) }}
        </span>
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
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import {
  DocumentCheckIcon,
  ChartBarIcon,
  ChartPieIcon,
  PhotoIcon,
  XCircleIcon,
  ClipboardDocumentListIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

defineProps({
  block: {
    type: Object,
    required: true
  }
});

const CHART_BLOCK_TYPE_KEYS = {
  line_chart: 'rbTypeLineChart',
  bar_chart: 'rbTypeBarChart',
  pie_chart: 'rbTypePieChart'
};

const chartBlockTypeLabel = (type) => {
  const key = CHART_BLOCK_TYPE_KEYS[type];
  return key ? t(`forms.${key}`) : type;
};
</script>

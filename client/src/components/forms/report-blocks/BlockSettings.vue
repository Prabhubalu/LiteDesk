<template>
  <div class="space-y-4">
    <!-- Block Type Display -->
    <div class="pb-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between mb-1">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {{ t('forms.rbBlockType') }}
      </p>
        <div v-if="block.mandatory || block.locked" class="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
          <LockClosedIcon class="w-4 h-4" />
          <span class="text-xs font-medium">{{ t('forms.rbCoreBlock') }}</span>
        </div>
      </div>
      <p class="text-sm font-semibold text-gray-900 dark:text-white capitalize">
        {{ blockTypeLabel }}
      </p>
      <p v-if="block.mandatory || block.locked" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {{ t('forms.rbCorePresentationOnly') }}
      </p>
    </div>

    <!-- Heading Settings -->
    <div v-if="block.type === 'heading'" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbHeadingText') }}
        </label>
        <input
          v-model="localBlock.content"
          @input="emitUpdate"
          type="text"
          :placeholder="t('forms.rbHeadingTextPh')"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbLevel') }}
        </label>
        <select
          v-model="localBlock.level"
          @change="emitUpdate"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option :value="1">{{ t('forms.rbLevel1') }}</option>
          <option :value="2">{{ t('forms.rbLevel2') }}</option>
          <option :value="3">{{ t('forms.rbLevel3') }}</option>
        </select>
      </div>
    </div>

    <!-- Report Identity Settings (Core) -->
    <div v-else-if="block.type === 'report_identity'" class="space-y-4">
      <div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg mb-4">
        <p class="text-xs text-indigo-700 dark:text-indigo-300">
          <strong>{{ t('forms.rbLabelCoreBlock') }}</strong> {{ t('forms.rbCoreReportIdentityBody') }}
        </p>
        <p class="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
          <strong>{{ t('forms.rbLabelNote') }}</strong> {{ t('forms.rbBrandingNoteBody') }}
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbReportTitle') }}
        </label>
        <input
          v-model="localBlock.config.reportTitle"
          @input="emitUpdate"
          type="text"
          :placeholder="t('forms.previewDefaultReportHeading')"
          :disabled="block.locked && !canEditPresentation"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showAuditId"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowAuditId') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showDates"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowCheckInOutDates') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showRound"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowRoundNumber') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showAddress"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowAddress') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showGeneralManager"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowGeneralManager') }}</span>
        </label>
      </div>
    </div>

    <!-- Overall Performance Settings (Core) -->
    <div v-else-if="block.type === 'overall_performance'" class="space-y-4">
      <div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg mb-4">
        <p class="text-xs text-indigo-700 dark:text-indigo-300">
          <strong>{{ t('forms.rbLabelCoreBlock') }}</strong> {{ t('forms.rbCoreOverallPerformanceBody') }}
        </p>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showScore"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowOverallScore') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showRating"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowStarRating') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showBenchmark"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowBenchmarkComparison') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showScoreBreakdown"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowScoreBreakdown') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showClassification"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowRatingClassificationTable') }}</span>
        </label>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbChartType') }}
        </label>
        <select
          v-model="localBlock.config.chartType"
          @change="emitUpdate"
          :disabled="block.locked && !canEditPresentation"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="donut">{{ t('forms.rbChartDonut') }}</option>
          <option value="gauge">{{ t('forms.rbChartGauge') }}</option>
          <option value="bar">{{ t('forms.rbChartBar') }}</option>
          <option value="none">{{ t('forms.rbChartNone') }}</option>
        </select>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showPerformanceHistory"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowPerformanceHistoryChart') }}</span>
        </label>
      </div>
    </div>

    <!-- Section Breakdown Settings (Core) -->
    <div v-else-if="block.type === 'section_breakdown'" class="space-y-4">
      <div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg mb-4">
        <p class="text-xs text-indigo-700 dark:text-indigo-300">
          <strong>{{ t('forms.rbLabelCoreBlock') }}</strong> {{ t('forms.rbCoreSectionBreakdownBody') }}
        </p>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showCurrentScores"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowCurrentAuditScores') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showPreviousScores"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowPreviousAuditScores') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showChange"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowChangeIndicators') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showPassFailCounts"
            @change="emitUpdate"
            :disabled="block.locked && !canEditPresentation"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowPassFailCounts') }}</span>
        </label>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbSortBy') }}
        </label>
        <select
          v-model="localBlock.config.sortBy"
          @change="emitUpdate"
          :disabled="block.locked && !canEditPresentation"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="default">{{ t('forms.rbSortDefaultOrder') }}</option>
          <option value="score">{{ t('forms.rbSortScoreHighLow') }}</option>
          <option value="name">{{ t('forms.rbSortSectionName') }}</option>
          <option value="change">{{ t('forms.rbSortChangeAmount') }}</option>
        </select>
      </div>
    </div>

    <!-- Text Settings -->
    <div v-else-if="block.type === 'text'" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbTextContent') }}
        </label>
        <textarea
          v-model="localBlock.content"
          @input="emitUpdate"
          rows="4"
          :placeholder="t('forms.rbTextContentPh')"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        ></textarea>
      </div>
    </div>

    <!-- Audit Summary Settings -->
    <div v-else-if="block.type === 'audit_summary'" class="space-y-4">
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showOverallScore"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowOverallScore') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showResult"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowResultPassFail') }}</span>
        </label>
      </div>
    </div>

    <!-- Overall Score Settings -->
    <div v-else-if="block.type === 'overall_score'" class="space-y-4">
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showPercentage"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowPercentage') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showLabel"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowLabel') }}</span>
        </label>
      </div>
    </div>

    <!-- Section Results Settings -->
    <div v-else-if="block.type === 'section_results'" class="space-y-4">
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showCompliancePercentage"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowCompliancePercentage') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showFailedSections"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbHighlightFailedSections') }}</span>
        </label>
      </div>
    </div>

    <!-- Failed Questions Settings -->
    <div v-else-if="block.type === 'failed_questions'" class="space-y-4">
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showSectionName"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowSectionName') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showEvidence"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowEvidenceStatus') }}</span>
        </label>
      </div>
    </div>

    <!-- Evidence Gallery Settings -->
    <div v-else-if="block.type === 'evidence_gallery'" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbLayout') }}
        </label>
        <select
          v-model="localBlock.layout"
          @change="emitUpdate"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="grid">{{ t('forms.rbLayoutGrid') }}</option>
          <option value="list">{{ t('forms.rbLayoutList') }}</option>
        </select>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showThumbnails"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowThumbnails') }}</span>
        </label>
      </div>
    </div>

    <!-- Corrective Actions Settings -->
    <div v-else-if="block.type === 'corrective_actions'" class="space-y-4">
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showStatus"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowStatusFixedPending') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.showDates"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowDates') }}</span>
        </label>
      </div>
    </div>

    <!-- Comparison Block Settings -->
    <div v-else-if="block.type === 'comparison'" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbComparisonPeriod') }}
        </label>
        <select
          v-model="localBlock.period"
          @change="emitUpdate"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="previous">{{ t('forms.rbPeriodPreviousAudit') }}</option>
          <option value="last_3">{{ t('forms.rbPeriodLast3Audits') }}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbMetricsToCompare') }}
        </label>
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <HeadlessCheckbox
              :checked="localBlock.metrics?.includes('compliance')"
              @change="toggleMetric('compliance')"
              checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('forms.outcomesMetricOverallCompliance') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <HeadlessCheckbox
              :checked="localBlock.metrics?.includes('failedPoints')"
              @change="toggleMetric('failedPoints')"
              checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('forms.rbFailedPoints') }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Trend Block Settings -->
    <div v-else-if="block.type === 'trend'" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbNumberOfAudits') }}
        </label>
        <input
          v-model.number="localBlock.periodCount"
          @input="emitUpdate"
          type="number"
          min="3"
          max="10"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbMetrics') }}
        </label>
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <HeadlessCheckbox
              :checked="localBlock.metrics?.includes('compliance')"
              @change="toggleMetric('compliance')"
              checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('forms.outcomesMetricOverallCompliance') }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Chart Block Settings -->
    <div v-else-if="['line_chart', 'bar_chart', 'pie_chart'].includes(block.type)" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbChartTitle') }}
        </label>
        <input
          v-model="localBlock.title"
          @input="emitUpdate"
          type="text"
          :placeholder="t('forms.rbChartTitlePh')"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbDataSourceMetric') }}
        </label>
        <select
          v-model="localBlock.metric"
          @change="emitUpdate"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">{{ t('forms.rbSelectMetricPh') }}</option>
          <option v-if="metricsEnabled.overallCompliance" value="overallCompliance">{{ t('forms.outcomesMetricOverallCompliance') }}</option>
          <option v-if="metricsEnabled.sectionWiseCompliance" value="sectionWiseCompliance">{{ t('forms.outcomesMetricSectionWise') }}</option>
          <option v-if="metricsEnabled.evidenceCompletion" value="evidenceCompletion">{{ t('forms.outcomesMetricEvidence') }}</option>
          <option v-if="metricsEnabled.averageRating" value="averageRating">{{ t('forms.settingsKpiAvgRating') }}</option>
        </select>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ t('forms.rbMetricsStep3Hint') }}
        </p>
      </div>
    </div>

    <!-- Narrative Summary Settings (INSIGHTS) -->
    <div v-else-if="block.type === 'narrative_summary'" class="space-y-4">
      <div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg mb-4">
        <p class="text-xs text-indigo-700 dark:text-indigo-300">
          <strong>{{ t('forms.rbLabelNote') }}</strong> {{ t('forms.rbNarrativeNoteBody') }}
        </p>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.includeScoreContext"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbIncludeScoreContext') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.includeTopAreas"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbMentionTopAreas') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.includeBottomAreas"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbMentionBottomAreas') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.includeTrends"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbIncludeTrendInfo') }}</span>
        </label>
      </div>
    </div>

    <!-- Top & Bottom Areas Settings (INSIGHTS) -->
    <div v-else-if="block.type === 'top_bottom_areas'" class="space-y-4">
      <div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg mb-4">
        <p class="text-xs text-indigo-700 dark:text-indigo-300">
          <strong>{{ t('forms.rbLabelNote') }}</strong> {{ t('forms.rbTopBottomNoteBody') }}
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbTopAreasCount') }}
        </label>
        <input
          v-model.number="localBlock.config.topCount"
          @input="emitUpdate"
          type="number"
          min="1"
          max="10"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbBottomAreasCount') }}
        </label>
        <input
          v-model.number="localBlock.config.bottomCount"
          @input="emitUpdate"
          type="number"
          min="1"
          max="10"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showScores"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowScorePercentages') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showChange"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowChangeFromPrevious') }}</span>
        </label>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbLayout') }}
        </label>
        <select
          v-model="localBlock.config.layout"
          @change="emitUpdate"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="side_by_side">{{ t('forms.rbLayoutSideBySide') }}</option>
          <option value="stacked">{{ t('forms.rbLayoutStacked') }}</option>
          <option value="table">{{ t('forms.rbLayoutTable') }}</option>
        </select>
      </div>
    </div>

    <!-- Non-Compliance Summary Settings (INSIGHTS) -->
    <div v-else-if="block.type === 'non_compliance_summary'" class="space-y-4">
      <div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg mb-4">
        <p class="text-xs text-indigo-700 dark:text-indigo-300">
          <strong>{{ t('forms.rbLabelNote') }}</strong> {{ t('forms.rbNonComplianceNoteBody') }}
        </p>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showByDepartment"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbGroupByDepartment') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showByCategory"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbGroupByCategory') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showPreviousComparison"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbComparePreviousAudit') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showChange"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowChangeIndicators') }}</span>
        </label>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbSortBy') }}
        </label>
        <select
          v-model="localBlock.config.sortBy"
          @change="emitUpdate"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="count">{{ t('forms.rbSortNonComplianceCount') }}</option>
          <option value="department">{{ t('forms.rbSortDepartmentName') }}</option>
          <option value="change">{{ t('forms.rbSortChangeAmount') }}</option>
        </select>
      </div>
    </div>

    <!-- Performance Trends Settings (TRENDS) -->
    <div v-else-if="block.type === 'performance_trends'" class="space-y-4">
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
        <p class="text-xs text-blue-700 dark:text-blue-300">
          <strong>{{ t('forms.rbLabelNote') }}</strong> {{ t('forms.rbPerformanceTrendsNoteBody') }}
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbNumberOfAudits') }}
        </label>
        <input
          v-model.number="localBlock.config.periodCount"
          @input="emitUpdate"
          type="number"
          min="3"
          max="10"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbChartType') }}
        </label>
        <select
          v-model="localBlock.config.chartType"
          @change="emitUpdate"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="line">{{ t('forms.rbChartLine') }}</option>
          <option value="bar">{{ t('forms.rbChartBar') }}</option>
          <option value="area">{{ t('forms.rbChartArea') }}</option>
        </select>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showCurrentHighlight"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbHighlightCurrentAudit') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showAverage"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowAverageTrendLine') }}</span>
        </label>
      </div>
    </div>

    <!-- Detailed Findings Settings (DETAILS) -->
    <div v-else-if="block.type === 'detailed_findings'" class="space-y-4">
      <div class="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg mb-4">
        <p class="text-xs text-purple-700 dark:text-purple-300">
          <strong>{{ t('forms.rbLabelNote') }}</strong> {{ t('forms.rbDetailedFindingsNoteBody') }}
        </p>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showOnlyFailed"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowOnlyFailedQuestions') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showEvidence"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowEvidenceAttachments') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showComments"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowQuestionComments') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showScores"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowIndividualQuestionScores') }}</span>
        </label>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbSortBy') }}
        </label>
        <select
          v-model="localBlock.config.sortBy"
          @change="emitUpdate"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="section">{{ t('forms.rbSortSection') }}</option>
          <option value="score">{{ t('forms.rbSortScore') }}</option>
          <option value="questionId">{{ t('forms.rbSortQuestionId') }}</option>
        </select>
      </div>
    </div>

    <!-- Action Items Summary Settings (DETAILS) -->
    <div v-else-if="block.type === 'action_items_summary'" class="space-y-4">
      <div class="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg mb-4">
        <p class="text-xs text-purple-700 dark:text-purple-300">
          <strong>{{ t('forms.rbLabelNote') }}</strong> {{ t('forms.rbActionItemsNoteBody') }}
        </p>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showStatus"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowActionItemStatus') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showDates"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowCreationDueDates') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showAssignee"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbShowAssignedUser') }}</span>
        </label>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <HeadlessCheckbox
            v-model="localBlock.config.showFromPreviousAudits"
            @change="emitUpdate"
            checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rbIncludeItemsFromPreviousAudits') }}</span>
        </label>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbSortBy') }}
        </label>
        <select
          v-model="localBlock.config.sortBy"
          @change="emitUpdate"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="date">{{ t('forms.rbSortDate') }}</option>
          <option value="status">{{ t('forms.rbSortStatus') }}</option>
          <option value="priority">{{ t('forms.rbSortPriority') }}</option>
          <option value="department">{{ t('forms.rbSortDepartment') }}</option>
        </select>
      </div>
    </div>

    <!-- System-Driven Visibility Notice -->
    <div v-if="hasSystemVisibilityRule" class="pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div class="flex items-start gap-2">
          <LockClosedIcon class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p class="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
              {{ t('forms.rbSystemDrivenVisibility') }}
            </p>
            <p class="text-xs text-amber-700 dark:text-amber-400">
              {{ systemVisibilityDescription }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Conditional Visibility (for non-system blocks) -->
    <div v-else-if="supportsConditionalVisibility" class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.rbVisibilityRule') }}
        </label>
        <select
          v-model="localBlock.visibilityRule"
          @change="emitUpdate"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALWAYS">{{ t('forms.rbVisibilityAlways') }}</option>
          <option value="SHOW_IF_DATA_EXISTS">{{ t('forms.rbVisibilityShowIfData') }}</option>
          <option value="HIDE_IF_NO_COMPARISON">{{ t('forms.rbVisibilityHideNoComparison') }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LockClosedIcon } from '@heroicons/vue/24/outline';
import { hasSystemVisibilityRule as checkSystemRule, getSystemVisibilityRule } from '../../../utils/blockVisibility';

const { t } = useI18n();

const BLOCK_TYPE_I18N_KEYS = {
  heading: 'rtBlockHeading',
  text: 'rtBlockText',
  divider: 'rtBlockDivider',
  report_identity: 'rbTypeReportIdentity',
  overall_performance: 'rbTypeOverallPerformance',
  section_breakdown: 'rbTypeSectionBreakdown',
  audit_summary: 'rbTypeAuditSummary',
  overall_score: 'rbTypeOverallScore',
  section_results: 'rbTypeSectionResults',
  failed_questions: 'rbTypeFailedQuestions',
  evidence_gallery: 'rbTypeEvidenceGallery',
  corrective_actions: 'rbTypeCorrectiveActions',
  comparison: 'rbTypeComparison',
  trend: 'rbTypeTrend',
  narrative_summary: 'rtBlockNarrativeSummary',
  top_bottom_areas: 'rtBlockTopBottom',
  non_compliance_summary: 'rtBlockNonCompliance',
  performance_trends: 'rtBlockPerformanceTrends',
  detailed_findings: 'rtBlockDetailedFindings',
  action_items_summary: 'rtBlockActionItems',
  line_chart: 'rbTypeLineChart',
  bar_chart: 'rbTypeBarChart',
  pie_chart: 'rbTypePieChart'
};

const VISIBILITY_RULE_I18N_KEYS = {
  HIDE_IF_NO_HISTORY: 'rbVisibilityHideNoHistory',
  HIDE_IF_NO_NON_COMPLIANCE: 'rbVisibilityHideNoNonCompliance',
  HIDE_IF_NO_QUESTIONS: 'rbVisibilityHideNoQuestions',
  HIDE_IF_NO_ACTION_ITEMS: 'rbVisibilityHideNoActionItems'
};

const props = defineProps({
  block: {
    type: Object,
    required: true
  },
  metricsEnabled: {
    type: Object,
    default: () => ({
      overallCompliance: true,
      sectionWiseCompliance: true,
      evidenceCompletion: false,
      averageRating: false
    })
  }
});

const emit = defineEmits(['update']);

// Initialize localBlock with proper config structure
const initializeLocalBlock = () => {
  const block = { ...props.block };
  // Ensure config exists for blocks that use config structure
  const blocksWithConfig = [
    'report_identity', 'overall_performance', 'section_breakdown',
    'narrative_summary', 'top_bottom_areas', 'non_compliance_summary',
    'performance_trends', 'detailed_findings', 'action_items_summary'
  ];
  if (blocksWithConfig.includes(block.type)) {
    if (!block.config) {
      block.config = {};
    }
  }
  return block;
};

const localBlock = ref(initializeLocalBlock());

// For locked blocks, only presentation settings can be edited
const canEditPresentation = computed(() => {
  // Locked blocks can still edit presentation settings (show/hide checkboxes, etc.)
  return true;
});

const hasSystemVisibilityRule = computed(() => {
  return checkSystemRule(props.block.type);
});

const blockTypeLabel = computed(() => {
  const key = BLOCK_TYPE_I18N_KEYS[props.block.type];
  return key ? t(`forms.${key}`) : props.block.type.replace(/_/g, ' ');
});

const systemVisibilityDescription = computed(() => {
  const rule = getSystemVisibilityRule(props.block.type);
  const key = VISIBILITY_RULE_I18N_KEYS[rule];
  return key ? t(`forms.${key}`) : t('forms.rbVisibilityDefault');
});

const supportsConditionalVisibility = computed(() => {
  // Only show user visibility rules for blocks that don't have system rules
  return !hasSystemVisibilityRule.value && ['comparison', 'trend', 'corrective_actions'].includes(props.block.type);
});

const toggleMetric = (metric) => {
  if (!localBlock.value.metrics) {
    localBlock.value.metrics = [];
  }
  const index = localBlock.value.metrics.indexOf(metric);
  if (index > -1) {
    localBlock.value.metrics.splice(index, 1);
  } else {
    localBlock.value.metrics.push(metric);
  }
  emitUpdate();
};

const emitUpdate = () => {
  // Ensure config structure is preserved for blocks that use config
  const updatedBlock = { ...localBlock.value };
  const blocksWithConfig = [
    'report_identity', 'overall_performance', 'section_breakdown',
    'narrative_summary', 'top_bottom_areas', 'non_compliance_summary',
    'performance_trends', 'detailed_findings', 'action_items_summary'
  ];
  if (blocksWithConfig.includes(updatedBlock.type)) {
    if (!updatedBlock.config) {
      updatedBlock.config = {};
    }
  }
  emit('update', updatedBlock);
};

watch(() => props.block, (newBlock) => {
  const updatedBlock = { ...newBlock };
  // Ensure config exists for blocks that use config structure
  const blocksWithConfig = [
    'report_identity', 'overall_performance', 'section_breakdown',
    'narrative_summary', 'top_bottom_areas', 'non_compliance_summary',
    'performance_trends', 'detailed_findings', 'action_items_summary'
  ];
  if (blocksWithConfig.includes(updatedBlock.type)) {
    if (!updatedBlock.config) {
      updatedBlock.config = {};
    }
  }
  localBlock.value = updatedBlock;
}, { deep: true });
</script>


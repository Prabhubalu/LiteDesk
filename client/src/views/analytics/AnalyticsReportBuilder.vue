<template>
  <div :class="rbPage">
    <header :class="rbHeader">
      <div class="mx-auto max-w-[1600px] px-4 py-2 lg:px-8">
        <div class="flex items-center justify-between gap-3">
          <nav class="flex min-w-0 items-center gap-1.5 text-xs">
            <button type="button" :class="rbBtnGhost" class="!px-1.5 !py-1" @click="goBack">
              {{ t('analytics.listTitle') }}
            </button>
            <ChevronRightIcon class="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
            <span class="truncate font-medium text-zinc-900 dark:text-zinc-100">
              {{ form.name.trim() || (isNew ? t('analytics.builderCreateNewReport') : t('analytics.builderEditTitle')) }}
            </span>
            <template v-if="currentStep > 0">
              <span class="text-zinc-300 dark:text-zinc-600">·</span>
              <span class="truncate text-zinc-500 dark:text-zinc-400">{{ primaryModuleLabel }}</span>
              <button type="button" :class="[rbLink, '!text-xs']" @click="goToStep(0)">
                {{ t('analytics.builderChangeModule') }}
              </button>
            </template>
          </nav>

          <div class="flex shrink-0 items-center gap-1.5">
            <button
              v-if="currentStep > 0"
              type="button"
              :class="rbBtnSecondary"
              class="!px-2.5 !py-1.5 !text-xs"
              @click="prevStep"
            >
              {{ t('actions.back') }}
            </button>
            <button type="button" :class="rbBtnSecondary" class="!px-2.5 !py-1.5 !text-xs" @click="cancelWizard">
              {{ t('actions.cancel') }}
            </button>
            <button
              v-if="isSaveStep"
              type="button"
              :class="rbBtnSecondary"
              class="!px-2.5 !py-1.5 !text-xs"
              :disabled="saving"
              @click="() => void saveDraft()"
            >
              {{ saving ? t('states.saving') : t('analytics.saveDraft') }}
            </button>
            <ReportBuilderPublishMenu
              v-if="isSaveStep"
              :disabled="saving || !isReadyToPublish"
              @publish="publish"
              @publish-with-schedule="publishWithSchedule"
            />
            <button
              v-else-if="currentStep < stepItems.length - 1"
              type="button"
              :class="rbBtnPrimary"
              class="!px-2.5 !py-1.5 !text-xs"
              :disabled="!canProceed"
              @click="nextStep"
            >
              {{ t('actions.next') }}
            </button>
          </div>
        </div>

        <div class="mt-2">
          <ReportBuilderStepper :items="stepItems" :current-step="currentStep" @go-to="goToStep" />
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-[1600px] px-4 py-4 lg:px-8">
        <div class="grid gap-6" :class="showSummary ? 'xl:grid-cols-[minmax(0,1fr)_18rem]' : ''">
          <div :class="rbCard">
            <ReportBuilderStepModule
              v-if="currentStep === 0"
              :popular-modules="popularModules"
              :other-modules="otherModules"
              :selected-module="form.primaryModule"
              :report-name="form.name"
              :report-description="form.description"
              @select-module="selectModule"
              @update:report-name="form.name = $event"
              @update:report-description="form.description = $event"
            />

            <div v-else-if="currentStep === 1" class="p-5 lg:p-6">
              <ReportBuilderStepHeader
                :title="t('analytics.builderStep_selectFields')"
                :subtitle="t('analytics.builderStepHint_selectFields')"
              />
              <ReportBuilderStepFields
                :primary-module-label="primaryModuleLabel"
                :field-options="moduleFieldOptions"
                :selected-fields="selectedFields"
                :join-targets="joinTargets"
                :related-modules="relatedModules"
                :related-module-groups="relatedModuleGroups"
                @toggle-field="toggleColumn"
                @remove-field="removeSelectedField"
                @clear-fields="clearSelectedFields"
                @reorder-fields="reorderSelectedFields"
                @toggle-related="(mod, checked) => toggleRelatedModule(mod, checked)"
              />
            </div>

            <div v-else-if="currentStep === 2" class="p-6 lg:p-8">
              <ReportBuilderStepHeader
                :title="t('analytics.builderStep_addFilters')"
                :subtitle="t('analytics.builderStepHint_addFilters')"
              />
              <ReportBuilderStepFilters
                :primary-module="form.primaryModule"
                :primary-module-label="primaryModuleLabel"
                :field-options="moduleFieldOptions"
                :module-fields="moduleFields"
                :selected-fields="selectedFields"
                :filter-initial-state="filterInitialState"
                :filter-remount-token="filterRemountToken"
                @filter-change="onFilterStateChange"
              />
            </div>

            <div v-else-if="currentStep === 3" class="p-6 lg:p-8">
              <ReportBuilderStepGroupAggregate
                :field-options="moduleFieldOptions"
                :selected-fields="selectedFields"
                v-model:row-groups="rowGroups"
                v-model:column-groups="columnGroups"
                v-model:sorting="sorting"
                v-model:metrics="metrics"
                v-model:show-grand-total="showGrandTotal"
                v-model:show-sub-totals="showSubTotals"
                v-model:show-record-count="showRecordCount"
                v-model:collapse-groups="collapseGroups"
                v-model:drill-down-enabled="form.drillDownEnabled"
                :numeric-field-options="numericFieldOptions"
                :aggregation-fn-options="aggregationFnOptions"
              />
            </div>

            <div v-else-if="currentStep === 4" class="p-6 lg:p-8">
              <ReportBuilderStepHeader
                :title="t('analytics.builderStep_preview')"
                :subtitle="t('analytics.builderStepHint_preview')"
              />
              <ReportBuilderStepPreview
                :preview-result="previewResult"
                :expanded-matrix-rows="expandedMatrixRows"
                :effective-report-type="effectiveReportType"
                :report-type-label="reportTypeLabel"
                :form-name="form.name"
                :executing="executing"
                :theme-mode="themeMode"
                :preview-metric-field="previewMetricField"
                :preview-dimension-field="previewDimensionField"
                @run-preview="runPreview"
                @toggle-row="toggleMatrixRowExpand"
              />
            </div>

            <div v-else class="p-6 lg:p-8">
              <ReportBuilderStepHeader
                :title="t('analytics.builderStep_savePublish')"
                :subtitle="t('analytics.builderStepHint_savePublish')"
              />
              <ReportBuilderStepSavePublish
                :form-name="form.name"
                :form-description="form.description"
                :report-type-label="reportTypeLabel"
                :form-folder-id="form.folderId"
                :form-tags="form.tags"
                :folder-options="folderOptions"
                :visibility="form.visibility"
                :shared-with="form.sharedWith"
                :permissions="form.permissions"
                :cache-enabled="form.cacheEnabled"
                :cache-duration="form.cacheDuration"
                :runtime-filters="form.runtimeFilters"
                :listed-in-home="form.listedInHome"
                :add-to-favorites="form.addToFavorites"
                :schedule-enabled="scheduleForm.enabled"
                :schedule-frequency="scheduleForm.frequency"
                :schedule-timezone="scheduleForm.timezone"
                :schedule-hour="scheduleForm.hour"
                :schedule-minute="scheduleForm.minute"
                :schedule-day-of-week="scheduleForm.dayOfWeek"
                :schedule-day-of-month="scheduleForm.dayOfMonth"
                :schedule-export-formats="scheduleForm.exportFormats"
                :schedule-start-date="scheduleForm.startDate"
                :schedule-end-date="scheduleForm.endDate"
                :schedule-recipients-text="scheduleForm.recipientsText"
                :schedule-send-copy-to-owner="scheduleForm.sendCopyToOwner"
                :ready-to-publish="isReadyToPublish"
                :saving="saving"
                @update:form-folder-id="form.folderId = $event"
                @update:form-tags="form.tags = $event"
                @update:visibility="form.visibility = $event"
                @update:shared-with="form.sharedWith = $event"
                @update:permissions="form.permissions = $event"
                @update:cache-enabled="form.cacheEnabled = $event"
                @update:cache-duration="form.cacheDuration = $event"
                @update:runtime-filters="form.runtimeFilters = $event"
                @update:listed-in-home="form.listedInHome = $event"
                @update:add-to-favorites="form.addToFavorites = $event"
                @update:schedule-enabled="scheduleForm.enabled = $event"
                @update:schedule-frequency="scheduleForm.frequency = $event"
                @update:schedule-timezone="scheduleForm.timezone = $event"
                @update:schedule-hour="scheduleForm.hour = $event"
                @update:schedule-minute="scheduleForm.minute = $event"
                @update:schedule-day-of-week="scheduleForm.dayOfWeek = $event"
                @update:schedule-day-of-month="scheduleForm.dayOfMonth = $event"
                @update:schedule-export-formats="scheduleForm.exportFormats = $event"
                @update:schedule-start-date="scheduleForm.startDate = $event"
                @update:schedule-end-date="scheduleForm.endDate = $event"
                @update:schedule-recipients-text="scheduleForm.recipientsText = $event"
                @update:schedule-send-copy-to-owner="scheduleForm.sendCopyToOwner = $event"
                @save-draft="() => void saveDraft()"
                @publish="publish"
                @publish-with-schedule="publishWithSchedule"
              />
            </div>
          </div>

          <ReportBuilderSummaryPanel
            v-if="showSummary"
            class="xl:sticky xl:top-[4.5rem] xl:self-start"
            :primary-module-label="primaryModuleLabel"
            :report-type="form.type"
            :selected-fields="selectedFieldLabels"
            :row-groups="rowGroups"
            :column-groups="columnGroups"
            :sorting="sorting"
            :field-options="moduleFieldOptions"
            :filter-count="filterCount"
            :filter-summaries="filterSummaries"
            :sort-summaries="sortSummaries"
            :preview-result="previewResult"
            :expanded="isExpandedSummary"
            :show-run-preview="currentStep === 4"
            :show-whats-next="isSaveStep"
            :report-id="loadedReportId"
            :report-status="loadedReportStatus"
            :executing="executing"
            @update:report-type="form.type = $event"
            @edit-step="goToStep"
            @run-preview="runPreview"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import {
  rbBtnGhost,
  rbBtnPrimary,
  rbBtnSecondary,
  rbCard,
  rbLink,
  rbPage,
  rbHeader,
} from '@/components/analytics/report-builder/reportBuilderUi';
import ReportBuilderStepHeader from '@/components/analytics/report-builder/ReportBuilderStepHeader.vue';
import ReportBuilderStepper from '@/components/analytics/report-builder/ReportBuilderStepper.vue';
import ReportBuilderSummaryPanel from '@/components/analytics/report-builder/ReportBuilderSummaryPanel.vue';
import ReportBuilderStepModule from '@/components/analytics/report-builder/steps/ReportBuilderStepModule.vue';
import ReportBuilderStepFields from '@/components/analytics/report-builder/steps/ReportBuilderStepFields.vue';
import ReportBuilderStepFilters from '@/components/analytics/report-builder/steps/ReportBuilderStepFilters.vue';
import ReportBuilderStepGroupAggregate from '@/components/analytics/report-builder/steps/ReportBuilderStepGroupAggregate.vue';
import ReportBuilderStepPreview from '@/components/analytics/report-builder/steps/ReportBuilderStepPreview.vue';
import ReportBuilderStepSavePublish from '@/components/analytics/report-builder/steps/ReportBuilderStepSavePublish.vue';
import ReportBuilderPublishMenu from '@/components/analytics/report-builder/ReportBuilderPublishMenu.vue';
import {
  REPORT_BUILDER_PREVIEW_STEP,
  REPORT_BUILDER_SAVE_STEP,
  useReportBuilder,
} from '@/composables/useReportBuilder';
import { useColorMode } from '@/composables/useColorMode';

const props = defineProps({
  reportId: { type: String, default: null },
});

const route = useRoute();
const { effectiveDark } = useColorMode();
const {
  t,
  currentStep,
  stepItems,
  isNew,
  form,
  scheduleForm,
  loadedReportStatus,
  popularModules,
  otherModules,
  moduleFieldOptions,
  moduleFields,
  folderOptions,
  aggregationFnOptions,
  numericFieldOptions,
  joinTargets,
  relatedModuleGroups,
  selectedFields,
  selectedFieldLabels,
  relatedModules,
  rowGroups,
  columnGroups,
  sorting,
  showGrandTotal,
  showSubTotals,
  showRecordCount,
  collapseGroups,
  metrics,
  groupByField,
  filterState,
  filterInitialState,
  filterRemountToken,
  previewResult,
  expandedMatrixRows,
  saving,
  executing,
  effectiveReportType,
  reportTypeLabel,
  primaryModuleLabel,
  canProceed,
  isReadyToPublish,
  filterSummaries,
  sortSummaries,
  selectModule,
  toggleColumn,
  toggleRelatedModule,
  clearSelectedFields,
  reorderSelectedFields,
  removeSelectedField,
  onFilterStateChange,
  goToStep,
  nextStep,
  prevStep,
  saveDraft,
  runPreview,
  toggleMatrixRowExpand,
  publish,
  publishWithSchedule,
  goBack,
  cancelWizard,
} = useReportBuilder(props.reportId);

const themeMode = computed(() => (effectiveDark.value ? 'dark' : 'light'));
const showSummary = computed(() => currentStep.value >= 1);
const isSaveStep = computed(() => currentStep.value === REPORT_BUILDER_SAVE_STEP);
const isExpandedSummary = computed(() => currentStep.value >= REPORT_BUILDER_PREVIEW_STEP);

const previewMetricField = computed(() => {
  const primary = metrics.value[0];
  if (!primary) return 'count';
  return primary.label || `${primary.field}_${primary.fn}`;
});

const previewDimensionField = computed(() => rowGroups.value[0] || groupByField.value);

const filterCount = computed(() => {
  const filters = filterState.value?.filters;
  if (!filters) return 0;
  return Object.values(filters).filter((value) => value !== null && value !== undefined && value !== '').length;
});

const loadedReportId = computed(() => {
  const id = props.reportId || route.params.id;
  return id ? String(id) : null;
});
</script>

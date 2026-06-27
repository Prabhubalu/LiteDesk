<template>
  <Teleport to="body">
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="'import-csv-title'"
    @keydown.escape.stop
  >
    <div
      class="relative flex h-[92vh] max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 lg:max-w-6xl"
      @click.stop
    >
      <!-- Background import confirmation -->
      <div
        v-if="showBackgroundConfirm"
        class="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-black/50 p-6 backdrop-blur-[2px]"
      >
        <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('import.importBackgroundConfirmTitle') }}</h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('import.importBackgroundConfirmMessage') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="showBackgroundConfirm = false"
            >
              {{ t('import.importKeepWatching') }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              @click="confirmRunInBackground"
            >
              {{ t('import.importRunInBackground') }}
            </button>
          </div>
        </div>
      </div>
      <!-- Save mapping template -->
      <div
        v-if="showSaveMappingTemplateModal"
        class="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-black/50 p-6 backdrop-blur-[2px]"
      >
        <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ saveMappingModalMode === 'saveAsNew'
              ? t('import.savedMappingSaveAsNewTitle')
              : t('import.savedMappingSaveTitle') }}
          </h3>
          <div class="mt-4 space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ t('import.savedMappingSaveNameLabel') }}
              </label>
              <input
                v-model="saveTemplateName"
                type="text"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                :placeholder="t('import.savedMappingSaveNamePlaceholder')"
                maxlength="120"
              />
            </div>
            <label class="flex cursor-pointer items-start gap-3">
              <HeadlessCheckbox v-model="saveTemplateIncludeDuplicate" checkbox-class="mt-0.5 shrink-0" />
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {{ t('import.savedMappingIncludeDuplicate') }}
              </span>
            </label>
            <label class="flex cursor-pointer items-start gap-3">
              <HeadlessCheckbox v-model="saveTemplateSetDefault" checkbox-class="mt-0.5 shrink-0" />
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {{ t('import.savedMappingSetDefault') }}
              </span>
            </label>
            <p v-if="saveTemplateError" class="text-sm text-red-600 dark:text-red-400">{{ saveTemplateError }}</p>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              :disabled="savingMappingTemplate"
              @click="closeSaveMappingTemplateModal"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              :disabled="savingMappingTemplate"
              @click="submitSaveMappingTemplate"
            >
              {{ t('import.savedMappingSaveSubmit') }}
            </button>
          </div>
        </div>
      </div>
      <!-- Discard confirmation -->
      <div
        v-if="showDiscardConfirm"
        class="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-black/50 p-6 backdrop-blur-[2px]"
      >
        <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('import.importDiscardTitle') }}</h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('import.importDiscardMessage') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="showDiscardConfirm = false"
            >
              {{ t('import.importKeepWorking') }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              @click="confirmDiscard"
            >
              {{ t('import.importDiscardProgress') }}
            </button>
          </div>
        </div>
      </div>
      <!-- Header: title + compact stepper on one row -->
      <header class="shrink-0 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5 sm:py-3.5">
        <div class="flex min-h-10 items-center gap-2.5 sm:min-h-11 sm:gap-3">
          <button
            v-if="allowModuleChange"
            type="button"
            class="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            :title="t('performance.back')"
            @click="requestChangeModule"
          >
            <ArrowLeftIcon class="h-5 w-5" aria-hidden="true" />
          </button>

          <h2
            id="import-csv-title"
            class="shrink-0 truncate text-base font-semibold leading-snug text-gray-900 dark:text-white sm:max-w-[11rem] lg:max-w-[13rem]"
          >
            {{ t('import.cSVImportModalImportEntity', { entityType }) }}
          </h2>

          <nav
            v-if="!importResults"
            class="hidden min-w-0 flex-1 items-center justify-center sm:flex"
            :aria-label="importWizardProgressAriaLabel"
          >
            <ol class="flex max-w-full items-center">
              <li
                v-for="(item, idx) in stepperItems"
                :key="item.id"
                class="flex min-w-0 items-center"
              >
                <div
                  class="flex min-w-0 items-center gap-1.5"
                  :title="item.label"
                  :aria-current="idx === step ? 'step' : undefined"
                >
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold leading-none transition-colors"
                    :class="importStepCircleClass(idx)"
                  >
                    <CheckIcon v-if="idx < step" class="h-4 w-4 text-white" aria-hidden="true" />
                    <span v-else>{{ idx + 1 }}</span>
                  </span>
                  <span
                    class="hidden truncate text-xs font-medium md:inline"
                    :class="idx === step
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : idx < step
                        ? 'text-gray-800 dark:text-gray-200'
                        : 'text-gray-400 dark:text-gray-500'"
                  >
                    {{ item.label }}
                  </span>
                </div>
                <span
                  v-if="idx < stepperItems.length - 1"
                  class="mx-1.5 h-px w-5 shrink-0 bg-gray-300 dark:bg-gray-600 lg:w-9"
                  aria-hidden="true"
                />
              </li>
            </ol>
          </nav>

          <span
            v-if="!importResults"
            class="shrink-0 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:ml-auto"
            :title="currentStepShortTitle"
          >
            {{ importHeaderStepLine }}
          </span>

          <button
            type="button"
            class="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            :aria-label="t('actions.close')"
            @click="requestClose"
          >
            <XMarkIcon class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <!-- Mobile: slim step segments (stepper labels in body description + pill title) -->
        <div
          v-if="!importResults"
          class="mt-2 flex gap-1 sm:hidden"
          role="progressbar"
          :aria-valuenow="step + 1"
          aria-valuemin="1"
          :aria-valuemax="steps.length"
          :aria-label="importWizardProgressAriaLabel"
        >
          <div
            v-for="(_, idx) in steps"
            :key="`import-progress-mobile-${idx}`"
            class="h-1.5 flex-1 rounded-full transition-colors"
            :class="idx <= step
              ? 'bg-indigo-600 dark:bg-indigo-500'
              : 'bg-gray-200 dark:bg-gray-700'"
          />
        </div>
      </header>

      <!-- Body (fixed modal height — content scrolls here) -->
      <div ref="importModalBodyRef" class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div class="min-h-full">
          <p
            v-if="!importResults && currentStepDescription"
            class="mb-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400"
          >
            {{ currentStepDescription }}
          </p>
          <div
            v-if="bannerError"
            class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800 dark:bg-red-900/20"
            role="alert"
          >
            <p class="flex-1 text-sm text-red-800 dark:text-red-200">{{ bannerError }}</p>
            <button type="button" class="text-red-500 hover:text-red-700" :aria-label="t('actions.close')" @click="bannerError = ''">
              <XMarkIcon class="h-4 w-4" />
            </button>
          </div>

          <!-- Step 1: Upload -->
          <div v-if="step === 0" class="space-y-4">
            <div v-if="stagingUploading" class="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
              <p class="text-sm text-gray-700 dark:text-gray-300">{{ t('import.importStagingUploading') }}</p>
            </div>

            <div
              class="cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors"
              :class="isDragOver
                ? 'border-indigo-500 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-900/20'
                : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-indigo-500 dark:hover:bg-gray-800/50'"
              @click="$refs.fileInput.click()"
              @dragover.prevent="isDragOver = true"
              @dragleave.prevent="isDragOver = false"
              @drop.prevent="handleFileDrop"
            >
              <input ref="fileInput" type="file" accept=".csv" class="hidden" @change="handleFileSelect" />

              <template v-if="!fileName">
                <ArrowUpTrayIcon class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">
                  {{ isDragOver ? t('import.importDragActive') : t('import.cSVImportModalUploadYourCsvFile') }}
                </p>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('import.cSVImportModalDragAndDropYourFileHere') }}</p>
                <button
                  type="button"
                  class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  @click.stop="$refs.fileInput.click()"
                >
                  {{ t('import.cSVImportModalChooseFile') }}
                </button>
                <p class="mt-3 text-xs text-gray-400">{{ t('import.cSVImportModalSupportedFormatCsvFilesOnly') }}</p>
              </template>

              <template v-else>
                <CheckCircleIcon class="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
                <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ fileName }}</p>
                <p v-if="fileMetaLabel" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ fileMetaLabel }}</p>
                <button
                  type="button"
                  class="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                  @click.stop="clearFile"
                >
                  {{ t('import.cSVImportModalChooseADifferentFile') }}
                </button>
              </template>
            </div>

            <button
              type="button"
              class="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="handleDownloadTemplate"
            >
              <ArrowDownTrayIcon class="h-4 w-4" aria-hidden="true" />
              {{ t('import.importDownloadTemplate') }}
            </button>
            <p
              v-if="requiredImportFields.length"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ t('import.importRequiredFieldsList', { fields: requiredImportFieldNames }) }}
            </p>
          </div>

          <!-- Step 2: Map fields -->
          <div v-if="step === 1 && csvHeaders.length > 0" class="space-y-3">
            <div
              class="flex flex-col gap-3 rounded-xl border p-3 dark:border-gray-700"
              :class="isTemplateModified
                ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-900/10'
                : 'border-gray-200 bg-gray-50/80 dark:bg-gray-800/40'"
            >
              <div class="flex flex-wrap items-end gap-3">
                <div class="min-w-[12rem] flex-1">
                  <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {{ t('import.savedMappingTemplateLabel') }}
                  </label>
                  <HeadlessSelect
                    :model-value="selectedTemplateId"
                    :options="templateSelectOptions"
                    :disabled="mappingTemplatesLoading || fieldsLoading"
                    allow-empty
                    :empty-label="t('import.savedMappingTemplateNone')"
                    teleport
                    button-class="!w-full !px-3 !py-2 !text-sm !bg-white dark:!bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-lg !shadow-none"
                    options-class="z-[10050]"
                    @update:model-value="onMappingTemplateSelected"
                  />
                </div>
                <button
                  v-if="canCreateImportTemplate && !showTemplateModifiedActions"
                  type="button"
                  class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  :disabled="!canSaveMappingTemplate || savingMappingTemplate"
                  @click="openSaveMappingTemplateModal"
                >
                  {{ t('import.savedMappingSaveAction') }}
                </button>
                <button
                  type="button"
                  class="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                  :disabled="fieldsLoading"
                  @click="applyAutoFieldMappingOnly"
                >
                  {{ t('import.savedMappingResetAutoMap') }}
                </button>
              </div>
              <p
                v-if="isTemplateModified"
                class="text-xs text-amber-700 dark:text-amber-300"
              >
                {{ t('import.savedMappingModifiedHint') }}
              </p>
              <div
                v-if="showTemplateModifiedActions"
                class="flex flex-wrap gap-2"
              >
                <button
                  type="button"
                  class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  :disabled="!canSaveMappingTemplate || updatingMappingTemplate"
                  @click="updateAppliedTemplate"
                >
                  {{ t('import.savedMappingUpdateTemplate') }}
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  :disabled="!canSaveMappingTemplate || savingMappingTemplate"
                  @click="openSaveAsNewMappingTemplateModal"
                >
                  {{ t('import.savedMappingSaveAsNewTemplate') }}
                </button>
              </div>
            </div>

            <div
              v-if="templateApplyReport"
              class="overflow-hidden rounded-lg border text-xs dark:border-gray-700"
              :class="templateApplyReportHasWarnings
                ? 'border-amber-200 bg-amber-50/40 dark:border-amber-800/50 dark:bg-amber-900/10'
                : 'border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-900/10'"
              role="status"
            >
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                :aria-expanded="templateReportExpanded"
                @click="templateReportExpanded = !templateReportExpanded"
              >
                <ChevronDownIcon
                  class="h-4 w-4 shrink-0 text-gray-500 transition-transform dark:text-gray-400"
                  :class="templateReportExpanded ? 'rotate-180' : ''"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1 text-gray-800 dark:text-gray-200">
                  {{ templateReportHeadline }}
                </span>
                <span
                  v-if="templateApplyReportHasWarnings"
                  class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                >
                  {{ t('import.savedMappingReportIssuesBadge', { count: templateApplyReportIssueCount }) }}
                </span>
                <span class="shrink-0 text-gray-500 dark:text-gray-400">
                  {{ templateReportExpanded
                    ? t('import.savedMappingReportHideDetails')
                    : t('import.savedMappingReportShowDetails') }}
                </span>
              </button>

              <div
                v-show="templateReportExpanded"
                class="custom-scrollbar max-h-36 space-y-2 overflow-y-auto border-t border-gray-200/80 px-3 py-2 dark:border-gray-700/80"
              >
                <div v-if="templateApplyReport.matched.length" class="space-y-1">
                  <p class="font-medium text-emerald-700 dark:text-emerald-400">
                    {{ t('import.savedMappingReportMatched') }} ({{ templateApplyReport.matched.length }})
                  </p>
                  <p class="text-gray-600 dark:text-gray-400">
                    {{ templateApplyReportMatchedPreview }}
                  </p>
                </div>
                <div v-if="templateApplyReport.unmatchedHeaders.length" class="space-y-1">
                  <p class="font-medium text-amber-700 dark:text-amber-400">
                    {{ t('import.savedMappingReportUnmatched') }}
                  </p>
                  <p class="flex flex-wrap gap-1">
                    <span
                      v-for="header in templateApplyReport.unmatchedHeaders"
                      :key="`u-${header}`"
                      class="rounded bg-amber-100/80 px-1.5 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                    >{{ header }}</span>
                  </p>
                </div>
                <div v-if="templateApplyReport.staleRules.length" class="space-y-0.5 text-gray-600 dark:text-gray-400">
                  <p class="font-medium">{{ t('import.savedMappingReportStale') }}</p>
                  <p
                    v-for="rule in templateApplyReport.staleRules"
                    :key="`s-${rule.targetFieldKey}`"
                    class="truncate"
                  >
                    {{ importFieldLabel(rule.targetFieldKey) }}
                  </p>
                </div>
                <div v-if="templateApplyReport.invalidTargetFields.length" class="space-y-0.5 text-red-700 dark:text-red-400">
                  <p class="font-medium">{{ t('import.savedMappingReportInvalid') }}</p>
                  <p
                    v-for="rule in templateApplyReport.invalidTargetFields"
                    :key="`i-${rule.targetFieldKey}`"
                  >
                    {{ rule.targetFieldKey }}
                  </p>
                </div>
                <div v-if="templateApplyReport.aliasCollisions?.length" class="space-y-0.5 text-amber-900 dark:text-amber-200">
                  <p class="font-medium">{{ t('import.savedMappingReportAliasCollisions') }}</p>
                  <p
                    v-for="(collision, idx) in templateApplyReport.aliasCollisions"
                    :key="`c-${idx}`"
                  >
                    {{ collision.normalizedAlias }} → {{ collision.targetFieldKeys.map(importFieldLabel).join(', ') }}
                  </p>
                </div>
                <div v-if="templateApplyReport.ambiguousHeaders?.length" class="space-y-0.5 text-amber-900 dark:text-amber-200">
                  <p class="font-medium">{{ t('import.savedMappingReportAmbiguous') }}</p>
                  <p
                    v-for="row in templateApplyReport.ambiguousHeaders"
                    :key="`a-${row.csvHeader}`"
                  >
                    {{ row.csvHeader }} → {{ row.targetFieldKeys.map(importFieldLabel).join(', ') }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span class="text-gray-600 dark:text-gray-400">
                {{ t('import.cSVImportModalRowCount', { count: totalRows }) }}
                {{ t('import.cSVImportModalDetectedInYourCsvFile') }}
              </span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ t('import.importMappingProgress', { mapped: mappingStats.mapped, total: mappingStats.total }) }}
              </span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div class="h-full rounded-full bg-indigo-600 transition-all" :style="{ width: `${mappingStats.percent}%` }" />
            </div>
            <p v-if="autoMappedCount > 0" class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('import.importAutoMappedCount', { count: autoMappedCount }) }}
            </p>
            <p v-if="fieldsLoading" class="text-sm text-gray-500">{{ t('import.importFieldsLoading') }}</p>
            <p
              v-else-if="requiredImportFields.length"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ t('import.importRequiredFieldsLegend') }}
            </p>
            <div
              v-if="unmappedRequiredImportFields.length"
              class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200"
              role="status"
            >
              {{ t('import.importUnmappedRequiredFields', {
                fields: unmappedRequiredImportFields.map((field) => field.displayLabel).join(', '),
              }) }}
            </div>

            <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="w-full table-fixed text-sm">
                <colgroup>
                  <col class="w-[30%]">
                  <col class="w-[35%]">
                  <col class="w-[35%]">
                </colgroup>
                <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <tr>
                    <th scope="col" class="px-3 py-2">{{ t('import.importCsvColumnHeader') }}</th>
                    <th scope="col" class="px-3 py-2">{{ t('import.importModuleFieldHeader') }}</th>
                    <th scope="col" class="px-3 py-2">{{ t('import.importDefaultValueHeader') }}</th>
                  </tr>
                </thead>
              </table>
              <div class="custom-scrollbar max-h-[min(58vh,560px)] overflow-y-auto">
                <table class="w-full table-fixed text-sm">
                  <colgroup>
                    <col class="w-[30%]">
                    <col class="w-[35%]">
                    <col class="w-[35%]">
                  </colgroup>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                    <tr v-for="header in csvHeaders" :key="header" class="bg-white dark:bg-gray-900">
                      <td class="px-3 py-2 align-top">
                        <p class="font-medium text-gray-900 dark:text-white">{{ header }}</p>
                        <p
                          v-if="preview[0]?.[header]"
                          class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400"
                        >
                          {{ preview[0][header] }}
                        </p>
                      </td>
                      <td class="px-3 py-2 align-top">
                        <HeadlessSelect
                          :model-value="fieldMapping[header]"
                          :option-groups="displayFieldOptionGroups.length ? displayFieldOptionGroups : undefined"
                          :options="displayFieldOptionGroups.length ? [] : availableFields.map((field) => ({ ...field, label: field.displayLabel }))"
                          allow-empty
                          :empty-label="`⊘ ${t('import.cSVImportModalSkipField')}`"
                          teleport
                          :disabled="fieldsLoading"
                          button-class="!w-full !px-3 !py-2 !text-sm !bg-white dark:!bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-lg !shadow-none"
                          options-class="z-[10050]"
                          @update:model-value="(value) => setFieldMapping(header, value)"
                        />
                      </td>
                      <td class="px-3 py-2 align-top">
                        <ImportFieldDefaultValueInput
                          :field="fieldsByKey[fieldMapping[header]]"
                          :model-value="fieldDefaultValues[header]"
                          :disabled="fieldsLoading || !fieldMapping[header]"
                          @update:model-value="(value) => setFieldDefaultValue(header, value)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Step 3: Duplicates -->
          <div v-if="step === 2" class="space-y-4">
            <section
              class="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800/60 dark:bg-blue-900/15 sm:p-5"
              aria-labelledby="import-duplicate-options-title"
            >
              <div class="flex items-start gap-3">
                <ClipboardDocumentCheckIcon class="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <div class="min-w-0 flex-1 space-y-4">
                  <h3 id="import-duplicate-options-title" class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ t('import.cSVImportModalDuplicateDetectionOptions') }}
                  </h3>

                  <div class="space-y-2">
                    <label
                      class="flex cursor-pointer items-start gap-3 rounded-lg border-2 px-3 py-3 transition-colors"
                      :class="shouldCheckDuplicates
                        ? 'border-indigo-500 bg-white dark:bg-gray-900'
                        : 'border-transparent bg-white/60 hover:border-gray-200 dark:bg-gray-900/40 dark:hover:border-gray-600'"
                    >
                      <input
                        v-model="shouldCheckDuplicates"
                        type="radio"
                        :value="true"
                        class="mt-0.5 text-indigo-600"
                        :disabled="checkingDuplicates"
                      />
                      <span class="min-w-0">
                        <span class="flex flex-wrap items-center gap-2">
                          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('import.cSVImportModalCheckForDuplicates') }}</span>
                          <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            {{ t('settings.integrationsRecommended') }}
                          </span>
                        </span>
                        <span class="mt-1 block text-xs text-gray-600 dark:text-gray-400">{{ t('import.cSVImportModalScanYourCsvForDuplicateRecords') }}</span>
                      </span>
                    </label>

                    <label
                      class="flex cursor-pointer items-start gap-3 rounded-lg border-2 px-3 py-3 transition-colors"
                      :class="!shouldCheckDuplicates
                        ? 'border-indigo-500 bg-white dark:bg-gray-900'
                        : 'border-transparent bg-white/60 hover:border-gray-200 dark:bg-gray-900/40 dark:hover:border-gray-600'"
                    >
                      <input
                        v-model="shouldCheckDuplicates"
                        type="radio"
                        :value="false"
                        class="mt-0.5 text-indigo-600"
                        :disabled="checkingDuplicates"
                      />
                      <span class="min-w-0">
                        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('import.cSVImportModalDoNotCheckForDuplicates') }}</span>
                        <span class="mt-1 block text-xs text-gray-600 dark:text-gray-400">{{ t('import.cSVImportModalImportAllRecordsWithoutDuplicateChecking') }}</span>
                      </span>
                    </label>
                  </div>

                  <div v-if="shouldCheckDuplicates" class="border-t border-blue-200/80 pt-4 dark:border-blue-800/50">
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ t('import.cSVImportModalSelectWhichFieldSToUse') }}
                      <strong>{{ t('import.cSVImportModalAll2') }}</strong>
                      {{ t('import.cSVImportModalSelectedFieldsWillBeConsideredDuplicates') }}
                    </p>

                    <label class="mt-3 block text-sm font-medium text-gray-800 dark:text-gray-200">
                      {{ t('import.cSVImportModalDuplicateCheckFields') }}
                    </label>

                    <p
                      v-if="duplicateCheckableFields.length === 0"
                      class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                    >
                      {{ t('import.cSVImportModalNoMappedFieldsForDuplicateCheck') }}
                    </p>

                    <div v-else class="relative mt-2">
                      <button
                        ref="duplicateFieldTriggerRef"
                        type="button"
                        class="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm shadow-sm transition-colors hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-600 dark:bg-gray-900"
                        :disabled="checkingDuplicates"
                        aria-haspopup="listbox"
                        :aria-expanded="showFieldDropdown"
                        @click="toggleDuplicateFieldDropdown"
                      >
                        <span class="min-w-0 flex-1">
                          <span v-if="duplicateCheckFields.length === 0" class="text-gray-500 dark:text-gray-400">
                            {{ t('import.cSVImportModalSelectFieldsToCheck') }}
                          </span>
                          <span v-else class="flex flex-wrap gap-1.5">
                            <span
                              v-for="fieldValue in duplicateCheckFields"
                              :key="fieldValue"
                              class="inline-flex max-w-full items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                            >
                              <span class="truncate">{{ duplicateFieldLabel(fieldValue) }}</span>
                              <button
                                type="button"
                                class="shrink-0 hover:text-indigo-950 dark:hover:text-white"
                                :aria-label="t('actions.remove')"
                                @click.stop="removeDuplicateCheckField(fieldValue)"
                              >
                                <XMarkIcon class="h-3.5 w-3.5" />
                              </button>
                            </span>
                          </span>
                        </span>
                        <ChevronDownIcon
                          class="ml-2 h-5 w-5 shrink-0 text-gray-400 transition-transform"
                          :class="{ 'rotate-180': showFieldDropdown }"
                          aria-hidden="true"
                        />
                      </button>

                      <Teleport to="body">
                        <div
                          v-if="showFieldDropdown"
                          ref="duplicateFieldMenuRef"
                          role="listbox"
                          class="fixed z-[10050] overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-900"
                          :style="duplicateFieldMenuStyle"
                        >
                          <label
                            v-for="field in duplicateCheckableFields"
                            :key="field.value"
                            class="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <HeadlessCheckbox
                              :checked="duplicateCheckFields.includes(field.value)"
                              @change="toggleDuplicateCheckField(field.value, $event)"
                              checkbox-class="mt-0.5 h-4 w-4 shrink-0"
                            />
                            <span class="min-w-0 flex-1">
                              <span class="flex flex-wrap items-center gap-2">
                                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ field.label }}</span>
                                <span
                                  v-if="field.recommended"
                                  class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                >{{ t('settings.integrationsRecommended') }}</span>
                              </span>
                              <span v-if="field.description" class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ field.description }}</span>
                            </span>
                          </label>
                        </div>
                      </Teleport>
                    </div>

                    <p class="mt-3 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <InformationCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                      <span>
                        <strong>{{ t('import.cSVImportModalAndLogic') }}</strong>
                        {{ t('import.cSVImportModalARecordIsOnlyConsideredA') }}
                        <strong>{{ t('import.cSVImportModalAll') }}</strong>
                        {{ t('import.cSVImportModalSelectedFieldsWillBeConsideredDuplicates') }}
                        {{ t('import.cSVImportModalAndLogicExample') }}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div
              ref="duplicateScanSectionRef"
              class="scroll-mt-4 space-y-4"
            >
            <div v-if="checkingDuplicates" class="rounded-lg border border-gray-200 bg-gray-50 py-10 text-center dark:border-gray-700 dark:bg-gray-800/40">
              <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
              <p class="mt-4 text-sm font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalCheckingForDuplicates') }}</p>
              <p class="mt-1 text-xs text-gray-500">{{ t('import.cSVImportModalComparingRecords', { count: totalRows }) }}</p>
            </div>

            <template v-else-if="duplicateData">
              <p
                v-if="duplicateData.checkedFields?.length"
                class="text-xs text-gray-500 dark:text-gray-400"
              >
                {{ t('import.importDuplicateCheckedFields', { fields: duplicateData.checkedFields.map(duplicateFieldLabel).join(', ') }) }}
              </p>

              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div class="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-3 text-center dark:border-emerald-800/60 dark:bg-emerald-900/10">
                  <p class="text-xl font-semibold text-emerald-700 dark:text-emerald-300">{{ duplicateData.unique }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('import.cSVImportModalNewRecords') }}</p>
                </div>
                <div class="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-3 text-center dark:border-amber-800 dark:bg-amber-900/10">
                  <p class="text-xl font-semibold text-amber-700 dark:text-amber-300">{{ duplicateExistingCount }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('import.importDuplicateExistingInCrm') }}</p>
                </div>
                <div class="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-3 text-center dark:border-violet-800 dark:bg-violet-900/10">
                  <p class="text-xl font-semibold text-violet-700 dark:text-violet-300">{{ duplicateInFileCount }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('import.importDuplicateRepeatedInCsv') }}</p>
                </div>
                <div class="rounded-lg border border-gray-200 px-3 py-3 text-center dark:border-gray-700">
                  <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ duplicateData.total }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('import.cSVImportModalTotalRows') }}</p>
                </div>
              </div>

              <div v-if="duplicateHasAnyMatches" class="space-y-3">
                <section
                  v-if="duplicateExistingCount > 0"
                  class="overflow-hidden rounded-xl border border-amber-200 dark:border-amber-800/60"
                >
                  <div class="flex items-center justify-between gap-3 border-b border-amber-200/80 bg-amber-50/60 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-900/15">
                    <div>
                      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ t('import.importDuplicateExistingSectionTitle', { count: duplicateExistingCount }) }}
                      </h4>
                      <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                        {{ t('import.importDuplicateExistingSectionDesc') }}
                      </p>
                    </div>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-amber-100 text-sm dark:divide-amber-900/40">
                      <thead class="bg-white/70 dark:bg-gray-900/40">
                        <tr>
                          <th scope="col" class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('import.importDuplicateTableRow') }}</th>
                          <th scope="col" class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('import.importDuplicateTableMatchedValue') }}</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-amber-100/80 bg-white/40 dark:divide-amber-900/30 dark:bg-gray-900/20">
                        <tr v-for="sample in duplicateData.existingDuplicateSamples" :key="`existing-${sample.rowNumber}`">
                          <td class="whitespace-nowrap px-4 py-2 font-medium text-gray-900 dark:text-white">{{ sample.rowNumber }}</td>
                          <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ sample.matchedValue }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p
                    v-if="duplicateExistingCount > (duplicateData.existingDuplicateSamples?.length || 0)"
                    class="border-t border-amber-200/80 px-4 py-2 text-xs text-gray-500 dark:border-amber-800/50"
                  >
                    {{ t('import.importDuplicateExistingMore', { count: duplicateExistingCount - duplicateData.existingDuplicateSamples.length }) }}
                  </p>
                </section>

                <section
                  v-if="duplicateInFileCount > 0"
                  class="overflow-hidden rounded-xl border border-violet-200 dark:border-violet-800/60"
                >
                  <div class="flex items-center justify-between gap-3 border-b border-violet-200/80 bg-violet-50/60 px-4 py-3 dark:border-violet-800/50 dark:bg-violet-900/15">
                    <div>
                      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ t('import.importDuplicateInFileSectionTitle', { count: duplicateInFileCount }) }}
                      </h4>
                      <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                        {{ t('import.importDuplicateInFileSectionDesc') }}
                      </p>
                    </div>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-violet-100 text-sm dark:divide-violet-900/40">
                      <thead class="bg-white/70 dark:bg-gray-900/40">
                        <tr>
                          <th scope="col" class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('import.importDuplicateTableRow') }}</th>
                          <th scope="col" class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('import.importDuplicateTableMatchedValue') }}</th>
                          <th scope="col" class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('import.importDuplicateTableFirstSeenRow') }}</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-violet-100/80 bg-white/40 dark:divide-violet-900/30 dark:bg-gray-900/20">
                        <tr v-for="sample in duplicateData.inFileDuplicateSamples" :key="`infile-${sample.rowNumber}`">
                          <td class="whitespace-nowrap px-4 py-2 font-medium text-gray-900 dark:text-white">{{ sample.rowNumber }}</td>
                          <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ sample.matchedValue }}</td>
                          <td class="whitespace-nowrap px-4 py-2 text-gray-600 dark:text-gray-400">{{ sample.firstSeenRow }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p
                    v-if="duplicateInFileCount > (duplicateData.inFileDuplicateSamples?.length || 0)"
                    class="border-t border-violet-200/80 px-4 py-2 text-xs text-gray-500 dark:border-violet-800/50"
                  >
                    {{ t('import.importDuplicateInFileMore', { count: duplicateInFileCount - duplicateData.inFileDuplicateSamples.length }) }}
                  </p>
                </section>

                <p
                  v-if="duplicateData.samplesTruncated"
                  class="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400"
                >
                  <InformationCircleIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{{ t('import.cSVImportModalDuplicateSamplesTruncated') }}</span>
                </p>
              </div>

              <div v-else class="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/10">
                <p class="text-sm font-medium text-emerald-800 dark:text-emerald-200">{{ t('import.importDuplicateNoMatchesTitle') }}</p>
                <p class="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">{{ t('import.importDuplicateNoMatchesDesc') }}</p>
              </div>

              <div class="space-y-4">
                <fieldset v-if="duplicateExistingCount > 0">
                  <legend class="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                    {{ t('import.importDuplicateExistingHandlingTitle') }}
                  </legend>
                  <div class="space-y-2">
                    <label
                      v-for="opt in duplicateExistingActionOptions"
                      :key="opt.value"
                      class="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors"
                      :class="duplicateAction === opt.value
                        ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-900/20'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50'"
                    >
                      <input v-model="duplicateAction" type="radio" :value="opt.value" class="mt-0.5 text-indigo-600" />
                      <span class="min-w-0">
                        <span class="text-sm font-medium text-gray-900 dark:text-white">{{ opt.label }}</span>
                        <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ opt.hint }}</span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                <div
                  v-if="duplicateInFileCount > 0"
                  class="rounded-lg border border-violet-200/80 bg-violet-50/30 px-4 py-3 dark:border-violet-800/50 dark:bg-violet-900/10"
                >
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('import.importDuplicateInFileHandlingTitle') }}</p>
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('import.importDuplicateInFileHandlingDesc', { count: duplicateInFileCount }) }}</p>
                </div>
              </div>
            </template>
            </div>
          </div>

          <!-- Step 4: Results -->
          <div v-if="step === 3" class="space-y-4">
            <div v-if="showImportProgress" class="space-y-4 py-6">
              <p class="text-center text-sm font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalImportingRecords') }}</p>
              <p class="text-center text-xs text-indigo-600 dark:text-indigo-400">
                {{ t('import.importRecordsProgress', { processed: formattedImportProcessed, total: formattedImportTotal }) }}
              </p>
              <div class="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div class="h-full rounded-full bg-indigo-600 transition-all" :style="{ width: `${importProgressPercent}%` }" />
              </div>
              <p class="text-center text-xs text-gray-500">{{ t('import.cSVImportModalThisMayTakeAMoment') }}</p>
            </div>

            <div v-else-if="importResults" class="space-y-4">
              <div
                class="rounded-lg border px-4 py-3"
                :class="importResultBannerClass"
              >
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ importResultSummary.title }}</p>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ importResultSummary.message }}</p>
                <p v-if="importResults.skipped > 0" class="mt-2 text-xs text-gray-500">{{ t('import.importResultsSkippedHint') }}</p>
              </div>

              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div
                  v-for="metric in importResultMetrics"
                  :key="metric.key"
                  class="rounded-lg border border-gray-200 px-2 py-2.5 text-center dark:border-gray-700"
                >
                  <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ metric.value }}</p>
                  <p class="text-[11px] text-gray-500">{{ metric.label }}</p>
                </div>
              </div>

              <div v-if="displayedImportErrors.length" class="rounded-lg border border-red-200 dark:border-red-800">
                <p class="border-b border-red-200 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-800 dark:text-red-200">
                  {{ t('import.cSVImportModalImportErrors') }}
                </p>
                <ul class="custom-scrollbar max-h-36 divide-y divide-red-100 overflow-y-auto dark:divide-red-900/30">
                  <li v-for="(error, index) in displayedImportErrors" :key="index" class="px-3 py-2 text-xs text-red-800 dark:text-red-200">
                    {{ t('import.cSVImportModalImportRowError', { row: error.row }) }} {{ error.error }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="relative z-10 flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 sm:px-5">
        <button
          v-if="showFooterBack"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          @click="step--"
        >
          <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
          {{ t('performance.back') }}
        </button>
        <div v-else class="w-px" aria-hidden="true" />

        <div class="flex flex-1 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="requestClose"
          >
            {{ importResults ? t('import.cSVImportModalClose') : t('import.cSVImportModalCancel') }}
          </button>

          <button
            v-if="showCheckDuplicatesButton"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="duplicateCheckFields.length === 0"
            @click="checkDuplicates"
          >
            {{ t('import.cSVImportModalCheckDuplicates') }}
          </button>

          <button
            v-if="showRecheckDuplicatesButton"
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="recheckDuplicates"
          >
            {{ t('import.importRecheckDuplicates') }}
          </button>

          <button
            v-if="showImportWithoutCheckButton"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="performImport"
          >
            {{ t('import.cSVImportModalImportNow') }}
          </button>

          <button
            v-if="showPrimaryNextButton"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canProceed"
            @click="nextStep"
          >
            {{ primaryButtonLabel }}
          </button>

          <button
            v-if="importResults"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="$emit('import-complete'); $emit('close')"
          >
            {{ t('import.cSVImportModalDone') }}
          </button>
        </div>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentCheckIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { CheckIcon } from '@heroicons/vue/24/solid';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import ImportFieldDefaultValueInput from '@/components/import/ImportFieldDefaultValueInput.vue';
import { useImportModuleFields } from '@/composables/useImportModuleFields';
import { downloadImportTemplate, formatImportFileSize } from '@/utils/importTemplateUtils';
import {
  shouldStageCsvUpload,
  stageCsvForImport,
  uploadCsvImport,
} from '@/utils/importUploadUtils';
import { useActiveImportsStore } from '@/stores/activeImports';
import { dispatchImportListRefresh } from '@/utils/importListModuleMatch';
import {
  applyImportMappingTemplate,
  buildAutoImportFieldMapping,
  buildColumnRulesFromFieldMapping,
  buildFieldMappingSnapshot,
  importModuleForEntityType,
} from '@/utils/importMappingTemplate';
import { useAuthStore } from '@/stores/auth';
import { ref, reactive, computed, watch, toRef, onMounted, onBeforeUnmount, nextTick } from 'vue';
import apiClient from '@/utils/apiClient';

const authStore = useAuthStore();

const IMPORT_MAX_ROWS = Number(import.meta.env.VITE_IMPORT_MAX_ROWS || 1000000);
const DISPLAYED_IMPORT_ERROR_LIMIT = 100;

const props = defineProps({
  entityType: {
    type: String,
    required: true,
    validator: (value) => ['Contacts', 'Deals', 'Tasks', 'Organizations'].includes(value)
  },
  fileName: {
    type: String,
    default: ''
  },
  allowModuleChange: {
    type: Boolean,
    default: false
  },
  wizardStepOffset: {
    type: Number,
    default: 1
  }
});

const { t } = useI18n();
const activeImportsStore = useActiveImportsStore();

const {
  availableFields,
  requiredImportFields,
  displayFieldOptionGroups,
  fieldsByKey,
  loading: fieldsLoading,
} = useImportModuleFields(toRef(props, 'entityType'));

const emit = defineEmits(['close', 'import-complete', 'change-module']);

const step = ref(0);
const fileName = ref(props.fileName || '');
const fileSizeBytes = ref(0);
const csvData = ref('');
const sourceFile = ref(null);
const stagingId = ref(null);
const stagingUploading = ref(false);
const csvHeaders = ref([]);
const preview = ref([]);
const totalRows = ref(0);
const fieldMapping = reactive({});
const fieldDefaultValues = reactive({});
const isDragOver = ref(false);
const bannerError = ref('');
const showDiscardConfirm = ref(false);
const showBackgroundConfirm = ref(false);
const pendingDiscardAction = ref(null);
const activeImportId = ref(null);
const autoMappedCount = ref(0);
const mappingTemplates = ref([]);
const mappingTemplatesLoading = ref(false);
const selectedTemplateId = ref('');
const appliedTemplateId = ref('');
const appliedTemplateSnapshot = ref('');
const templateApplyReport = ref(null);
const templateApplyNotice = ref(null);
const showSaveMappingTemplateModal = ref(false);
const saveMappingModalMode = ref('create');
const saveTemplateName = ref('');
const saveTemplateIncludeDuplicate = ref(false);
const saveTemplateSetDefault = ref(false);
const saveTemplateError = ref('');
const savingMappingTemplate = ref(false);
const updatingMappingTemplate = ref(false);
const templateReportExpanded = ref(false);

const TEMPLATE_REPORT_PREVIEW_LIMIT = 4;

function countTemplateReportIssues(report) {
  if (!report) return 0;
  return (
    (report.unmatchedHeaders?.length || 0)
    + (report.staleRules?.length || 0)
    + (report.invalidTargetFields?.length || 0)
    + (report.aliasCollisions?.length || 0)
    + (report.ambiguousHeaders?.length || 0)
  );
}

const templateApplyReportIssueCount = computed(() =>
  countTemplateReportIssues(templateApplyReport.value)
);

const templateApplyReportHasWarnings = computed(() => templateApplyReportIssueCount.value > 0);

const templateReportHeadline = computed(() => {
  const report = templateApplyReport.value;
  if (!report) return '';
  const name = templateApplyNotice.value?.templateName || '';
  const matched = report.matched?.length || 0;
  const total = csvHeaders.value.length;
  if (!name) {
    return t('import.savedMappingReportCompactNoName', { matched, total });
  }
  if (templateApplyNotice.value?.source === 'default') {
    return t('import.savedMappingReportCompactDefault', { name, matched, total });
  }
  return t('import.savedMappingReportCompact', { name, matched, total });
});

const templateApplyReportMatchedPreview = computed(() => {
  const rows = templateApplyReport.value?.matched || [];
  if (!rows.length) return '';
  const preview = rows
    .slice(0, TEMPLATE_REPORT_PREVIEW_LIMIT)
    .map((row) => `${row.csvHeader} → ${importFieldLabel(row.targetFieldKey)}`);
  const remaining = rows.length - TEMPLATE_REPORT_PREVIEW_LIMIT;
  if (remaining > 0) {
    preview.push(t('import.savedMappingReportAndMore', { count: remaining }));
  }
  return preview.join(' · ');
});

watch(templateApplyReport, (report) => {
  templateReportExpanded.value = !!report && countTemplateReportIssues(report) > 0;
});

const totalWizardSteps = 5;
const wizardStepNumber = computed(() => props.wizardStepOffset + step.value);

const importModuleKey = computed(() => importModuleForEntityType(props.entityType));

const canCreateImportTemplate = computed(() => authStore.hasPermission('imports', 'create'));

const isTemplateModified = computed(() => {
  if (!appliedTemplateId.value || !appliedTemplateSnapshot.value) return false;
  return buildFieldMappingSnapshot(csvHeaders.value, fieldMapping) !== appliedTemplateSnapshot.value;
});

const showTemplateModifiedActions = computed(
  () => !!appliedTemplateId.value && isTemplateModified.value && canCreateImportTemplate.value
);

function buildTemplateOptionLabel(tpl) {
  const id = String(tpl._id);
  const name = tpl.name || '';
  if (id === appliedTemplateId.value && isTemplateModified.value) {
    return `${name} (${t('import.savedMappingTemplateModifiedSuffix')})`;
  }
  if (tpl.isDefault) {
    return `${name} (${t('import.savedMappingTemplateDefaultSuffix')})`;
  }
  return name;
}

const templateSelectOptions = computed(() =>
  mappingTemplates.value.map((tpl) => ({
    value: String(tpl._id),
    label: buildTemplateOptionLabel(tpl),
  }))
);

const canSaveMappingTemplate = computed(() =>
  Object.values(fieldMapping).some((v) => !!v)
);

function clearTemplateAssociation() {
  appliedTemplateId.value = '';
  appliedTemplateSnapshot.value = '';
  selectedTemplateId.value = '';
  templateApplyReport.value = null;
  templateApplyNotice.value = null;
  templateReportExpanded.value = false;
}

function captureAppliedTemplateContext(template) {
  const id = template?._id ? String(template._id) : '';
  if (!id) {
    clearTemplateAssociation();
    return;
  }
  appliedTemplateId.value = id;
  selectedTemplateId.value = id;
  appliedTemplateSnapshot.value = buildFieldMappingSnapshot(csvHeaders.value, fieldMapping);
}

function importFieldLabel(fieldKey) {
  const field = availableFields.value.find((f) => f.value === fieldKey);
  return field?.displayLabel || field?.label || fieldKey;
}

const mappedFieldValues = computed(() =>
  new Set(Object.values(fieldMapping).filter(Boolean))
);

const unmappedRequiredImportFields = computed(() =>
  requiredImportFields.value.filter((field) => !mappedFieldValues.value.has(field.value))
);

const requiredImportFieldNames = computed(() =>
  requiredImportFields.value.map((field) => field.displayLabel).join(', ')
);

async function loadMappingTemplates() {
  const module = importModuleKey.value;
  if (!module) {
    mappingTemplates.value = [];
    return;
  }
  mappingTemplatesLoading.value = true;
  try {
    const res = await apiClient.get('/imports/mapping-templates', { params: { module } });
    mappingTemplates.value = res?.success && Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error('Failed to load mapping templates:', e);
    mappingTemplates.value = [];
  } finally {
    mappingTemplatesLoading.value = false;
  }
}

function mergeFieldMappingResult(nextMapping) {
  Object.keys(fieldMapping).forEach((k) => delete fieldMapping[k]);
  Object.keys(fieldDefaultValues).forEach((k) => delete fieldDefaultValues[k]);
  for (const header of csvHeaders.value) {
    fieldMapping[header] = nextMapping[header] ?? '';
    fieldDefaultValues[header] = '';
  }
  autoMappedCount.value = csvHeaders.value.filter((h) => !!fieldMapping[h]).length;
}

function buildFieldDefaultValuesPayload() {
  const payload = {};
  for (const header of csvHeaders.value) {
    const mappedField = fieldMapping[header];
    const value = fieldDefaultValues[header];
    if (!mappedField) continue;
    if (value === '' || value === null || value === undefined) continue;
    payload[header] = value;
  }
  return payload;
}

function applyDuplicatePolicyFromTemplate(policy) {
  if (!policy) return;
  if (typeof policy.shouldCheckDuplicates === 'boolean') {
    shouldCheckDuplicates.value = policy.shouldCheckDuplicates;
  }
  if (Array.isArray(policy.duplicateCheckFields)) {
    duplicateCheckFields.value = policy.duplicateCheckFields.filter((f) =>
      availableFields.value.some((af) => af.value === f)
    );
  }
  if (policy.duplicateAction === 'update' || policy.duplicateAction === 'skip') {
    duplicateAction.value = policy.duplicateAction;
  }
  duplicateData.value = null;
}

function setTemplateApplyNotice(template, source) {
  if (!template?.name) {
    templateApplyNotice.value = null;
    return;
  }
  templateApplyNotice.value = {
    source,
    templateName: template.name,
    templateId: template._id ? String(template._id) : '',
  };
}

function applyTemplateResultLocally(template, data, source) {
  mergeFieldMappingResult(data.fieldMapping || {});
  templateApplyReport.value = data.report || null;
  applyDuplicatePolicyFromTemplate(data.duplicatePolicy ?? template.duplicatePolicy);
  setTemplateApplyNotice(template, source);
  captureAppliedTemplateContext(template);
}

async function applyTemplateRecord(template, { trackUsage = true, source = 'manual' } = {}) {
  const fields = availableFields.value;
  if (!fields.length || !csvHeaders.value.length || !template) return;

  if (trackUsage && template._id) {
    try {
      const res = await apiClient.post(`/imports/mapping-templates/${template._id}/apply`, {
        csvHeaders: csvHeaders.value,
      });
      if (res?.success && res.data) {
        applyTemplateResultLocally(template, res.data, source);
        return;
      }
    } catch (e) {
      console.error('Server apply mapping template failed, using local apply:', e);
    }
  }

  const { fieldMapping: nextMapping, report } = applyImportMappingTemplate(
    csvHeaders.value,
    template.columnRules,
    fields
  );
  applyTemplateResultLocally(
    template,
    { fieldMapping: nextMapping, report, duplicatePolicy: template.duplicatePolicy },
    source
  );
}

async function onMappingTemplateSelected(templateId) {
  if (!templateId) {
    clearTemplateAssociation();
    return;
  }

  selectedTemplateId.value = templateId;
  templateApplyReport.value = null;
  templateApplyNotice.value = null;

  const template = mappingTemplates.value.find((tpl) => String(tpl._id) === String(templateId));
  if (template) {
    await applyTemplateRecord(template, { source: 'manual' });
    return;
  }

  try {
    const res = await apiClient.get(`/imports/mapping-templates/${templateId}`);
    if (res?.success && res.data) {
      await applyTemplateRecord(res.data, { source: 'manual' });
    }
  } catch (e) {
    console.error('Apply mapping template failed:', e);
    showBannerError(t('import.savedMappingApplyFailed'));
  }
}

function openSaveMappingTemplateModal(mode = 'create') {
  if (!canSaveMappingTemplate.value) {
    showBannerError(t('import.savedMappingNoMappedFields'));
    return;
  }
  saveMappingModalMode.value = mode;
  saveTemplateName.value = '';
  saveTemplateIncludeDuplicate.value = false;
  saveTemplateSetDefault.value = false;
  saveTemplateError.value = '';
  showSaveMappingTemplateModal.value = true;
}

function openSaveAsNewMappingTemplateModal() {
  openSaveMappingTemplateModal('saveAsNew');
}

async function updateAppliedTemplate() {
  const id = appliedTemplateId.value;
  if (!id || !canSaveMappingTemplate.value) return;

  const allowedKeys = new Set(availableFields.value.map((f) => f.value));
  const columnRules = buildColumnRulesFromFieldMapping(fieldMapping, allowedKeys);
  if (!columnRules.length) {
    showBannerError(t('import.savedMappingNoMappedFields'));
    return;
  }

  updatingMappingTemplate.value = true;
  try {
    const res = await apiClient.patch(`/imports/mapping-templates/${id}`, { columnRules });
    if (!res?.success) {
      showBannerError(res?.message || t('import.savedMappingUpdateFailed'));
      return;
    }
    await loadMappingTemplates();
    const updated = mappingTemplates.value.find((tpl) => String(tpl._id) === id);
    if (updated) {
      captureAppliedTemplateContext(updated);
    } else if (res.data) {
      captureAppliedTemplateContext(res.data);
    } else {
      appliedTemplateSnapshot.value = buildFieldMappingSnapshot(csvHeaders.value, fieldMapping);
    }
  } catch (e) {
    console.error('Update mapping template failed:', e);
    showBannerError(e?.message || t('import.savedMappingUpdateFailed'));
  } finally {
    updatingMappingTemplate.value = false;
  }
}

function closeSaveMappingTemplateModal() {
  showSaveMappingTemplateModal.value = false;
  saveTemplateError.value = '';
}

async function submitSaveMappingTemplate() {
  const name = saveTemplateName.value.trim();
  if (!name) {
    saveTemplateError.value = t('import.savedMappingNameRequired');
    return;
  }
  const module = importModuleKey.value;
  if (!module) return;

  const allowedKeys = new Set(availableFields.value.map((f) => f.value));
  const columnRules = buildColumnRulesFromFieldMapping(fieldMapping, allowedKeys);
  if (!columnRules.length) {
    saveTemplateError.value = t('import.savedMappingNoMappedFields');
    return;
  }

  const body = {
    module,
    name,
    columnRules,
    isDefault: saveTemplateSetDefault.value,
    sampleSourceHeaders: csvHeaders.value,
  };

  if (saveTemplateIncludeDuplicate.value) {
    body.duplicatePolicy = {
      shouldCheckDuplicates: shouldCheckDuplicates.value,
      duplicateCheckFields: [...duplicateCheckFields.value],
      duplicateAction: duplicateAction.value === 'update' ? 'update' : 'skip',
    };
  }

  savingMappingTemplate.value = true;
  saveTemplateError.value = '';
  try {
    const res = await apiClient.post('/imports/mapping-templates', body);
    if (!res?.success) {
      saveTemplateError.value = res?.message || t('import.savedMappingSaveFailed');
      return;
    }
    await loadMappingTemplates();
    if (res.data?._id) {
      captureAppliedTemplateContext(res.data);
    }
    closeSaveMappingTemplateModal();
  } catch (e) {
    console.error('Save mapping template failed:', e);
    saveTemplateError.value = e?.message || t('import.savedMappingSaveFailed');
  } finally {
    savingMappingTemplate.value = false;
  }
}

const fileMetaLabel = computed(() => {
  if (!totalRows.value && !fileSizeBytes.value) return '';
  return t('import.importFileMeta', {
    rows: totalRows.value,
    size: formatImportFileSize(fileSizeBytes.value),
  });
});

const mappingStats = computed(() => {
  const total = csvHeaders.value.length;
  const mapped = csvHeaders.value.filter((header) => !!fieldMapping[header]).length;
  return {
    total,
    mapped,
    percent: total ? Math.round((mapped / total) * 100) : 0,
  };
});

const showImportProgress = computed(() => {
  if (importResults.value) return false;
  return importing.value || !!activeImportId.value;
});

const importInProgress = computed(() => showImportProgress.value);

const importProgressPercent = computed(() => {
  const { processed, total } = importProgress.value;
  if (!total) return 0;
  return Math.min(100, Math.round((processed / total) * 100));
});

const formattedImportProcessed = computed(() =>
  (importProgress.value.processed ?? 0).toLocaleString()
);

const formattedImportTotal = computed(() =>
  (importProgress.value.total ?? 0).toLocaleString()
);

const importResultSummary = computed(() => {
  const r = importResults.value;
  if (!r) {
    return { variant: 'success', title: '', message: '' };
  }

  const created = r.created || 0;
  const updated = r.updated || 0;
  const skipped = r.skipped || 0;
  const failed = r.failed || 0;
  const succeeded = created + updated + skipped;

  if (failed > 0 && created === 0 && updated === 0 && skipped === 0) {
    return {
      variant: 'error',
      title: t('import.importResultsFailedTitle'),
      message: t('import.importResultsFailedMessage', { failed }),
    };
  }

  if (skipped > 0 && created === 0 && updated === 0 && failed === 0) {
    return {
      variant: 'warning',
      title: t('import.importResultsAllSkippedTitle'),
      message: t('import.importResultsAllSkippedMessage', { count: skipped }),
    };
  }

  if (failed > 0) {
    return {
      variant: 'warning',
      title: t('import.importResultsPartialErrorsTitle'),
      message: t('import.importResultsPartialErrorsMessage', { succeeded, failed }),
    };
  }

  if (skipped > 0) {
    const skippedPart = t('import.importResultsSuccessMixedSkipped', { count: skipped });
    return {
      variant: 'info',
      title: t('import.importResultsSuccessTitle'),
      message: t('import.importResultsSuccessMixed', { created, updated, skippedPart }),
    };
  }

  const parts = [];
  if (created > 0) parts.push(t('import.importResultsSuccessCreated', { count: created }));
  if (updated > 0) parts.push(t('import.importResultsSuccessUpdated', { count: updated }));

  return {
    variant: 'success',
    title: t('import.importResultsSuccessTitle'),
    message: parts.join(' ') || t('import.cSVImportModalAllRecordsImportedSuccessfully'),
  };
});

function setFieldMapping(header, value) {
  if (fieldMapping[header] !== value) {
    fieldDefaultValues[header] = '';
  }
  if (value) {
    for (const otherHeader of csvHeaders.value) {
      if (otherHeader !== header && fieldMapping[otherHeader] === value) {
        fieldMapping[otherHeader] = '';
        fieldDefaultValues[otherHeader] = '';
      }
    }
  }
  fieldMapping[header] = value;
}

function setFieldDefaultValue(header, value) {
  fieldDefaultValues[header] = value;
}

const updateExisting = ref(false);
const importing = ref(false);
const importProgress = ref({ processed: 0, total: 0 });
const importResults = ref(null);
const checkingDuplicates = ref(false);
const duplicateData = ref(null);
const duplicateAction = ref('skip'); // 'skip' | 'update'
const duplicateCheckFields = ref([]);
const shouldCheckDuplicates = ref(true);
const showFieldDropdown = ref(false);
const duplicateFieldTriggerRef = ref(null);
const duplicateFieldMenuRef = ref(null);
const duplicateFieldMenuStyle = ref({});
const importModalBodyRef = ref(null);
const duplicateScanSectionRef = ref(null);

let duplicateFieldDropdownListenersBound = false;

function syncDuplicateFieldMenuPosition() {
  const el = duplicateFieldTriggerRef.value;
  if (!el?.getBoundingClientRect) return;

  const rect = el.getBoundingClientRect();
  const gap = 4;
  const footerReserve = 88;
  const spaceBelow = window.innerHeight - rect.bottom - gap - footerReserve;
  const spaceAbove = rect.top - gap - 16;
  const preferredMax = 288;
  const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;

  if (openUp) {
    const maxHeight = Math.min(preferredMax, Math.max(120, spaceAbove));
    duplicateFieldMenuStyle.value = {
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      bottom: `${window.innerHeight - rect.top + gap}px`,
      maxHeight: `${maxHeight}px`,
    };
  } else {
    const maxHeight = Math.min(preferredMax, Math.max(120, spaceBelow));
    duplicateFieldMenuStyle.value = {
      top: `${rect.bottom + gap}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      maxHeight: `${maxHeight}px`,
    };
  }
}

function onDuplicateFieldPointerDown(event) {
  if (!showFieldDropdown.value) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  const trigger = duplicateFieldTriggerRef.value;
  const menu = duplicateFieldMenuRef.value;
  if (trigger?.contains(target) || menu?.contains(target)) return;
  showFieldDropdown.value = false;
}

function bindDuplicateFieldDropdownListeners() {
  if (duplicateFieldDropdownListenersBound) return;
  duplicateFieldDropdownListenersBound = true;
  document.addEventListener('pointerdown', onDuplicateFieldPointerDown, true);
  window.addEventListener('scroll', syncDuplicateFieldMenuPosition, true);
  window.addEventListener('resize', syncDuplicateFieldMenuPosition);
}

function unbindDuplicateFieldDropdownListeners() {
  if (!duplicateFieldDropdownListenersBound) return;
  duplicateFieldDropdownListenersBound = false;
  document.removeEventListener('pointerdown', onDuplicateFieldPointerDown, true);
  window.removeEventListener('scroll', syncDuplicateFieldMenuPosition, true);
  window.removeEventListener('resize', syncDuplicateFieldMenuPosition);
}

function toggleDuplicateFieldDropdown() {
  showFieldDropdown.value = !showFieldDropdown.value;
}

watch(showFieldDropdown, async (open) => {
  if (open) {
    await nextTick();
    syncDuplicateFieldMenuPosition();
    bindDuplicateFieldDropdownListeners();
  } else {
    unbindDuplicateFieldDropdownListeners();
  }
});

const steps = computed(() => [
  { title: t('import.cSVImportModalStepUploadTitle'), shortTitle: t('import.cSVImportModalStepUploadShort'), description: t('import.cSVImportModalStepUploadDesc') },
  { title: t('import.cSVImportModalStepMapTitle'), shortTitle: t('import.cSVImportModalStepMapShort'), description: t('import.cSVImportModalStepMapDesc') },
  { title: t('import.cSVImportModalStepDuplicatesTitle'), shortTitle: t('import.cSVImportModalStepDuplicatesShort'), description: t('import.cSVImportModalStepDuplicatesDesc') },
  { title: t('import.cSVImportModalStepResultsTitle'), shortTitle: t('import.cSVImportModalStepResultsShort'), description: t('import.cSVImportModalStepResultsDesc') },
]);

const stepperItems = computed(() =>
  steps.value.map((s, index) => ({
    id: `import-step-${index}`,
    label: s.shortTitle || s.title,
    hint: s.description,
  }))
);

function importStepCircleClass(idx) {
  if (idx < step.value) {
    return 'border-indigo-600 bg-indigo-600 text-white';
  }
  if (idx === step.value) {
    return 'border-indigo-600 bg-white text-indigo-600 dark:border-indigo-500 dark:bg-gray-900 dark:text-indigo-400';
  }
  return 'border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-500';
}

const currentStepShortTitle = computed(() => steps.value[step.value]?.shortTitle || '');

const currentStepDescription = computed(() => steps.value[step.value]?.description || '');

const importHeaderStepLine = computed(() => {
  if (props.wizardStepOffset > 1) {
    return t('import.importWizardHeaderStep', {
      current: wizardStepNumber.value,
      total: totalWizardSteps,
    });
  }
  return t('import.importWizardHeaderStep', {
    current: step.value + 1,
    total: steps.value.length,
  });
});

const importWizardProgressAriaLabel = computed(() =>
  t('import.importWizardProgressAria', {
    current: step.value + 1,
    total: steps.value.length,
    step: currentStepShortTitle.value,
  })
);

const duplicateExistingCount = computed(() => {
  const d = duplicateData.value;
  if (!d) return 0;
  if (typeof d.existingDuplicates === 'number') return d.existingDuplicates;
  return d.duplicates ?? 0;
});

const duplicateInFileCount = computed(() => {
  const d = duplicateData.value;
  if (!d) return 0;
  return d.inFileDuplicates ?? 0;
});

const duplicateHasAnyMatches = computed(() =>
  duplicateExistingCount.value > 0 || duplicateInFileCount.value > 0
);

const duplicateExistingActionOptions = computed(() => {
  if (!duplicateData.value) return [];
  const existingCount = duplicateExistingCount.value;
  return [
    {
      value: 'skip',
      label: t('import.cSVImportModalSkipDuplicates'),
      hint: t('import.importDuplicateSkipExistingHint', { count: existingCount }),
    },
    {
      value: 'update',
      label: t('import.cSVImportModalUpdateExistingRecords'),
      hint: t('import.importDuplicateUpdateExistingHint', { count: existingCount }),
    },
  ];
});

const showFooterBack = computed(() =>
  step.value > 0 && !importInProgress.value && !importResults.value && !checkingDuplicates.value
);

const showCheckDuplicatesButton = computed(() =>
  step.value === 2
  && shouldCheckDuplicates.value
  && !duplicateData.value
  && !importInProgress.value
  && !importResults.value
  && !checkingDuplicates.value
);

const showRecheckDuplicatesButton = computed(() =>
  step.value === 2
  && shouldCheckDuplicates.value
  && duplicateData.value
  && !importInProgress.value
  && !importResults.value
  && !checkingDuplicates.value
);

const showImportWithoutCheckButton = computed(() =>
  step.value === 2
  && !shouldCheckDuplicates.value
  && !duplicateData.value
  && !importInProgress.value
  && !importResults.value
);

const showPrimaryNextButton = computed(() =>
  (step.value < 2 || (step.value === 2 && duplicateData.value))
  && !importInProgress.value
  && !importResults.value
);

const primaryButtonLabel = computed(() => {
  if (step.value === 0 || step.value === 1) return t('import.cSVImportModalNext');
  return t('import.cSVImportModalImportNow');
});

const importResultBannerClass = computed(() => {
  const variant = importResultSummary.value.variant;
  if (variant === 'success') return 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20';
  if (variant === 'warning') return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20';
  if (variant === 'info') return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
  return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
});

const importResultMetrics = computed(() => {
  const r = importResults.value;
  if (!r) return [];
  return [
    { key: 'created', value: r.created || 0, label: t('forms.hubColCreated') },
    { key: 'updated', value: r.updated || 0, label: t('import.cSVImportModalUpdated') },
    { key: 'skipped', value: r.skipped || 0, label: t('import.importResultsSkipped') },
    { key: 'failed', value: r.failed || 0, label: t('process.execFailed') },
  ];
});

const displayedImportErrors = computed(() =>
  (importResults.value?.errors || []).slice(0, DISPLAYED_IMPORT_ERROR_LIMIT)
);

/** Composite presets (server-supported keys) plus any extra mapped module fields. */
function buildDuplicateCompositePresets(entityType, mapped) {
  const presets = [];

  if (entityType === 'Contacts') {
    if (mapped.has('email')) {
      presets.push({
        value: 'email',
        label: t('import.importDupPresetEmail'),
        description: t('import.importDupDescRecommended'),
        recommended: true,
      });
    }
    if (mapped.has('phone')) {
      presets.push({
        value: 'phone',
        label: t('import.importDupPresetPhone'),
        description: t('import.importDupDescAlternative'),
        recommended: false,
      });
    }
    if (mapped.has('first_name') && mapped.has('last_name')) {
      presets.push({
        value: 'full_name',
        label: t('import.importDupPresetFullName'),
        description: t('import.importDupDescNameMatch'),
        recommended: false,
      });
    }
    if (mapped.has('email') && mapped.has('company')) {
      presets.push({
        value: 'email_company',
        label: t('import.importDupPresetEmailCompany'),
        description: t('import.importDupDescStrictMatch'),
        recommended: false,
      });
    }
    if (mapped.has('phone') && mapped.has('company')) {
      presets.push({
        value: 'phone_company',
        label: t('import.importDupPresetPhoneCompany'),
        description: t('import.importDupDescStrictMatch'),
        recommended: false,
      });
    }
  } else if (entityType === 'Deals') {
    if (mapped.has('name')) {
      presets.push({
        value: 'name',
        label: t('import.importDupPresetDealName'),
        description: t('import.importDupDescRecommended'),
        recommended: true,
      });
    }
    if (mapped.has('name') && mapped.has('amount')) {
      presets.push({
        value: 'name_amount',
        label: t('import.importDupPresetNameAmount'),
        description: t('import.importDupDescStrictMatch'),
        recommended: false,
      });
    }
    if (mapped.has('name') && mapped.has('stage')) {
      presets.push({
        value: 'name_stage',
        label: t('import.importDupPresetNameStage'),
        description: t('import.importDupDescStrictMatch'),
        recommended: false,
      });
    }
  } else if (entityType === 'Tasks') {
    if (mapped.has('title')) {
      presets.push({
        value: 'title',
        label: t('import.importDupPresetTitle'),
        description: t('import.importDupDescRecommended'),
        recommended: true,
      });
    }
  } else if (entityType === 'Organizations') {
    if (mapped.has('name')) {
      presets.push({
        value: 'name',
        label: t('import.importDupPresetOrgName'),
        description: t('import.importDupDescRecommended'),
        recommended: true,
      });
    }
  }

  return presets;
}

const duplicateCheckableFields = computed(() => {
  const mapped = new Set(Object.values(fieldMapping).filter((v) => v));
  const presets = buildDuplicateCompositePresets(props.entityType, mapped);
  const presetValues = new Set(presets.map((p) => p.value));

  const extraFields = availableFields.value
    .filter((field) => mapped.has(field.value) && !presetValues.has(field.value))
    .map((field) => ({
      label: field.displayLabel,
      value: field.value,
      description: t('import.importDupDescMappedField'),
      recommended: false,
    }));

  return [...presets, ...extraFields];
});

function duplicateFieldLabel(fieldValue) {
  return duplicateCheckableFields.value.find((f) => f.value === fieldValue)?.label || fieldValue;
}

function removeDuplicateCheckField(fieldValue) {
  duplicateCheckFields.value = duplicateCheckFields.value.filter((f) => f !== fieldValue);
}

const canProceed = computed(() => {
  if (step.value === 0) {
    return (csvData.value || stagingId.value) && csvHeaders.value.length > 0 && !stagingUploading.value;
  }
  if (step.value === 1) {
    if (!Object.values(fieldMapping).some((v) => v)) return false;
    return unmappedRequiredImportFields.value.length === 0;
  }
  if (step.value === 2) {
    // If checking duplicates, must have fields selected and data checked
    if (shouldCheckDuplicates.value) {
      return duplicateCheckFields.value.length > 0 && duplicateData.value !== null;
    }
    // If not checking duplicates, always can proceed
    return true;
  }
  return false;
});

const hasProgress = computed(() => {
  if (importResults.value) return false;
  return !!(csvData.value || stagingId.value || step.value > 0);
});

const requestClose = () => {
  if (checkingDuplicates.value) return;
  if (importInProgress.value && activeImportId.value) {
    showBackgroundConfirm.value = true;
    return;
  }
  if (importInProgress.value) return;
  if (hasProgress.value) {
    pendingDiscardAction.value = 'close';
    showDiscardConfirm.value = true;
    return;
  }
  emit('close');
};

const confirmRunInBackground = () => {
  showBackgroundConfirm.value = false;
  if (activeImportId.value) {
    activeImportsStore.releaseImportToBanner(activeImportId.value);
  }
  emit('close');
};

const requestChangeModule = () => {
  if (importInProgress.value || checkingDuplicates.value) return;
  if (hasProgress.value) {
    pendingDiscardAction.value = 'change-module';
    showDiscardConfirm.value = true;
    return;
  }
  emit('change-module');
};

const confirmDiscard = () => {
  showDiscardConfirm.value = false;
  const action = pendingDiscardAction.value;
  pendingDiscardAction.value = null;
  if (action === 'change-module') {
    emit('change-module');
  } else {
    emit('close');
  }
};

const showBannerError = (message) => {
  bannerError.value = message;
};

const handleDownloadTemplate = () => {
  downloadImportTemplate(props.entityType, availableFields.value);
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  processSelectedFile(file);
};

const handleFileDrop = (event) => {
  isDragOver.value = false;
  const file = event.dataTransfer.files[0];
  if (!file || !file.name.toLowerCase().endsWith('.csv')) {
    showBannerError(t('import.cSVImportModalToastPleaseUploadACsvFile'));
    return;
  }
  processSelectedFile(file);
};

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function stageSelectedFile(file) {
  try {
    stagingUploading.value = true;
    const staged = await stageCsvForImport(file);
    stagingId.value = staged.stagingId;
    csvHeaders.value = staged.headers || [];
    preview.value = staged.preview || [];
    totalRows.value = staged.totalRows || 0;
    csvData.value = '';
    await applyInitialFieldMapping();
  } catch (error) {
    console.error('Error staging CSV:', error);
    showBannerError(error.message || t('import.importStagingFailed'));
    clearFile();
  } finally {
    stagingUploading.value = false;
  }
}

const processSelectedFile = async (file) => {
  bannerError.value = '';
  fileName.value = file.name;
  fileSizeBytes.value = file.size;
  sourceFile.value = file;
  stagingId.value = null;

  if (shouldStageCsvUpload(file.size)) {
    await stageSelectedFile(file);
    return;
  }

  try {
    const text = await readFileAsText(file);
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length === 0) {
      showBannerError(t('import.cSVImportModalToastCsvFileIsEmpty'));
      clearFile();
      return;
    }

    const rowCount = lines.length - 1;
    if (shouldStageCsvUpload(file.size, rowCount)) {
      await stageSelectedFile(file);
      return;
    }

    csvData.value = text;
    await applyParsedCsvFromLines(lines);
  } catch (error) {
    console.error('Error reading CSV:', error);
    showBannerError(t('import.cSVImportModalToastErrorParsingCsvFilePlease'));
    clearFile();
  }
};

function applyAutoFieldMappingOnly() {
  clearTemplateAssociation();
  const fields = availableFields.value;
  if (!csvHeaders.value.length || !fields.length) {
    Object.keys(fieldMapping).forEach((k) => delete fieldMapping[k]);
    Object.keys(fieldDefaultValues).forEach((k) => delete fieldDefaultValues[k]);
    autoMappedCount.value = 0;
    return;
  }
  mergeFieldMappingResult(buildAutoImportFieldMapping(csvHeaders.value, fields));
}

async function applyInitialFieldMapping() {
  if (!csvHeaders.value.length || !availableFields.value.length) {
    autoMappedCount.value = 0;
    return;
  }
  if (importModuleKey.value) {
    await loadMappingTemplates();
  }
  const defaultTemplate = mappingTemplates.value.find((tpl) => tpl.isDefault);
  if (defaultTemplate) {
    await applyTemplateRecord(defaultTemplate, { trackUsage: true, source: 'default' });
    return;
  }
  applyAutoFieldMappingOnly();
}

watch(availableFields, async () => {
  if (!csvHeaders.value.length || !availableFields.value.length) return;
  const hasAnyMapping = csvHeaders.value.some((h) => !!fieldMapping[h]);
  if (!hasAnyMapping) await applyInitialFieldMapping();
});

watch(
  () => props.entityType,
  () => {
    clearTemplateAssociation();
    loadMappingTemplates();
  },
  { immediate: true }
);

watch(step, (s) => {
  if (s === 1 && importModuleKey.value) {
    loadMappingTemplates();
  }
});

/** Drop inline CSV / file blobs once the server has the payload (reduces memory during long imports). */
function releaseCsvPayload() {
  csvData.value = '';
  sourceFile.value = null;
  preview.value = [];
}

const clearFile = () => {
  fileName.value = '';
  fileSizeBytes.value = 0;
  releaseCsvPayload();
  stagingId.value = null;
  csvHeaders.value = [];
  totalRows.value = 0;
  autoMappedCount.value = 0;
  bannerError.value = '';
  Object.keys(fieldMapping).forEach((k) => delete fieldMapping[k]);
  Object.keys(fieldDefaultValues).forEach((k) => delete fieldDefaultValues[k]);
  clearTemplateAssociation();
};

function resetImportHeavyState() {
  releaseCsvPayload();
  duplicateData.value = null;
  importResults.value = null;
  stagingId.value = null;
};

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

async function applyParsedCsvFromLines(lines) {
  csvHeaders.value = parseCSVLine(lines[0]);
  await applyInitialFieldMapping();

  preview.value = lines.slice(1, 6).map((line) => {
    const values = parseCSVLine(line);
    const row = {};
    csvHeaders.value.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });

  totalRows.value = lines.length - 1;
}

const parseCSV = async () => {
  try {
    const lines = csvData.value.split('\n').filter((line) => line.trim());
    if (lines.length === 0) {
      showBannerError(t('import.cSVImportModalToastCsvFileIsEmpty'));
      clearFile();
      return;
    }

    await applyParsedCsvFromLines(lines);
  } catch (error) {
    console.error('Error parsing CSV:', error);
    showBannerError(t('import.cSVImportModalToastErrorParsingCsvFilePlease'));
    clearFile();
  }
};

const nextStep = async () => {
  if (step.value === 2 && duplicateData.value) {
    await performImport();
    return;
  }

  step.value++;
};

async function scrollToDuplicateScanSection() {
  await nextTick();
  const body = importModalBodyRef.value;
  const section = duplicateScanSectionRef.value;
  if (!body || !section) return;

  const bodyTop = body.getBoundingClientRect().top;
  const sectionTop = section.getBoundingClientRect().top;
  body.scrollTo({
    top: body.scrollTop + (sectionTop - bodyTop) - 12,
    behavior: 'smooth',
  });
}

const recheckDuplicates = async () => {
  duplicateData.value = null;
  await checkDuplicates();
};

const checkDuplicates = async () => {
  try {
    checkingDuplicates.value = true;
    showFieldDropdown.value = false;
    await scrollToDuplicateScanSection();

    const entityTypeMap = {
      'Contacts': 'contacts',
      'Deals': 'deals',
      'Tasks': 'tasks',
      'Organizations': 'organizations'
    };
    const endpoint = `/csv/check-duplicates/${entityTypeMap[props.entityType] || 'contacts'}`;
    
    const response = await apiClient.post(endpoint, {
      fieldMapping: fieldMapping,
      fieldDefaultValues: buildFieldDefaultValuesPayload(),
      checkFields: duplicateCheckFields.value,
      ...(stagingId.value
        ? { stagingId: stagingId.value }
        : { csvData: csvData.value }),
    });

    if (response.success) {
      duplicateData.value = response.data;
      duplicateAction.value = 'skip';
    }
  } catch (error) {
    console.error('Error checking duplicates:', error);
    showBannerError(t('import.cSVImportModalToastErrorCheckingForDuplicatesPlease'));
  } finally {
    checkingDuplicates.value = false;
    await scrollToDuplicateScanSection();
  }
};

const performImport = async () => {
  const mapImportRecordToResults = (record) => ({
    total: record.stats?.total ?? 0,
    created: record.stats?.created ?? 0,
    updated: record.stats?.updated ?? 0,
    skipped: record.stats?.skipped ?? 0,
    failed: record.stats?.failed ?? 0,
    errors: (record.importErrors ?? []).slice(0, DISPLAYED_IMPORT_ERROR_LIMIT),
    importId: record._id,
  });

  if (totalRows.value > IMPORT_MAX_ROWS) {
    showBannerError(t('import.importRowLimitExceeded', {
      count: totalRows.value.toLocaleString(),
      max: IMPORT_MAX_ROWS.toLocaleString(),
    }));
    return;
  }

  try {
    importing.value = true;
    step.value = 3;
    importProgress.value = { processed: 0, total: totalRows.value };
    activeImportId.value = null;

    const entityTypeMap = {
      'Contacts': 'contacts',
      'Deals': 'deals',
      'Tasks': 'tasks',
      'Organizations': 'organizations'
    };
    const endpoint = `/csv/import/${entityTypeMap[props.entityType] || 'contacts'}`;
    
    const importWithDuplicateCheck = shouldCheckDuplicates.value && !!duplicateData.value;
    const resolvedDuplicateAction = importWithDuplicateCheck
      ? (duplicateAction.value === 'update' ? 'update' : 'skip')
      : 'skip';

    const config = {
      fieldMapping: fieldMapping,
      fieldDefaultValues: buildFieldDefaultValuesPayload(),
      duplicateAction: resolvedDuplicateAction,
      fileName: fileName.value,
      shouldCheckDuplicates: importWithDuplicateCheck,
      duplicateCheckFields: importWithDuplicateCheck ? duplicateCheckFields.value : [],
    };

    let response;
    if (stagingId.value) {
      response = await apiClient.post(endpoint, {
        ...config,
        stagingId: stagingId.value,
      });
    } else if (sourceFile.value && shouldStageCsvUpload(fileSizeBytes.value, totalRows.value)) {
      response = await uploadCsvImport(endpoint, sourceFile.value, config);
    } else if (sourceFile.value && csvData.value) {
      response = await apiClient.post(endpoint, {
        ...config,
        csvData: csvData.value,
      });
    } else if (sourceFile.value) {
      response = await uploadCsvImport(endpoint, sourceFile.value, config);
    } else {
      response = await apiClient.post(endpoint, {
        ...config,
        csvData: csvData.value,
      });
    }

    if (!response.success) return;

    releaseCsvPayload();

    if (response.data?.accepted) {
      const importId = String(response.data.importId);
      activeImportId.value = importId;
      importProgress.value.total = response.data.total ?? totalRows.value;

      activeImportsStore.trackImport({
        importId,
        fileName: fileName.value,
        module: entityTypeMap[props.entityType] || 'contacts',
        total: importProgress.value.total,
      });
      activeImportsStore.pinImportToModal(importId);

      void activeImportsStore.waitForImport(importId).then((record) => {
        importResults.value = mapImportRecordToResults(record);
        if (record.status === 'failed') {
          showBannerError(t('import.cSVImportModalToastErrorImportingDataPleaseTry'));
          step.value = 2;
          importResults.value = null;
        }
      }).finally(() => {
        activeImportId.value = null;
        importing.value = false;
      });

      return;
    } else {
      const data = response.data || {};
      importResults.value = {
        ...data,
        errors: (data.errors ?? []).slice(0, DISPLAYED_IMPORT_ERROR_LIMIT),
      };
    }
  } catch (error) {
    console.error('Error importing:', error);
    const limitCode = error.response?.data?.code;
    if (limitCode === 'IMPORT_ROW_LIMIT_EXCEEDED') {
      const maxRows = error.response?.data?.maxRows ?? IMPORT_MAX_ROWS;
      showBannerError(t('import.importRowLimitExceeded', {
        count: Number(error.response?.data?.rowCount || totalRows.value).toLocaleString(),
        max: Number(maxRows).toLocaleString(),
      }));
    } else if (limitCode === 'IMPORT_INLINE_LIMIT_EXCEEDED') {
      showBannerError(t('import.importInlineLimitExceeded'));
    } else {
      showBannerError(t('import.cSVImportModalToastErrorImportingDataPleaseTry'));
    }
    step.value = 2;
  } finally {
    if (!activeImportId.value) {
      importing.value = false;
    }
  }
};

watch(
  () => (activeImportId.value ? activeImportsStore.getImport(activeImportId.value) : null),
  (item) => {
    if (!item) return;
    importProgress.value = {
      processed: item.processed ?? 0,
      total: item.total ?? importProgress.value.total,
    };
  },
  { deep: true }
);

watch(importResults, (results) => {
  if (!results) return;
  // Background jobs dispatch from activeImports when the job finishes.
  if (activeImportId.value) return;
  const entityTypeMap = {
    Contacts: 'contacts',
    Deals: 'deals',
    Tasks: 'tasks',
    Organizations: 'organizations',
  };
  dispatchImportListRefresh({
    module: entityTypeMap[props.entityType] || 'contacts',
    status: 'completed',
  });
});

const toggleDuplicateCheckField = (fieldValue, event) => {
  const isChecked = !!event?.target?.checked;
  if (isChecked) {
    if (!duplicateCheckFields.value.includes(fieldValue)) {
      duplicateCheckFields.value = [...duplicateCheckFields.value, fieldValue];
    }
    return;
  }
  duplicateCheckFields.value = duplicateCheckFields.value.filter(f => f !== fieldValue);
};

// Reset duplicate results when toggling duplicate check off/on or changing check fields
watch(shouldCheckDuplicates, () => {
  if (step.value === 2 && !checkingDuplicates.value) {
    duplicateData.value = null;
  }
});

watch(duplicateCheckFields, () => {
  if (step.value === 2 && duplicateData.value && !checkingDuplicates.value) {
    duplicateData.value = null;
  }
}, { deep: true });

// Keep duplicate check field selection in sync with mapped columns
watch(duplicateCheckableFields, (newFields) => {
  const valid = new Set(newFields.map((f) => f.value));
  const pruned = duplicateCheckFields.value.filter((v) => valid.has(v));
  if (pruned.length !== duplicateCheckFields.value.length) {
    duplicateCheckFields.value = pruned;
  }
  if (newFields.length > 0 && duplicateCheckFields.value.length === 0) {
    const recommended = newFields.find((f) => f.recommended) || newFields[0];
    duplicateCheckFields.value = [recommended.value];
  }
}, { immediate: true });

function onEscapeKey(event) {
  if (event.key !== 'Escape') return;
  if (showDiscardConfirm.value) {
    showDiscardConfirm.value = false;
    pendingDiscardAction.value = null;
    return;
  }
  requestClose();
}

onMounted(() => {
  document.addEventListener('keydown', onEscapeKey);
});

onBeforeUnmount(() => {
  if (activeImportId.value) {
    activeImportsStore.releaseImportToBanner(activeImportId.value);
  }
  document.removeEventListener('keydown', onEscapeKey);
  unbindDuplicateFieldDropdownListeners();
  resetImportHeavyState();
});
</script>

<style scoped>
/* Custom Scrollbar Styling */
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background-color: #f3f4f6;
  border-radius: 9999px;
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-track {
  background-color: #1f2937;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #a78bfa;
  border-radius: 9999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #6049E7;
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #5037d9;
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #6049E7;
}

</style>

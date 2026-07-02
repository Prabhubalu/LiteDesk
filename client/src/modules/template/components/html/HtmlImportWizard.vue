<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-[60]" @close="emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-900/50" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-4xl rounded-xl bg-white dark:bg-gray-900 shadow-xl">
              <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('templates.htmlImport.wizardTitle') }}
                </DialogTitle>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {{ stepLabel }}
                </p>
              </div>

              <div class="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
                <div v-if="step === 'source'" class="space-y-4">
                  <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                    <button
                      type="button"
                      class="rounded-md px-3 py-1.5 text-sm"
                      :class="sourceTab === 'paste'
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-600 dark:text-gray-300'"
                      @click="sourceTab = 'paste'"
                    >
                      {{ t('templates.htmlImport.tabPaste') }}
                    </button>
                    <button
                      type="button"
                      class="rounded-md px-3 py-1.5 text-sm"
                      :class="sourceTab === 'upload'
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-600 dark:text-gray-300'"
                      @click="sourceTab = 'upload'"
                    >
                      {{ t('templates.htmlImport.tabUpload') }}
                    </button>
                  </div>

                  <HtmlCodeEditor
                    v-if="sourceTab === 'paste'"
                    v-model="htmlSource"
                    :use-monaco="true"
                    :placeholder="t('templates.htmlImport.pastePlaceholder')"
                  />

                  <div v-else class="space-y-3">
                    <label
                      class="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 px-6 py-8 text-center"
                    >
                      <input
                        type="file"
                        accept=".html,.htm,text/html"
                        class="sr-only"
                        @change="onFileSelected"
                      />
                      <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {{ t('templates.htmlImport.uploadPrompt') }}
                      </span>
                      <span class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {{ t('templates.htmlImport.uploadHint') }}
                      </span>
                    </label>
                    <HtmlCodeEditor
                      v-if="htmlSource"
                      v-model="htmlSource"
                      :use-monaco="true"
                      :placeholder="t('templates.htmlImport.pastePlaceholder')"
                    />
                  </div>

                  <p
                    v-if="!htmlSource.trim()"
                    class="text-sm text-amber-700 dark:text-amber-300"
                    role="status"
                  >
                    {{ t('templates.htmlImport.emptySourceValidation') }}
                  </p>

                  <div v-if="mode !== 'replace'">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {{ t('templates.fieldName') }}
                    </label>
                    <input
                      v-model="templateName"
                      type="text"
                      class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>

                  <p v-if="analysisError" class="text-sm text-red-600 dark:text-red-400">
                    {{ analysisError }}
                  </p>
                </div>

                <div v-else-if="step === 'analysis' && analysisResult" class="space-y-5">
                  <HtmlAnalysisReport :result="analysisResult" />
                  <HubspotConditionalPanel
                    v-if="(analysisResult.counts?.hubspotConditionals || 0) > 0"
                    :count="analysisResult.counts?.hubspotConditionals || 0"
                    :mode="hubspotConditionalMode"
                    @update:mode="onHubspotModeChange"
                  />
                  <p
                    v-if="orgMappingsApplied > 0"
                    class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                  >
                    {{ t('templates.htmlImport.orgMappingsApplied', { count: orgMappingsApplied }) }}
                  </p>
                  <MergeTagMappingTable
                    :tags="analysisResult.mergeTags"
                    :mappings="mergeMappings"
                    :module-options="moduleOptions"
                    @update:mappings="onMappingsUpdate"
                  />
                </div>

                <div v-else-if="step === 'confirm' && analysisResult" class="space-y-4">
                  <div
                    class="rounded-lg border px-4 py-3 text-sm"
                    :class="analysisResult.checks.htmlValid
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100'
                      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100'"
                  >
                    {{ confirmSummary }}
                  </div>
                  <EmailPreviewFrame
                    :html="analysisResult.sanitizedHtml"
                    :css="analysisResult.css"
                    viewport="desktop"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <button
                  type="button"
                  class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600"
                  @click="handleCancel"
                >
                  {{ step === 'source' ? t('actions.cancel') : t('templates.htmlImport.back') }}
                </button>
                <div class="flex gap-2">
                  <button
                    v-if="step === 'source'"
                    type="button"
                    class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    :disabled="analyzing || !htmlSource.trim()"
                    @click="handleAnalyze"
                  >
                    {{ analyzing ? t('templates.htmlImport.analyzing') : t('templates.htmlImport.analyze') }}
                  </button>
                  <button
                    v-else-if="step === 'analysis'"
                    type="button"
                    class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    :disabled="analyzing"
                    @click="handleContinueToConfirm"
                  >
                    {{ t('templates.htmlImport.continue') }}
                  </button>
                  <button
                    v-else
                    type="button"
                    class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    :disabled="importing || (mode !== 'replace' && !templateName.trim())"
                    @click="handleImport"
                  >
                    {{ importing ? t('states.loading') : (mode === 'replace' ? t('templates.htmlImport.applyHtml') : t('templates.htmlImport.importOpen')) }}
                  </button>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import HtmlCodeEditor from './HtmlCodeEditor.vue';
import HubspotConditionalPanel from './HubspotConditionalPanel.vue';
import HtmlAnalysisReport from './HtmlAnalysisReport.vue';
import MergeTagMappingTable from './MergeTagMappingTable.vue';
import EmailPreviewFrame from './EmailPreviewFrame.vue';
import { useHtmlImport } from '../../composables/useHtmlImport';
import { useTemplateModuleOptions } from '@/composables/useTemplateMergeTagSchema';
import { captureEmailTemplateImportCompleted, captureEmailTemplateImportStarted } from '@/config/posthogTemplates';
import { useOrgMergeMappings } from '../../composables/useOrgMergeMappings';

const props = defineProps({
  open: { type: Boolean, default: false },
  initialName: { type: String, default: '' },
  initialMetadata: { type: Object, default: () => ({}) },
  mode: { type: String, default: 'create' }
});

const emit = defineEmits(['close', 'import', 'apply']);

const { t } = useI18n();
const sourceTab = ref('paste');
const templateName = ref('');
const importing = ref(false);
const orgMappingsApplied = ref(0);
const { moduleOptions, loadModuleOptions } = useTemplateModuleOptions();
const {
  orgMappings,
  loadOrgMappings,
  persistMappings,
  applyOrgMappingsToTags
} = useOrgMergeMappings();

const {
  step,
  htmlSource,
  analyzing,
  analysisError,
  analysisResult,
  mergeMappings,
  reset,
  runAnalysis,
  refreshAnalysisWithMappings,
  goToConfirm,
  goBack,
  loadFileContent,
  hubspotConditionalMode
} = useHtmlImport();

const stepLabel = computed(() => {
  if (step.value === 'source') return t('templates.htmlImport.stepSource');
  if (step.value === 'analysis') return t('templates.htmlImport.stepAnalysis');
  return t('templates.htmlImport.stepConfirm');
});

const confirmSummary = computed(() => {
  if (!analysisResult.value) return '';
  const warnings = analysisResult.value.warnings?.length || 0;
  if (analysisResult.value.checks.htmlValid) {
    return t('templates.htmlImport.confirmReady', { warnings });
  }
  return t('templates.htmlImport.confirmReview', { warnings });
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    reset();
    sourceTab.value = 'paste';
    importing.value = false;
    orgMappingsApplied.value = 0;
    templateName.value = props.initialName || '';
    void loadModuleOptions();
    void loadOrgMappings();
    captureEmailTemplateImportStarted({ mode: props.mode });
  }
);

watch(analysisResult, (result) => {
  if (!result?.suggestedName || templateName.value.trim()) return;
  templateName.value = result.suggestedName;
});

async function onFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    analysisError.value = t('templates.htmlImport.errorFileTooLarge');
    return;
  }
  const text = await file.text();
  loadFileContent(text);
  sourceTab.value = 'paste';
}

async function handleAnalyze() {
  orgMappingsApplied.value = 0;
  const ok = await runAnalysis();
  if (!ok || !analysisResult.value) return;

  orgMappingsApplied.value = applyOrgMappingsToTags(
    orgMappings.value,
    analysisResult.value.mergeTags.map((tag) => tag.raw),
    mergeMappings.value
  );

  if (orgMappingsApplied.value > 0) {
    await refreshAnalysisWithMappings();
  }
}

async function onHubspotModeChange(mode) {
  hubspotConditionalMode.value = mode === 'strip' ? 'strip' : 'keep';
  await refreshAnalysisWithMappings();
}

async function onMappingsUpdate(nextMappings) {
  mergeMappings.value = { ...nextMappings };
  await refreshAnalysisWithMappings();
}

async function handleContinueToConfirm() {
  await refreshAnalysisWithMappings();
  if (analysisResult.value) {
    goToConfirm();
  }
}

async function handleImport() {
  if (!analysisResult.value) return;
  if (props.mode !== 'replace' && !templateName.value.trim()) return;
  importing.value = true;
  try {
    await persistMappings(mergeMappings.value);

    captureEmailTemplateImportCompleted({
      mergeTags: analysisResult.value.counts?.mergeTags || 0,
      warnings: analysisResult.value.warnings?.length || 0
    });

    if (props.mode === 'replace') {
      emit('apply', {
        jsonDefinition: analysisResult.value.jsonDefinition
      });
      return;
    }

    emit('import', {
      ...props.initialMetadata,
      name: templateName.value.trim(),
      outputFormat: 'email',
      jsonDefinition: analysisResult.value.jsonDefinition
    });
  } finally {
    importing.value = false;
  }
}

function handleCancel() {
  if (step.value === 'source') {
    emit('close');
    return;
  }
  goBack();
}
</script>

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  analyzeTemplateHtml,
  type HtmlAnalysisOptions,
  type HtmlAnalysisResult,
  type MergeMapping
} from '../services/htmlImportApi';

export type HtmlImportStep = 'source' | 'analysis' | 'confirm';
export type HubspotConditionalMode = 'keep' | 'strip';

export function useHtmlImport() {
  const { t } = useI18n();

  const step = ref<HtmlImportStep>('source');
  const htmlSource = ref('');
  const analyzing = ref(false);
  const analysisError = ref('');
  const analysisResult = ref<HtmlAnalysisResult | null>(null);
  const mergeMappings = ref<Record<string, MergeMapping>>({});
  const hubspotConditionalMode = ref<HubspotConditionalMode>('keep');

  function analysisOptions(): HtmlAnalysisOptions {
    return {
      hubspotConditionalMode: hubspotConditionalMode.value,
      fetchExternalCss: true
    };
  }

  function reset() {
    step.value = 'source';
    htmlSource.value = '';
    analyzing.value = false;
    analysisError.value = '';
    analysisResult.value = null;
    mergeMappings.value = {};
    hubspotConditionalMode.value = 'keep';
  }

  async function runAnalysis() {
    if (!htmlSource.value.trim()) {
      analysisError.value = t('templates.htmlImport.errorEmptyHtml');
      return false;
    }

    analyzing.value = true;
    analysisError.value = '';
    try {
      analysisResult.value = await analyzeTemplateHtml(
        htmlSource.value,
        mergeMappings.value,
        analysisOptions()
      );
      for (const tag of analysisResult.value.mergeTags) {
        if (!mergeMappings.value[tag.raw]) {
          mergeMappings.value[tag.raw] = { skip: false };
        }
      }
      step.value = 'analysis';
      return true;
    } catch (error) {
      analysisError.value = error instanceof Error
        ? error.message
        : t('templates.htmlImport.errorAnalyzeFailed');
      return false;
    } finally {
      analyzing.value = false;
    }
  }

  async function refreshAnalysisWithMappings() {
    if (!htmlSource.value.trim()) return false;
    analyzing.value = true;
    analysisError.value = '';
    try {
      analysisResult.value = await analyzeTemplateHtml(
        htmlSource.value,
        mergeMappings.value,
        analysisOptions()
      );
      return true;
    } catch (error) {
      analysisError.value = error instanceof Error
        ? error.message
        : t('templates.htmlImport.errorAnalyzeFailed');
      return false;
    } finally {
      analyzing.value = false;
    }
  }

  function goToConfirm() {
    step.value = 'confirm';
  }

  function goBack() {
    if (step.value === 'confirm') {
      step.value = 'analysis';
      return;
    }
    if (step.value === 'analysis') {
      step.value = 'source';
    }
  }

  function setMapping(raw: string, mapping: MergeMapping) {
    mergeMappings.value = {
      ...mergeMappings.value,
      [raw]: mapping
    };
  }

  function loadFileContent(content: string) {
    htmlSource.value = content;
  }

  return {
    step,
    htmlSource,
    analyzing,
    analysisError,
    analysisResult,
    mergeMappings,
    hubspotConditionalMode,
    reset,
    runAnalysis,
    refreshAnalysisWithMappings,
    goToConfirm,
    goBack,
    setMapping,
    loadFileContent
  };
}

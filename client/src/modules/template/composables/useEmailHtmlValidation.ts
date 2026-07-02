import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { analyzeTemplateHtml, type HtmlAnalysisResult } from '../services/htmlImportApi';
import { resolveHtmlImportWarningKey } from '../utils/htmlImportWarningLabel';

export interface EmailValidationItem {
  severity: 'error' | 'warning' | 'suggestion';
  code: string;
  message: string;
  detail?: string;
}

export interface EmailValidationResult {
  errors: EmailValidationItem[];
  warnings: EmailValidationItem[];
  suggestions: EmailValidationItem[];
  analysis: HtmlAnalysisResult | null;
}

function mapAnalysisToValidation(analysis: HtmlAnalysisResult, t: (key: string, ...args: unknown[]) => string): EmailValidationResult {
  const errors: EmailValidationItem[] = [];
  const warnings: EmailValidationItem[] = [];
  const suggestions: EmailValidationItem[] = [];

  if (!analysis.checks.htmlValid) {
    errors.push({
      severity: 'error',
      code: 'ERR_INVALID_HTML',
      message: t('templates.htmlImport.validationInvalidHtml')
    });
  }

  if (!analysis.checks.inlineCssFound && !analysis.css?.trim()) {
    suggestions.push({
      severity: 'suggestion',
      code: 'SUG_INLINE_STYLES',
      message: t('templates.htmlImport.validationSuggestInlineCss')
    });
  }

  if (!analysis.checks.tablesDetected) {
    suggestions.push({
      severity: 'suggestion',
      code: 'SUG_TABLE_LAYOUT',
      message: t('templates.htmlImport.validationSuggestTables')
    });
  }

  for (const item of analysis.warnings || []) {
    const key = resolveHtmlImportWarningKey(item.type);
    warnings.push({
      severity: 'warning',
      code: item.type,
      message: t(key),
      detail: item.detail
    });
  }

  const imgWithoutAlt = (analysis.sanitizedHtml.match(/<img\b(?![^>]*\balt=)[^>]*>/gi) || []).length;
  if (imgWithoutAlt > 0) {
    warnings.push({
      severity: 'warning',
      code: 'WARN_NO_ALT',
      message: t('templates.htmlImport.validationMissingAlt', { count: imgWithoutAlt })
    });
  }

  const tablesWithoutWidth = (analysis.sanitizedHtml.match(/<table\b(?![^>]*\bwidth=)[^>]*>/gi) || []).length;
  if (tablesWithoutWidth > 0) {
    warnings.push({
      severity: 'warning',
      code: 'WARN_TABLE_WIDTH',
      message: t('templates.htmlImport.validationMissingTableWidth', { count: tablesWithoutWidth })
    });
  }

  return { errors, warnings, suggestions, analysis };
}

export function useEmailHtmlValidation() {
  const { t } = useI18n();
  const validating = ref(false);
  const result = ref<EmailValidationResult | null>(null);
  const error = ref('');

  async function validateHtml(html: string) {
    validating.value = true;
    error.value = '';
    try {
      const analysis = await analyzeTemplateHtml(html);
      result.value = mapAnalysisToValidation(analysis, t);
      return result.value;
    } catch (err) {
      error.value = err instanceof Error
        ? err.message
        : t('templates.htmlImport.errorAnalyzeFailed');
      result.value = null;
      return null;
    } finally {
      validating.value = false;
    }
  }

  function reset() {
    validating.value = false;
    result.value = null;
    error.value = '';
  }

  return {
    validating,
    result,
    error,
    validateHtml,
    reset
  };
}

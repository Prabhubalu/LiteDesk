export const WEBFORM_BUTTON_COLORS = ['blue', 'indigo', 'emerald', 'red', 'gray', 'dark'];
export const WEBFORM_BUTTON_WIDTHS = ['full', 'fit', 'half'];
export const WEBFORM_BUTTON_ALIGNS = ['left', 'center', 'right'];

export function defaultFormActions() {
  return {
    align: 'left',
    submit: { label: '', color: 'blue', width: 'full' },
    next: { label: '', color: 'gray', width: 'fit' },
    back: { label: '', color: 'gray', width: 'fit' },
    reset: { enabled: false, label: '', color: 'gray', width: 'fit' },
    cancel: { enabled: false, label: '', color: 'gray', width: 'fit', redirectUrl: '' }
  };
}

export function mergeFormActions(raw) {
  const defaults = defaultFormActions();
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    align: WEBFORM_BUTTON_ALIGNS.includes(source.align) ? source.align : defaults.align,
    submit: {
      label: String(source.submit?.label ?? defaults.submit.label).trim(),
      color: WEBFORM_BUTTON_COLORS.includes(source.submit?.color) ? source.submit.color : defaults.submit.color,
      width: WEBFORM_BUTTON_WIDTHS.includes(source.submit?.width) ? source.submit.width : defaults.submit.width
    },
    next: {
      label: String(source.next?.label ?? defaults.next.label).trim(),
      color: WEBFORM_BUTTON_COLORS.includes(source.next?.color) ? source.next.color : defaults.next.color,
      width: WEBFORM_BUTTON_WIDTHS.includes(source.next?.width) ? source.next.width : defaults.next.width
    },
    back: {
      label: String(source.back?.label ?? defaults.back.label).trim(),
      color: WEBFORM_BUTTON_COLORS.includes(source.back?.color) ? source.back.color : defaults.back.color,
      width: WEBFORM_BUTTON_WIDTHS.includes(source.back?.width) ? source.back.width : defaults.back.width
    },
    reset: {
      enabled: source.reset?.enabled === true,
      label: String(source.reset?.label ?? defaults.reset.label).trim(),
      color: WEBFORM_BUTTON_COLORS.includes(source.reset?.color) ? source.reset.color : defaults.reset.color,
      width: WEBFORM_BUTTON_WIDTHS.includes(source.reset?.width) ? source.reset.width : defaults.reset.width
    },
    cancel: {
      enabled: source.cancel?.enabled === true,
      label: String(source.cancel?.label ?? defaults.cancel.label).trim(),
      color: WEBFORM_BUTTON_COLORS.includes(source.cancel?.color) ? source.cancel.color : defaults.cancel.color,
      width: WEBFORM_BUTTON_WIDTHS.includes(source.cancel?.width) ? source.cancel.width : defaults.cancel.width,
      redirectUrl: String(source.cancel?.redirectUrl || '').trim()
    }
  };
}

const COLOR_CLASSES = Object.freeze({
  blue: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500',
  indigo: 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500',
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500',
  red: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500',
  gray: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
  dark: 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900'
});

export function buttonColorClasses(color) {
  return COLOR_CLASSES[color] || COLOR_CLASSES.blue;
}

export function buttonWidthClasses(width, align = 'left', options = {}) {
  const paired = options.paired === true;
  if (width === 'full') {
    return paired ? 'min-w-0 flex-1' : 'w-full basis-full';
  }
  if (width === 'half') {
    return paired ? 'min-w-0 flex-1' : 'min-w-0 w-full sm:w-[calc(50%-0.375rem)]';
  }
  return 'w-auto shrink-0';
}

export function actionsAlignClasses(align) {
  if (align === 'center') return 'justify-center';
  if (align === 'right') return 'justify-end';
  return 'justify-start';
}

export function actionsContainerClasses() {
  return 'mt-6 flex w-full flex-wrap items-center gap-2';
}

export function resolveButtonLabel(configuredLabel, fallback) {
  const label = String(configuredLabel || '').trim();
  return label || fallback;
}

import { mergeWebformBranding } from '@/utils/webformBranding';
import { sanitizeMultiStepConfig, sanitizeWebformSteps } from '@/utils/webformMultiStep';

export function normalizePublicWebformPayload(source) {
  if (!source || typeof source !== 'object') return null;

  const captchaRaw = source.captcha && typeof source.captcha === 'object' ? source.captcha : {};
  const siteKey = String(captchaRaw.siteKey || '').trim();
  const enabled = captchaRaw.enabled === true;
  const configured = captchaRaw.configured === true
    || (enabled && siteKey && captchaRaw.secretConfigured === true);
  const statusActive = source.status === 'Active';
  const required = captchaRaw.required === true
    || (enabled && configured && statusActive);

  const multiStep = sanitizeMultiStepConfig(source.multiStep);

  return {
    webformId: source.webformId,
    name: source.name || '',
    description: source.description || '',
    headerImageUrl: String(source.headerImageUrl || '').trim(),
    branding: mergeWebformBranding(source.branding),
    multiStep,
    steps: sanitizeWebformSteps(source.steps, multiStep.enabled),
    fields: Array.isArray(source.fields) ? source.fields : [],
    formActions: mergeFormActions(source.formActions),
    thankYouMessage: source.thankYouMessage || '',
    redirectUrl: source.redirectUrl || '',
    status: source.status || '',
    captcha: {
      enabled,
      required,
      configured,
      siteKey: enabled && configured ? siteKey : ''
    }
  };
}

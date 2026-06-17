'use strict';

const WEBFORM_BUTTON_COLORS = ['blue', 'indigo', 'emerald', 'red', 'gray', 'dark'];
const WEBFORM_BUTTON_WIDTHS = ['full', 'fit', 'half'];
const WEBFORM_BUTTON_ALIGNS = ['left', 'center', 'right'];

const DEFAULT_FORM_ACTIONS = Object.freeze({
  align: 'left',
  submit: {
    label: '',
    color: 'blue',
    width: 'full'
  },
  next: {
    label: '',
    color: 'gray',
    width: 'fit'
  },
  back: {
    label: '',
    color: 'gray',
    width: 'fit'
  },
  reset: {
    enabled: false,
    label: '',
    color: 'gray',
    width: 'fit'
  },
  cancel: {
    enabled: false,
    label: '',
    color: 'gray',
    width: 'fit',
    redirectUrl: ''
  }
});

function sanitizeActionButton(raw, defaults) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    label: String(source.label ?? defaults.label ?? '').trim(),
    color: WEBFORM_BUTTON_COLORS.includes(source.color) ? source.color : defaults.color,
    width: WEBFORM_BUTTON_WIDTHS.includes(source.width) ? source.width : defaults.width
  };
}

function sanitizeFormActions(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const resetDefaults = DEFAULT_FORM_ACTIONS.reset;
  const cancelDefaults = DEFAULT_FORM_ACTIONS.cancel;

  return {
    align: WEBFORM_BUTTON_ALIGNS.includes(source.align) ? source.align : DEFAULT_FORM_ACTIONS.align,
    submit: sanitizeActionButton(source.submit, DEFAULT_FORM_ACTIONS.submit),
    next: sanitizeActionButton(source.next, DEFAULT_FORM_ACTIONS.next),
    back: sanitizeActionButton(source.back, DEFAULT_FORM_ACTIONS.back),
    reset: {
      ...sanitizeActionButton(source.reset, resetDefaults),
      enabled: source.reset?.enabled === true
    },
    cancel: {
      ...sanitizeActionButton(source.cancel, cancelDefaults),
      enabled: source.cancel?.enabled === true,
      redirectUrl: String(source.cancel?.redirectUrl || '').trim()
    }
  };
}

module.exports = {
  WEBFORM_BUTTON_COLORS,
  WEBFORM_BUTTON_WIDTHS,
  WEBFORM_BUTTON_ALIGNS,
  DEFAULT_FORM_ACTIONS,
  sanitizeFormActions
};

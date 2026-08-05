import { reactive } from 'vue';
import { i18n } from '@/i18n';

const t = i18n.global.t.bind(i18n.global);

/** @type {{ show: boolean, title: string, message: string, confirmLabel: string, secondaryLabel: string, cancelLabel: string, tone: 'danger'|'warning'|'success', mode: 'boolean'|'choice', resolving: ((result: unknown) => void)|null }} */
export const confirmActionState = reactive({
  show: false,
  title: '',
  message: '',
  confirmLabel: '',
  secondaryLabel: '',
  cancelLabel: '',
  tone: 'warning',
  mode: 'boolean',
  resolving: null
});

function inferTone(message) {
  const text = String(message || '');
  if (/delete|remove|uninstall|revoke|terminate|destroy|archive|unlink|reset full/i.test(text)) {
    return 'danger';
  }
  if (/approve|publish|enable|complete|activate|send invite/i.test(text)) {
    return 'success';
  }
  return 'warning';
}

function inferConfirmLabel(message, tone) {
  const text = String(message || '');
  if (tone === 'danger' || /delete|remove|uninstall|revoke|terminate|archive|unlink/i.test(text)) {
    return t('actions.delete');
  }
  return t('actions.confirm');
}

function resetConfirmState() {
  confirmActionState.secondaryLabel = '';
  confirmActionState.cancelLabel = '';
  confirmActionState.mode = 'boolean';
}

/**
 * Show the shared confirmation modal and resolve with the user's choice.
 * @param {string|{ title?: string, message: string, confirmLabel?: string, tone?: 'danger'|'warning'|'success' }} options
 * @returns {Promise<boolean>}
 */
export function confirmAction(options) {
  const opts = typeof options === 'string' ? { message: options } : { ...options };
  const message = opts.message ?? '';
  const tone = opts.tone || inferTone(message);

  if (confirmActionState.show && typeof confirmActionState.resolving === 'function') {
    confirmActionState.resolving(
      confirmActionState.mode === 'choice' ? 'cancel' : false
    );
  }

  return new Promise((resolve) => {
    resetConfirmState();
    confirmActionState.title = opts.title || t('actions.confirm');
    confirmActionState.message = message;
    confirmActionState.confirmLabel = opts.confirmLabel || inferConfirmLabel(message, tone);
    confirmActionState.tone = tone;
    confirmActionState.mode = 'boolean';
    confirmActionState.resolving = resolve;
    confirmActionState.show = true;
  });
}

/**
 * Three-way confirm: primary / secondary / cancel (Esc / backdrop / cancel button).
 * @param {{ title?: string, message: string, confirmLabel?: string, secondaryLabel: string, cancelLabel?: string, tone?: 'danger'|'warning'|'success' }} options
 * @returns {Promise<'confirm'|'secondary'|'cancel'>}
 */
export function confirmActionChoice(options) {
  const opts = options && typeof options === 'object' ? { ...options } : { message: String(options || '') };
  const message = opts.message ?? '';
  const tone = opts.tone || inferTone(message);

  if (confirmActionState.show && typeof confirmActionState.resolving === 'function') {
    confirmActionState.resolving(
      confirmActionState.mode === 'choice' ? 'cancel' : false
    );
  }

  return new Promise((resolve) => {
    confirmActionState.title = opts.title || t('actions.confirm');
    confirmActionState.message = message;
    confirmActionState.confirmLabel = opts.confirmLabel || inferConfirmLabel(message, tone);
    confirmActionState.secondaryLabel = opts.secondaryLabel || '';
    confirmActionState.cancelLabel = opts.cancelLabel || t('actions.cancel');
    confirmActionState.tone = tone;
    confirmActionState.mode = 'choice';
    confirmActionState.resolving = resolve;
    confirmActionState.show = true;
  });
}

/**
 * @param {boolean|'confirm'|'secondary'|'cancel'} result
 */
export function resolveConfirmAction(result) {
  confirmActionState.show = false;
  const resolve = confirmActionState.resolving;
  const mode = confirmActionState.mode;
  confirmActionState.resolving = null;
  resetConfirmState();
  if (typeof resolve !== 'function') return;

  if (mode === 'choice') {
    if (result === true || result === 'confirm') resolve('confirm');
    else if (result === 'secondary') resolve('secondary');
    else resolve('cancel');
    return;
  }
  resolve(!!result);
}

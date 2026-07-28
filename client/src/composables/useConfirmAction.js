import { reactive } from 'vue';
import { i18n } from '@/i18n';

const t = i18n.global.t.bind(i18n.global);

/** @type {{ show: boolean, title: string, message: string, confirmLabel: string, tone: 'danger'|'warning'|'success', resolving: ((ok: boolean) => void)|null }} */
export const confirmActionState = reactive({
  show: false,
  title: '',
  message: '',
  confirmLabel: '',
  tone: 'warning',
  resolving: null
});

function inferTone(message) {
  const text = String(message || '');
  if (/delete|remove|uninstall|revoke|terminate|destroy|archive|unlink|reset full/i.test(text)) {
    return 'danger';
  }
  if (/approve|publish|enable|complete|activate/i.test(text)) {
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

/**
 * Show the shared confirmation modal (DeleteConfirmationModal) and resolve with the user's choice.
 * @param {string|{ title?: string, message: string, confirmLabel?: string, tone?: 'danger'|'warning'|'success' }} options
 * @returns {Promise<boolean>}
 */
export function confirmAction(options) {
  const opts = typeof options === 'string' ? { message: options } : { ...options };
  const message = opts.message ?? '';
  const tone = opts.tone || inferTone(message);

  if (confirmActionState.show && typeof confirmActionState.resolving === 'function') {
    confirmActionState.resolving(false);
  }

  return new Promise((resolve) => {
    confirmActionState.title = opts.title || t('actions.confirm');
    confirmActionState.message = message;
    confirmActionState.confirmLabel = opts.confirmLabel || inferConfirmLabel(message, tone);
    confirmActionState.tone = tone;
    confirmActionState.resolving = resolve;
    confirmActionState.show = true;
  });
}

export function resolveConfirmAction(confirmed) {
  confirmActionState.show = false;
  const resolve = confirmActionState.resolving;
  confirmActionState.resolving = null;
  if (typeof resolve === 'function') {
    resolve(!!confirmed);
  }
}

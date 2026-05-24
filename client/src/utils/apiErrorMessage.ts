import { useI18n } from 'vue-i18n';
import { resolveApiErrorMessage } from '@/i18n/errors';

/**
 * Resolve a localized API error for toasts and inline alerts.
 */
export function useApiErrorMessage() {
  const { t } = useI18n();

  return (payload: { code?: string; message?: string; params?: Record<string, unknown> } | null | undefined) =>
    resolveApiErrorMessage(t, payload);
}

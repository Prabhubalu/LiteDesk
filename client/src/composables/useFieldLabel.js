import { useI18n } from 'vue-i18n';
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';

/**
 * Localized label for module fields (system catalog + tenant fallback).
 */
export function useFieldLabel(moduleKey) {
  const { t, te } = useI18n();

  function fieldLabel(field) {
    return resolveFieldLabel(moduleKey, field, t, te);
  }

  return { fieldLabel, resolveFieldLabel: (field) => resolveFieldLabel(moduleKey, field, t, te) };
}

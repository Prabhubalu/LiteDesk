/**
 * Sales Returns record adapter — invoice-based returns to stock.
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import SalesReturnWorkflowHeaderActions from '@/components/record-page/sections/SalesReturnWorkflowHeaderActions.vue';

const SR_SECTION_STACK = ['details', 'related', 'description'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

export function createSalesReturnsRecordAdapter(opts = {}) {
  const base = createGenericRecordAdapter(opts);

  return {
    ...base,
    module: 'sales_returns',

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const isExpanded = expanded.length > 0;
      const descriptionFullPage = expanded === 'description-history';
      const keys =
        isExpanded && !descriptionFullPage
          ? SR_SECTION_STACK.filter((k) => k === expanded)
          : descriptionFullPage
            ? []
            : SR_SECTION_STACK;

      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(baseSections.map((section) => [section.key, section]));

      if (byKey.details) {
        byKey.details = {
          ...byKey.details,
          headerActionsComponent: SalesReturnWorkflowHeaderActions
        };
      }

      return keys.map((key) => byKey[key] || null).filter(Boolean);
    }
  };
}

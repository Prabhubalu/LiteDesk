/**
 * Delivery Returns record adapter — Inventory reverse sales fulfillment.
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import DeliveryReturnLinesRecordSection from '@/components/record-page/sections/DeliveryReturnLinesRecordSection.vue';
import DeliveryReturnWorkflowHeaderActions from '@/components/record-page/sections/DeliveryReturnWorkflowHeaderActions.vue';

const DR_SECTION_STACK = ['details', 'lines', 'related', 'description'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

export function createDeliveryReturnsRecordAdapter(opts = {}) {
  const { sectionLabels: sl, expandedLeftSection, openLeftSection } = opts;
  const base = createGenericRecordAdapter(opts);
  const L = sl || { lines: 'Lines', expand: 'Expand' };
  const linesTitle = L.lines || 'Lines';

  return {
    ...base,
    module: 'delivery_returns',

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const isExpanded = expanded.length > 0;
      const descriptionFullPage = expanded === 'description-history';
      const keys =
        isExpanded && !descriptionFullPage
          ? DR_SECTION_STACK.filter((k) => k === expanded)
          : descriptionFullPage
            ? []
            : DR_SECTION_STACK;

      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(baseSections.map((section) => [section.key, section]));

      const linesSection = {
        key: 'lines',
        title: linesTitle,
        component: DeliveryReturnLinesRecordSection,
        headerActionsComponent: DeliveryReturnWorkflowHeaderActions,
        className: 'pt-0 pb-0',
        actions:
          !isExpanded && openLeftSection
            ? [
                {
                  key: 'expand-lines',
                  type: 'expand',
                  label: L.expand || 'Expand',
                  alwaysVisible: true,
                  handler: () => openLeftSection('lines')
                }
              ]
            : []
      };

      return keys
        .map((key) => {
          if (key === 'lines') return linesSection;
          return byKey[key] || null;
        })
        .filter(Boolean);
    }
  };
}

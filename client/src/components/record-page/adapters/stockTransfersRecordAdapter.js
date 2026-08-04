/**
 * Stock Transfers record adapter — move stock between locations.
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import StockTransferLinesRecordSection from '@/components/record-page/sections/StockTransferLinesRecordSection.vue';
import StockTransferWorkflowHeaderActions from '@/components/record-page/sections/StockTransferWorkflowHeaderActions.vue';

const XFER_SECTION_STACK = ['details', 'lines', 'related', 'description'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

export function createStockTransfersRecordAdapter(opts = {}) {
  const { sectionLabels: sl, expandedLeftSection, openLeftSection } = opts;
  const base = createGenericRecordAdapter(opts);
  const L = sl || { lines: 'Lines', expand: 'Expand' };
  const linesTitle = L.lines || 'Lines';

  return {
    ...base,
    module: 'stock_transfers',

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const isExpanded = expanded.length > 0;
      const descriptionFullPage = expanded === 'description-history';
      const keys =
        isExpanded && !descriptionFullPage
          ? XFER_SECTION_STACK.filter((k) => k === expanded)
          : descriptionFullPage
            ? []
            : XFER_SECTION_STACK;

      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(baseSections.map((section) => [section.key, section]));

      const linesSection = {
        key: 'lines',
        title: linesTitle,
        component: StockTransferLinesRecordSection,
        headerActionsComponent: StockTransferWorkflowHeaderActions,
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

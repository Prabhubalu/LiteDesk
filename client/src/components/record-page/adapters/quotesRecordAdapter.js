/**
 * Quotes module record adapter — generic layout + lines section.
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import QuoteLinesRecordSection from '@/components/record-page/sections/QuoteLinesRecordSection.vue';
import QuoteConversionRecordSection from '@/components/record-page/sections/QuoteConversionRecordSection.vue';

const QUOTE_SECTION_STACK = ['description', 'lines', 'conversion', 'details', 'related'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

export function createQuotesRecordAdapter(opts = {}) {
  const base = createGenericRecordAdapter(opts);
  const linesTitle = opts.sectionLabels?.lines || opts.sectionLabels?.details || 'Lines';

  return {
    ...base,
    module: 'quotes',

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const isExpanded = expanded.length > 0;
      const descriptionFullPage = expanded === 'description-history';
      const keys = isExpanded && !descriptionFullPage
        ? QUOTE_SECTION_STACK.filter((k) => k === expanded)
        : descriptionFullPage
          ? []
          : QUOTE_SECTION_STACK;

      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(baseSections.map((section) => [section.key, section]));

      const linesSection = {
        key: 'lines',
        title: linesTitle,
        component: QuoteLinesRecordSection,
        className: 'pt-2 pb-2',
        actions: []
      };

      const conversionSection = {
        key: 'conversion',
        title: 'Conversion',
        component: QuoteConversionRecordSection,
        className: 'pt-2 pb-2',
        actions: []
      };

      return keys
        .map((key) => (key === 'lines' ? linesSection : key === 'conversion' ? conversionSection : byKey[key]))
        .filter(Boolean);
    }
  };
}


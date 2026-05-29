/**
 * Quotes module record adapter — generic layout + lines section.
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import QuoteLinesRecordSection from '@/components/record-page/sections/QuoteLinesRecordSection.vue';
import QuoteLinesHeaderMeta from '@/components/record-page/sections/QuoteLinesHeaderMeta.vue';
import QuoteLinesHeaderActions from '@/components/record-page/sections/QuoteLinesHeaderActions.vue';
import QuoteConversionRecordSection from '@/components/record-page/sections/QuoteConversionRecordSection.vue';
import QuoteConversionHeaderActions from '@/components/record-page/sections/QuoteConversionHeaderActions.vue';
import QuoteRevisionsRecordSection from '@/components/record-page/sections/QuoteRevisionsRecordSection.vue';

const QUOTE_SECTION_STACK = ['details', 'lines', 'related', 'revisions', 'conversion', 'description'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

export function createQuotesRecordAdapter(opts = {}) {
  const {
    sectionLabels: sl,
    expandedLeftSection,
    openLeftSection
  } = opts;
  const base = createGenericRecordAdapter(opts);
  const L = sl || { lines: 'Lines', revisions: 'Revisions', conversion: 'Conversion', expand: 'Expand' };
  const linesTitle = L.lines || 'Lines';
  const revisionsTitle = L.revisions || 'Revisions';
  const conversionTitle = L.conversion || 'Conversion';

  return {
    ...base,
    module: 'quotes',

    shouldRenderSection(section, record) {
      if (section?.key !== 'revisions') return true;
      if (!record?._id) return false;
      const revNum = Number(record.revisionNumber) || 1;
      if (revNum > 1) return true;
      if (record.sourceQuoteId) return true;
      if (record.activeRevision === false) return true;
      return false;
    },

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
        titleSuffixComponent: QuoteLinesHeaderMeta,
        headerActionsComponent: QuoteLinesHeaderActions,
        component: QuoteLinesRecordSection,
        className: 'pt-2 pb-2',
        alwaysShowActions: true,
        actions: !isExpanded && openLeftSection
          ? [{ key: 'expand-lines', type: 'expand', label: L.expand || 'Expand', alwaysVisible: true, handler: () => openLeftSection('lines') }]
          : []
      };

      const revisionsSection = {
        key: 'revisions',
        title: revisionsTitle,
        component: QuoteRevisionsRecordSection,
        className: 'pt-2 pb-2',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-revisions',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('revisions')
          }]
          : []
      };

      const conversionSection = {
        key: 'conversion',
        title: conversionTitle,
        headerActionsComponent: QuoteConversionHeaderActions,
        component: QuoteConversionRecordSection,
        className: 'pt-2 pb-2',
        alwaysShowActions: true,
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-conversion',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('conversion')
          }]
          : []
      };

      const descriptionHtml = base.getDescription?.(record) ?? record?.description ?? '';
      const hasDescription = Boolean(String(descriptionHtml || '').replace(/<[^>]+>/g, '').trim());

      return keys
        .filter((key) => key !== 'description' || hasDescription)
        .map((key) => {
          if (key === 'lines') return linesSection;
          if (key === 'revisions') return revisionsSection;
          if (key === 'conversion') return conversionSection;
          return byKey[key];
        })
        .filter(Boolean);
    }
  };
}


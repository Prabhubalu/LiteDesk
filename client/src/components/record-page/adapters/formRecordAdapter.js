/**
 * Forms module record adapter — generic layout + preview and responses sections.
 */
import { canShowFormResponses } from '@/utils/engagementFormDisplay';
import { createGenericRecordAdapter } from './genericRecordAdapter';
import FormRecordPreviewSection from '@/components/record-page/sections/FormRecordPreviewSection.vue';
import FormRecordResponsesHub from '@/components/record-page/sections/FormRecordResponsesHub.vue';

const FORM_SECTION_STACK = ['description', 'preview', 'responses', 'details', 'related'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

function stackKeysForRecord(record, expanded, descriptionFullPage) {
  const isExpanded = expanded.length > 0;
  if (descriptionFullPage) return [];
  if (isExpanded) {
    return FORM_SECTION_STACK.filter((k) => k === expanded);
  }
  const keys = ['description', 'preview'];
  if (canShowFormResponses(record)) {
    keys.push('responses');
  }
  keys.push('details', 'related');
  return keys;
}

export function createFormRecordAdapter(opts = {}) {
  const base = createGenericRecordAdapter(opts);
  const previewTitle = opts.sectionLabels?.preview || 'Preview';
  const responsesTitle = opts.sectionLabels?.responses || 'Responses';

  return {
    ...base,
    module: 'forms',

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const descriptionFullPage = expanded === 'description-history';
      const keys = stackKeysForRecord(record, expanded, descriptionFullPage);
      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(baseSections.map((section) => [section.key, section]));
      const isExpanded = expanded.length > 0;

      const previewSection = {
        key: 'preview',
        title: previewTitle,
        component: FormRecordPreviewSection,
        className: 'pt-2 pb-2',
        actions: [
          !isExpanded && opts.openLeftSection
            ? { key: 'expand-preview', type: 'expand', label: opts.sectionLabels?.expand || 'Expand', handler: () => opts.openLeftSection('preview') }
            : null
        ].filter(Boolean)
      };

      const responsesSection = {
        key: 'responses',
        title: responsesTitle,
        component: FormRecordResponsesHub,
        className: 'pt-2 pb-2',
        actions: [
          !isExpanded && opts.openLeftSection
            ? { key: 'expand-responses', type: 'expand', label: opts.sectionLabels?.expand || 'Expand', handler: () => opts.openLeftSection('responses') }
            : null
        ].filter(Boolean)
      };

      return keys
        .map((key) => {
          if (key === 'preview') return previewSection;
          if (key === 'responses') return responsesSection;
          return byKey[key];
        })
        .filter(Boolean);
    }
  };
}

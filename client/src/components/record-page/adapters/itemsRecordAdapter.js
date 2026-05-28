/**
 * Items module record adapter — generic layout + catalog section (media, category, variants).
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import ItemCatalogRecordSection from '@/components/record-page/sections/ItemCatalogRecordSection.vue';

const ITEM_SECTION_STACK = ['description', 'catalog', 'details', 'related'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

export function createItemsRecordAdapter(opts = {}) {
  const base = createGenericRecordAdapter(opts);
  const catalogTitle = opts.sectionLabels?.catalog || 'Catalog';

  return {
    ...base,
    module: 'items',

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const isExpanded = expanded.length > 0;
      const descriptionFullPage = expanded === 'description-history';
      const keys = isExpanded && !descriptionFullPage
        ? ITEM_SECTION_STACK.filter((k) => k === expanded)
        : descriptionFullPage
          ? []
          : ITEM_SECTION_STACK;

      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(
        baseSections.map((section) => [section.key, section])
      );

      const catalogSection = {
        key: 'catalog',
        title: catalogTitle,
        component: ItemCatalogRecordSection,
        className: 'pt-2 pb-2',
        actions: []
      };

      return keys
        .map((key) => (key === 'catalog' ? catalogSection : byKey[key]))
        .filter(Boolean);
    }
  };
}

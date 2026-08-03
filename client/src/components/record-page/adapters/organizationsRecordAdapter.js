/**
 * Organizations record adapter — generic layout + Vendor Catalog section
 * when the org participates as Inventory Vendor.
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import VendorCatalogRecordSection from '@/components/record-page/sections/VendorCatalogRecordSection.vue';

const ORG_STACK = ['description', 'details', 'vendor-catalog', 'related'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

function isVendorOrganization(record) {
  if (!record || typeof record !== 'object') return false;
  const parts = record.participations;
  if (parts && typeof parts === 'object' && parts.INVENTORY) {
    const role = String(parts.INVENTORY.role || '').toLowerCase();
    if (!role || role === 'vendor') return true;
  }
  const types = Array.isArray(record.types) ? record.types : [];
  return types.some((t) => String(t).toLowerCase() === 'vendor');
}

export function createOrganizationsRecordAdapter(opts = {}) {
  const base = createGenericRecordAdapter(opts);
  const catalogTitle = opts.sectionLabels?.vendorCatalog || 'Vendor Catalog';

  return {
    ...base,
    module: 'organizations',

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const isExpanded = expanded.length > 0;
      const descriptionFullPage = expanded === 'description-history';
      const showCatalog = isVendorOrganization(record);
      const stack = showCatalog
        ? ORG_STACK
        : ORG_STACK.filter((k) => k !== 'vendor-catalog');

      const keys =
        isExpanded && !descriptionFullPage
          ? stack.filter((k) => k === expanded)
          : descriptionFullPage
            ? []
            : stack;

      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(baseSections.map((section) => [section.key, section]));

      const catalogSection = {
        key: 'vendor-catalog',
        title: catalogTitle,
        component: VendorCatalogRecordSection,
        className: 'pt-2 pb-2',
        actions:
          !isExpanded && opts.openLeftSection
            ? [
                {
                  key: 'expand-vendor-catalog',
                  type: 'expand',
                  label: opts.sectionLabels?.expand || 'Expand',
                  alwaysVisible: true,
                  handler: () => opts.openLeftSection('vendor-catalog')
                }
              ]
            : []
      };

      return keys
        .map((key) => (key === 'vendor-catalog' ? catalogSection : byKey[key]))
        .filter(Boolean);
    }
  };
}

/**
 * Sales Orders record adapter — operational execution view.
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import SalesOrderLinesRecordSection from '@/components/record-page/sections/SalesOrderLinesRecordSection.vue';
import SalesOrderSourceRecordSection from '@/components/record-page/sections/SalesOrderSourceRecordSection.vue';
import SalesOrderFulfillmentRecordSection from '@/components/record-page/sections/SalesOrderFulfillmentRecordSection.vue';
import SalesOrderLineageRecordSection from '@/components/record-page/sections/SalesOrderLineageRecordSection.vue';
import SalesOrderInvoiceReadinessRecordSection from '@/components/record-page/sections/SalesOrderInvoiceReadinessRecordSection.vue';
import SalesOrderBillingCoverageRecordSection from '@/components/record-page/sections/SalesOrderBillingCoverageRecordSection.vue';

const SO_SECTION_STACK = ['details', 'lines', 'fulfillment', 'lineage', 'billing', 'invoice', 'source', 'related', 'description'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

export function createSalesOrdersRecordAdapter(opts = {}) {
  const { sectionLabels: sl, expandedLeftSection, openLeftSection } = opts;
  const base = createGenericRecordAdapter(opts);
  const L = sl || { lines: 'Lines', fulfillment: 'Fulfillment', source: 'Source', expand: 'Expand' };
  const linesTitle = L.lines || 'Lines';
  const fulfillmentTitle = L.fulfillment || 'Fulfillment';
  const lineageTitle = L.lineage || 'Lineage';
  const invoiceTitle = L.invoice || 'Invoicing';
  const billingTitle = L.billing || 'Billing coverage';
  const sourceTitle = L.source || 'Source';

  return {
    ...base,
    module: 'sales_orders',

    shouldRenderSection(section, record) {
      if (section?.key !== 'source') return true;
      return Boolean(record?.sourceQuoteId || record?.sourceQuoteNumber);
    },

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const isExpanded = expanded.length > 0;
      const descriptionFullPage = expanded === 'description-history';
      const keys = isExpanded && !descriptionFullPage
        ? SO_SECTION_STACK.filter((k) => k === expanded)
        : descriptionFullPage
          ? []
          : SO_SECTION_STACK;

      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(baseSections.map((section) => [section.key, section]));

      const linesSection = {
        key: 'lines',
        title: linesTitle,
        component: SalesOrderLinesRecordSection,
        className: 'pt-0 pb-0',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-lines',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('lines')
          }]
          : []
      };

      const fulfillmentSection = {
        key: 'fulfillment',
        title: fulfillmentTitle,
        component: SalesOrderFulfillmentRecordSection,
        className: 'pt-2 pb-2',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-fulfillment',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('fulfillment')
          }]
          : []
      };

      const lineageSection = {
        key: 'lineage',
        title: lineageTitle,
        component: SalesOrderLineageRecordSection,
        className: 'pt-2 pb-2',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-lineage',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('lineage')
          }]
          : []
      };

      const invoiceSection = {
        key: 'invoice',
        title: invoiceTitle,
        component: SalesOrderInvoiceReadinessRecordSection,
        className: 'pt-2 pb-2',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-invoice',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('invoice')
          }]
          : []
      };

      const billingSection = {
        key: 'billing',
        title: billingTitle,
        component: SalesOrderBillingCoverageRecordSection,
        className: 'pt-2 pb-2',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-billing',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('billing')
          }]
          : []
      };

      const sourceSection = {
        key: 'source',
        title: sourceTitle,
        component: SalesOrderSourceRecordSection,
        className: 'pt-2 pb-2',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-source',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('source')
          }]
          : []
      };

      const descriptionHtml = base.getDescription?.(record) ?? record?.description ?? '';
      const hasDescription = Boolean(String(descriptionHtml || '').replace(/<[^>]+>/g, '').trim());

      return keys
        .filter((key) => key !== 'description' || hasDescription)
        .filter((key) => key !== 'source' || (record?.sourceQuoteId || record?.sourceQuoteNumber))
        .map((key) => {
          if (key === 'lines') return linesSection;
          if (key === 'fulfillment') return fulfillmentSection;
          if (key === 'lineage') return lineageSection;
          if (key === 'billing') return billingSection;
          if (key === 'invoice') return invoiceSection;
          if (key === 'source') return sourceSection;
          return byKey[key];
        })
        .filter(Boolean);
    }
  };
}

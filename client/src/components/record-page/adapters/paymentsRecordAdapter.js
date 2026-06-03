/**
 * Payments record adapter — cash application view.
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import PaymentAllocationsRecordSection from '@/components/record-page/sections/PaymentAllocationsRecordSection.vue';
import PaymentRefundsRecordSection from '@/components/record-page/sections/PaymentRefundsRecordSection.vue';
import PaymentWorkflowHeaderActions from '@/components/record-page/sections/PaymentWorkflowHeaderActions.vue';
import CustomerStatementRecordSection from '@/components/record-page/sections/CustomerStatementRecordSection.vue';
import PaymentGatewayEventsPanel from '@/components/payments/PaymentGatewayEventsPanel.vue';

const PAYMENT_SECTION_STACK = ['details', 'allocations', 'refunds', 'statement', 'gateway-events', 'related', 'description'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

export function createPaymentsRecordAdapter(opts = {}) {
  const { sectionLabels: sl, expandedLeftSection, openLeftSection } = opts;
  const base = createGenericRecordAdapter(opts);
  const L = sl || { expand: 'Expand' };

  return {
    ...base,
    module: 'payments',

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const isExpanded = expanded.length > 0;
      const descriptionFullPage = expanded === 'description-history';
      const keys = isExpanded && !descriptionFullPage
        ? PAYMENT_SECTION_STACK.filter((k) => k === expanded)
        : descriptionFullPage
          ? []
          : PAYMENT_SECTION_STACK;

      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(baseSections.map((section) => [section.key, section]));

      const allocationsSection = {
        key: 'allocations',
        title: L.paymentAllocations || 'Allocations',
        component: PaymentAllocationsRecordSection,
        headerActionsComponent: PaymentWorkflowHeaderActions,
        className: 'pt-0 pb-0',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-allocations',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('allocations')
          }]
          : []
      };

      const refundsSection = {
        key: 'refunds',
        title: L.paymentRefunds || 'Refunds',
        component: PaymentRefundsRecordSection,
        className: 'pt-0 pb-0',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-refunds',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('refunds')
          }]
          : []
      };

      const statementSection = {
        key: 'statement',
        title: L.customerStatement || 'Customer statement',
        component: CustomerStatementRecordSection,
        className: 'pt-0 pb-0',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-statement',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('statement')
          }]
          : []
      };

      const gatewayEventsSection = {
        key: 'gateway-events',
        title: L.gatewayEvents || 'Gateway events',
        component: PaymentGatewayEventsPanel,
        className: 'pt-0 pb-0',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-gateway-events',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('gateway-events')
          }]
          : []
      };

      const descriptionHtml = base.getDescription?.(record) ?? record?.description ?? '';
      const hasDescription = Boolean(String(descriptionHtml || '').replace(/<[^>]+>/g, '').trim());

      return keys
        .filter((key) => key !== 'description' || hasDescription)
        .map((key) => {
          if (key === 'allocations') return allocationsSection;
          if (key === 'refunds') return refundsSection;
          if (key === 'statement') return statementSection;
          if (key === 'gateway-events') return gatewayEventsSection;
          return byKey[key];
        })
        .filter(Boolean);
    }
  };
}

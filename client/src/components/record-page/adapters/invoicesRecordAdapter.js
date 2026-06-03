/**
 * Invoices record adapter — billing document view.
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import InvoiceLinesRecordSection from '@/components/record-page/sections/InvoiceLinesRecordSection.vue';
import InvoiceWorkflowHeaderActions from '@/components/record-page/sections/InvoiceWorkflowHeaderActions.vue';
import InvoiceCreditNotesRecordSection from '@/components/record-page/sections/InvoiceCreditNotesRecordSection.vue';
import InvoicePaymentsRecordSection from '@/components/record-page/sections/InvoicePaymentsRecordSection.vue';
import InvoicePaymentLinkPanel from '@/components/payments/InvoicePaymentLinkPanel.vue';
import BankTransferInstructionsPanel from '@/components/payments/BankTransferInstructionsPanel.vue';

const INVOICE_SECTION_STACK = ['details', 'lines', 'payments', 'payment-link', 'bank-transfer', 'credits', 'related', 'description'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

export function createInvoicesRecordAdapter(opts = {}) {
  const { sectionLabels: sl, expandedLeftSection, openLeftSection } = opts;
  const base = createGenericRecordAdapter(opts);
  const L = sl || { lines: 'Lines', expand: 'Expand' };
  const linesTitle = L.lines || 'Lines';

  return {
    ...base,
    module: 'invoices',

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const isExpanded = expanded.length > 0;
      const descriptionFullPage = expanded === 'description-history';
      const keys = isExpanded && !descriptionFullPage
        ? INVOICE_SECTION_STACK.filter((k) => k === expanded)
        : descriptionFullPage
          ? []
          : INVOICE_SECTION_STACK;

      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(baseSections.map((section) => [section.key, section]));

      const linesSection = {
        key: 'lines',
        title: linesTitle,
        component: InvoiceLinesRecordSection,
        headerActionsComponent: InvoiceWorkflowHeaderActions,
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

      const creditsSection = {
        key: 'credits',
        title: L.credits || 'Credit notes',
        component: InvoiceCreditNotesRecordSection,
        className: 'pt-0 pb-0',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-credits',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('credits')
          }]
          : []
      };

      const paymentsSection = {
        key: 'payments',
        title: L.payments || 'Payments',
        component: InvoicePaymentsRecordSection,
        className: 'pt-0 pb-0',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-payments',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('payments')
          }]
          : []
      };

      const showPayments =
        String(record?.invoiceType || 'standard') !== 'credit_note' &&
        ['Posted', 'Partially Paid', 'Paid', 'Written Off'].includes(String(record?.status || ''));

      const showCredits =
        String(record?.invoiceType || 'standard') !== 'credit_note' &&
        ['Posted', 'Partially Paid', 'Paid'].includes(String(record?.status || ''));

      const paymentLinkSection = {
        key: 'payment-link',
        title: L.paymentLink || 'Payment link',
        component: InvoicePaymentLinkPanel,
        className: 'pt-0 pb-0',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-payment-link',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('payment-link')
          }]
          : []
      };

      const showPaymentLink =
        showPayments &&
        ['Posted', 'Partially Paid'].includes(String(record?.status || '')) &&
        Number(record?.amountDue) > 0;

      const bankTransferSection = {
        key: 'bank-transfer',
        title: L.bankTransfer || 'Bank transfer',
        component: BankTransferInstructionsPanel,
        className: 'pt-0 pb-0',
        actions: !isExpanded && openLeftSection
          ? [{
            key: 'expand-bank-transfer',
            type: 'expand',
            label: L.expand || 'Expand',
            alwaysVisible: true,
            handler: () => openLeftSection('bank-transfer')
          }]
          : []
      };

      const descriptionHtml = base.getDescription?.(record) ?? record?.description ?? '';
      const hasDescription = Boolean(String(descriptionHtml || '').replace(/<[^>]+>/g, '').trim());

      return keys
        .filter((key) => key !== 'description' || hasDescription)
        .filter((key) => key !== 'credits' || showCredits)
        .filter((key) => key !== 'payments' || showPayments)
        .filter((key) => key !== 'payment-link' || showPaymentLink)
        .filter((key) => key !== 'bank-transfer' || showPaymentLink)
        .map((key) => {
          if (key === 'lines') return linesSection;
          if (key === 'payments') return paymentsSection;
          if (key === 'payment-link') return paymentLinkSection;
          if (key === 'bank-transfer') return bankTransferSection;
          if (key === 'credits') return creditsSection;
          return byKey[key];
        })
        .filter(Boolean);
    }
  };
}

/**
 * Tenant branding for invoice PDFs and customer emails (reuses quote org settings).
 */

const { getQuoteBranding } = require('./quoteBrandingService');

const CREDIT_REASON_LABELS = {
  duplicate: 'Duplicate billing',
  return: 'Return',
  pricing_error: 'Pricing error',
  goodwill: 'Goodwill',
  other: 'Other'
};

async function getInvoiceBranding(organizationId, { invoiceType = 'standard' } = {}) {
  const base = await getQuoteBranding(organizationId);
  const isCreditNote = String(invoiceType || 'standard') === 'credit_note';
  return {
    ...base,
    documentTitle: isCreditNote ? 'Credit Note' : 'Invoice'
  };
}

function formatCreditReasonLabel(reason) {
  const key = String(reason || '').trim();
  return CREDIT_REASON_LABELS[key] || key || '—';
}

module.exports = {
  getInvoiceBranding,
  formatCreditReasonLabel,
  CREDIT_REASON_LABELS
};

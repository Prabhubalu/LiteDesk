'use strict';

const TALLY_DEFAULT_SETTINGS = Object.freeze({
  syncIntervalMinutes: 5,
  dryRunDefault: true,
  autoApproveMappingConfidence: 0.95,
  companyWriteConcurrency: 1,
  entities: {
    parties: { enabled: true, direction: 'bidirectional' },
    items: { enabled: true, direction: 'bidirectional' },
    stock: { enabled: true, direction: 'bidirectional' },
    invoices: { enabled: true, direction: 'arivu_to_tally' },
    payments: { enabled: true, direction: 'arivu_to_tally' },
    purchaseOrders: { enabled: true, direction: 'arivu_to_tally' },
    receiptNotes: { enabled: true, direction: 'arivu_to_tally' },
  },
});

module.exports = {
  TALLY_DEFAULT_SETTINGS,
};

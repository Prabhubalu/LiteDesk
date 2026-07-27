'use strict';

const TALLY_DEFAULT_SETTINGS = Object.freeze({
  syncIntervalMinutes: 5,
  /** Opt-in: scheduled incremental sync (tick every 60s; runs per syncIntervalMinutes). */
  scheduledSyncEnabled: false,
  /**
   * User who owns records created from Tally (createdBy + assignedTo).
   * Null until resolved from addon installedBy / settings UI.
   */
  defaultOwnerUserId: null,
  dryRunDefault: true,
  autoApproveMappingConfidence: 0.95,
  companyWriteConcurrency: 1,
  /** Per-cycle record limit (low-pressure sync). */
  recordsPerSyncCycle: 200,
  recordsPerSyncCycleMin: 50,
  recordsPerSyncCycleMax: 500,
  /** Migration mode shows Sync From column and enables mass backfill. */
  migrationMode: false,
  /** When true, inbound item sync does not overwrite gstRatePercent / gstTaxability. */
  preventProductTaxUpdate: false,
  /** When true, Item/Party auto-outbox fans out to every linked companyGuid. */
  autoOutboxFanOutToAllLinkedCompanies: true,
  entities: {
    parties: { enabled: true, direction: 'bidirectional' },
    items: { enabled: true, direction: 'bidirectional' },
    stockGroups: { enabled: true, direction: 'bidirectional' },
    godowns: { enabled: true, direction: 'bidirectional' },
    stock: { enabled: true, direction: 'bidirectional' },
    invoices: { enabled: true, direction: 'arivu_to_tally' },
    creditNotes: { enabled: true, direction: 'arivu_to_tally' },
    debitNotes: { enabled: true, direction: 'arivu_to_tally' },
    payments: { enabled: true, direction: 'arivu_to_tally' },
    vendorPayments: { enabled: true, direction: 'arivu_to_tally' },
    purchaseBills: { enabled: true, direction: 'arivu_to_tally' },
    purchaseOrders: { enabled: true, direction: 'arivu_to_tally' },
    salesOrders: { enabled: true, direction: 'arivu_to_tally' },
    receiptNotes: { enabled: true, direction: 'arivu_to_tally' },
    deliveryNotes: { enabled: true, direction: 'arivu_to_tally' },
    journals: { enabled: true, direction: 'arivu_to_tally' },
    stockJournals: { enabled: true, direction: 'bidirectional' },
  },
});

module.exports = {
  TALLY_DEFAULT_SETTINGS,
};

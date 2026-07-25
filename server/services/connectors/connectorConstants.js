'use strict';

const CONNECTOR_KEYS = Object.freeze({
  TALLY: 'tally',
});

const CONNECTOR_DIRECTIONS = Object.freeze({
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
  BIDIRECTIONAL: 'bidirectional',
});

const CONNECTOR_ENTITY_TYPES = Object.freeze({
  PARTY: 'party',
  ITEM: 'item',
  STOCK: 'stock',
  INVOICE: 'invoice',
  PAYMENT: 'payment',
  PURCHASE_ORDER: 'purchase_order',
  RECEIPT_NOTE: 'receipt_note',
  LEDGER: 'ledger',
  GODOWN: 'godown',
  VOUCHER: 'voucher',
});

const OUTBOX_STATUSES = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const SYNC_JOB_STATUSES = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const CONFLICT_STATUSES = Object.freeze({
  OPEN: 'open',
  RESOLVED: 'resolved',
  IGNORED: 'ignored',
});

const CONFLICT_RESOLUTIONS = Object.freeze({
  USE_ARIVU: 'use_arivu',
  USE_EXTERNAL: 'use_external',
  MERGE: 'merge',
  IGNORE: 'ignore',
});

module.exports = {
  CONNECTOR_KEYS,
  CONNECTOR_DIRECTIONS,
  CONNECTOR_ENTITY_TYPES,
  OUTBOX_STATUSES,
  SYNC_JOB_STATUSES,
  CONFLICT_STATUSES,
  CONFLICT_RESOLUTIONS,
};

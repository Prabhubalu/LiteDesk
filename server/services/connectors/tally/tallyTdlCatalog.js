'use strict';

/**
 * Mirror of Arivu TDL pack v1.0.0 collection IDs used by sync orchestrator pulls.
 * Keep in sync with connectors/arivu-agent/src/arivuTdlXml.js ARIVU_COLLECTIONS.
 */

const ARIVU_TDL_PACK_VERSION = '1.0.0';

/** Full inbound catalog — every collection the agent can export. */
const FULL_INBOUND_PULLS = Object.freeze([
  { masterType: 'Group', exportId: 'Arivu List of Groups' },
  { masterType: 'Ledger', exportId: 'Arivu List of Ledgers' },
  { masterType: 'Currency', exportId: 'Arivu List of Currencies' },
  { masterType: 'VoucherType', exportId: 'Arivu List of Voucher Types' },
  { masterType: 'CostCategory', exportId: 'Arivu List of Cost Categories' },
  { masterType: 'CostCentre', exportId: 'Arivu List of Cost Centres' },
  { masterType: 'Unit', exportId: 'Arivu List of Units' },
  { masterType: 'AttendanceType', exportId: 'Arivu List of Attendance Types' },
  { masterType: 'StockGroup', exportId: 'Arivu List of Stock Groups' },
  { masterType: 'StockCategory', exportId: 'Arivu List of Stock Categories' },
  { masterType: 'StockItem', exportId: 'Arivu List of Stock Items' },
  { masterType: 'Godown', exportId: 'Arivu List of Godowns' },
  { masterType: 'Batch', exportId: 'Arivu List of Batches' },
  { masterType: 'StockSummary', exportId: 'Arivu Stock Summary' },
  { masterType: 'GSTClassification', exportId: 'Arivu List of GST Classifications' },
  { masterType: 'TaxUnit', exportId: 'Arivu List of Tax Units' },
  { masterType: 'GstDutyLedger', exportId: 'Arivu List of GST Duty Ledgers' },
]);

/** Dry-run: lighter set for discovery/health (still exercises TDL load). */
const DRY_RUN_PULLS = Object.freeze([
  { masterType: 'Ledger', exportId: 'Arivu List of Ledgers' },
  { masterType: 'StockItem', exportId: 'Arivu List of Stock Items' },
  { masterType: 'Godown', exportId: 'Arivu List of Godowns' },
  { masterType: 'Group', exportId: 'Arivu List of Groups' },
  { masterType: 'VoucherType', exportId: 'Arivu List of Voucher Types' },
]);

function voucherPullWindow(days = 30) {
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return {
    masterType: 'Voucher',
    exportId: 'Arivu List of Vouchers',
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
  };
}

function resolveInboundPulls({ jobType = 'incremental', includeVouchers = true } = {}) {
  if (jobType === 'dry_run') {
    return [...DRY_RUN_PULLS];
  }
  const pulls = [...FULL_INBOUND_PULLS];
  if (includeVouchers) {
    pulls.push(voucherPullWindow(30));
  }
  return pulls;
}

module.exports = {
  ARIVU_TDL_PACK_VERSION,
  FULL_INBOUND_PULLS,
  DRY_RUN_PULLS,
  voucherPullWindow,
  resolveInboundPulls,
};

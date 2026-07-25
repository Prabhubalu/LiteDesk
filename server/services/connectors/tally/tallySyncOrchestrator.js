'use strict';

/**
 * Drain pending Tally outbox rows into agent-deliverable ConnectorSyncJobs,
 * and enrich incremental sync jobs with pull export requests.
 */

const ConnectorOutbox = require('../../../models/ConnectorOutbox');
const TallyCompanyBinding = require('../../../models/TallyCompanyBinding');
const { CONNECTOR_KEYS, OUTBOX_STATUSES } = require('../connectorConstants');
const { enqueueTallySyncJob } = require('./tallySyncQueueService');
const { buildXmlForOutbox } = require('./tallyXmlBuilder');

async function enrichOutboxPayload(row) {
  const organizationId = row.organizationId;
  const type = String(row.entityType || '').toLowerCase();

  if (type === 'invoice') {
    const tallyVoucherSyncService = require('./tallyVoucherSyncService');
    const result = await tallyVoucherSyncService.pushInvoice({
      organizationId,
      invoiceId: row.arivuId,
      companyGuid: row.companyGuid,
      dryRun: true,
    });
    return result.payload || {};
  }
  if (type === 'payment') {
    const tallyVoucherSyncService = require('./tallyVoucherSyncService');
    if (typeof tallyVoucherSyncService.pushPayment === 'function') {
      const result = await tallyVoucherSyncService.pushPayment({
        organizationId,
        paymentId: row.arivuId,
        companyGuid: row.companyGuid,
        dryRun: true,
      });
      return result.payload || row.payload || {};
    }
  }
  if (type === 'party') {
    const Organization = require('../../../models/Organization');
    const partyMapper = require('./mappers/partyMapper');
    const org = await Organization.findById(row.arivuId).lean();
    return org ? partyMapper.toTally(org) : row.payload || {};
  }
  if (type === 'item') {
    const ItemVariant = require('../../../models/ItemVariant');
    const Item = require('../../../models/Item');
    const stockItemMapper = require('./mappers/stockItemMapper');
    const variant = await ItemVariant.findById(row.arivuId).lean();
    if (variant) {
      const item = variant.itemId
        ? await Item.findById(variant.itemId).lean()
        : {};
      return stockItemMapper.toTally(variant, item || {});
    }
  }
  return row.payload || {};
}

async function drainPendingOutbox({
  organizationId,
  companyGuid = null,
  limit = 25,
  createdBy = null,
} = {}) {
  const filter = {
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    status: OUTBOX_STATUSES.PENDING,
  };
  if (companyGuid) filter.companyGuid = companyGuid;

  const rows = await ConnectorOutbox.find(filter)
    .sort({ createdAt: 1 })
    .limit(Math.min(Math.max(limit, 1), 100));

  const created = [];

  for (const row of rows) {
    let payload = row.payload || {};

    // Enrich thin hook payloads into full mapper payloads before XML build
    if (!payload.xml && !payload.voucherType && !payload.masterType && !payload.name) {
      try {
        // eslint-disable-next-line no-await-in-loop
        payload = await enrichOutboxPayload(row);
      } catch (err) {
        row.status = OUTBOX_STATUSES.FAILED;
        row.lastError = `Enrich failed: ${err.message}`;
        row.attempts = (row.attempts || 0) + 1;
        // eslint-disable-next-line no-await-in-loop
        await row.save();
        continue;
      }
    }

    const xml = buildXmlForOutbox({
      entityType: row.entityType,
      payload,
      operation: row.operation,
    });

    if (!xml) {
      row.status = OUTBOX_STATUSES.FAILED;
      row.lastError = 'Could not build Tally XML for outbox payload';
      row.attempts = (row.attempts || 0) + 1;
      // eslint-disable-next-line no-await-in-loop
      await row.save();
      continue;
    }

    row.status = OUTBOX_STATUSES.PROCESSING;
    row.attempts = (row.attempts || 0) + 1;
    // eslint-disable-next-line no-await-in-loop
    await row.save();

    // eslint-disable-next-line no-await-in-loop
    const { job } = await enqueueTallySyncJob({
      organizationId,
      companyGuid: row.companyGuid || companyGuid,
      jobType: 'push_voucher',
      direction: 'outbound',
      priority: 5,
      createdBy,
      payload: {
        xml,
        outboxId: String(row._id),
        entityType: row.entityType,
        arivuId: row.arivuId,
        operation: row.operation,
        company: row.payload?.companyName || null,
        statsHint: { entityType: row.entityType, outbox: 1 },
      },
    });

    created.push({ outboxId: String(row._id), jobId: String(job._id) });
  }

  return { drained: created.length, jobs: created };
}

/**
 * Enqueue a bi-dir incremental sync: outbound drain + inbound master pulls.
 */
async function triggerBidirectionalSync({
  organizationId,
  companyGuid = null,
  jobType = 'incremental',
  createdBy = null,
  dryRun = false,
} = {}) {
  if (dryRun || jobType === 'dry_run') {
    return enqueueTallySyncJob({
      organizationId,
      companyGuid,
      jobType: 'dry_run',
      direction: 'bidirectional',
      createdBy,
      payload: { dryRun: true },
    });
  }

  const binding =
    companyGuid
      ? await TallyCompanyBinding.findOne({ organizationId, companyGuid, enabled: true }).lean()
      : await TallyCompanyBinding.findOne({ organizationId, enabled: true }).sort({ updatedAt: -1 }).lean();

  const guid = companyGuid || binding?.companyGuid || null;
  const companyName = binding?.companyName || null;

  const drain = await drainPendingOutbox({
    organizationId,
    companyGuid: guid,
    createdBy,
  });

  // Inbound pulls — full TDL pack catalog (see tallyTdlCatalog.js)
  const { resolveInboundPulls, ARIVU_TDL_PACK_VERSION } = require('./tallyTdlCatalog');
  const pullJobs = [];
  const pulls = resolveInboundPulls({ jobType, includeVouchers: true });
  for (const pull of pulls) {
    // eslint-disable-next-line no-await-in-loop
    const { job } = await enqueueTallySyncJob({
      organizationId,
      companyGuid: guid,
      jobType: 'pull_masters',
      direction: 'inbound',
      createdBy,
      payload: {
        masterType: pull.masterType,
        exportId: pull.exportId,
        company: companyName,
        companyGuid: guid,
        fromDate: pull.fromDate || null,
        toDate: pull.toDate || null,
      },
    });
    pullJobs.push(String(job._id));
  }

  const summary = await enqueueTallySyncJob({
    organizationId,
    companyGuid: guid,
    jobType: jobType === 'full' ? 'full' : 'incremental',
    direction: 'bidirectional',
    createdBy,
    payload: {
      drainedOutbox: drain.drained,
      pullJobIds: pullJobs,
      company: companyName,
      tdlPackVersion: ARIVU_TDL_PACK_VERSION,
      pullCount: pullJobs.length,
    },
  });

  return {
    mode: summary.mode,
    job: summary.job,
    drained: drain.drained,
    pullJobs,
  };
}

module.exports = {
  drainPendingOutbox,
  triggerBidirectionalSync,
};

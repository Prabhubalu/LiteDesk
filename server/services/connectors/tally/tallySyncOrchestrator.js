'use strict';

/**
 * Drain pending Tally outbox rows into agent-deliverable ConnectorSyncJobs,
 * and enrich incremental sync jobs with pull export requests — honoring
 * module mapping syncWay, filters, and per-cycle record limits.
 */

const ConnectorOutbox = require('../../../models/ConnectorOutbox');
const TallyCompanyBinding = require('../../../models/TallyCompanyBinding');
const TallyModuleMapping = require('../../../models/TallyModuleMapping');
const { CONNECTOR_KEYS, OUTBOX_STATUSES } = require('../connectorConstants');
const { enqueueTallySyncJob } = require('./tallySyncQueueService');
const { buildXmlForOutbox } = require('./tallyXmlBuilder');
const {
  ensureModuleMappings,
  getMergedSettings,
  allowsPull,
  allowsPush,
} = require('./tallyModuleMappingService');
const { PULL_MASTER_TO_MODULE } = require('../../../constants/tallyModuleMappingDefaults');
const { startRunLog, finishRunLog, appendRecord } = require('./tallySyncLogService');
const { resolveInboundPulls, ARIVU_TDL_PACK_VERSION } = require('./tallyTdlCatalog');

const ENTITY_TO_MODULE = Object.freeze({
  party: 'ledger',
  ledger: 'ledger',
  item: 'stock_item',
  stock: 'stock_item',
  stock_item: 'stock_item',
  stock_group: 'stock_group',
  stock_category: 'stock_category',
  godown: 'godown',
  invoice: 'sales',
  purchase: 'purchase',
  purchase_bill: 'purchase',
  payment: 'payment',
  vendor_payment: 'payment',
  receipt: 'receipt',
  credit_note: 'credit_note',
  debit_note: 'debit_note',
  journal: 'journal',
  journal_voucher: 'journal',
  contra: 'contra',
  contra_voucher: 'contra',
  stock_journal: 'stock_journal',
  delivery_note: 'delivery_note',
  receipt_note: 'receipt_note',
  purchase_order: 'purchase_order',
  sales_order: 'sales_order',
});

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
  if (type === 'credit_note') {
    const tallyVoucherSyncService = require('./tallyVoucherSyncService');
    const result = await tallyVoucherSyncService.pushCreditNote({
      organizationId,
      invoiceId: row.arivuId,
      companyGuid: row.companyGuid,
      dryRun: true,
    });
    return result.payload || {};
  }
  if (type === 'debit_note') {
    const tallyVoucherSyncService = require('./tallyVoucherSyncService');
    const result = await tallyVoucherSyncService.pushDebitNote({
      organizationId,
      invoiceId: row.arivuId,
      companyGuid: row.companyGuid,
      dryRun: true,
    });
    return result.payload || {};
  }
  if (type === 'payment' || type === 'vendor_payment') {
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
      const item = variant.itemId ? await Item.findById(variant.itemId).lean() : {};
      return stockItemMapper.toTally(variant, item || {});
    }
  }
  if (type === 'godown') {
    const InventoryLocation = require('../../../models/InventoryLocation');
    const godownMapper = require('./mappers/godownMapper');
    const loc = await InventoryLocation.findById(row.arivuId).lean();
    return loc ? godownMapper.toTally(loc) : row.payload || {};
  }
  if (type === 'stock_group' || type === 'stock_category') {
    const CatalogCategory = require('../../../models/CatalogCategory');
    const stockGroupMapper = require('./mappers/stockGroupMapper');
    const cat = await CatalogCategory.findById(row.arivuId).lean();
    return cat ? stockGroupMapper.toTally(cat) : row.payload || {};
  }
  if (type === 'sales_order') {
    const tallyVoucherSyncService = require('./tallyVoucherSyncService');
    const result = await tallyVoucherSyncService.pushSalesOrder({
      organizationId,
      salesOrderId: row.arivuId,
      companyGuid: row.companyGuid,
      dryRun: true,
    });
    return result.payload || {};
  }
  if (type === 'purchase_order') {
    const tallyVoucherSyncService = require('./tallyVoucherSyncService');
    const result = await tallyVoucherSyncService.pushPurchaseOrder({
      organizationId,
      purchaseOrderId: row.arivuId,
      companyGuid: row.companyGuid,
      dryRun: true,
    });
    return result.payload || {};
  }
  if (type === 'delivery_note') {
    const tallyVoucherSyncService = require('./tallyVoucherSyncService');
    const result = await tallyVoucherSyncService.pushDeliveryNote({
      organizationId,
      deliveryNoteId: row.arivuId,
      companyGuid: row.companyGuid,
      dryRun: true,
    });
    return result.payload || {};
  }
  if (type === 'receipt_note') {
    const tallyVoucherSyncService = require('./tallyVoucherSyncService');
    const result = await tallyVoucherSyncService.pushReceiptNote({
      organizationId,
      receiptNoteId: row.arivuId,
      companyGuid: row.companyGuid,
      dryRun: true,
    });
    return result.payload || {};
  }
  return row.payload || {};
}

async function loadMappingIndex({ organizationId, companyGuid }) {
  await ensureModuleMappings({ organizationId, companyGuid });
  const rows = await TallyModuleMapping.find({
    organizationId,
    companyGuid: companyGuid || null,
  }).lean();
  return new Map(rows.map((r) => [r.tallyModuleKey, r]));
}

function resolveSyncFrom(mapping, settings) {
  if (settings.migrationMode && mapping?.syncFrom) return new Date(mapping.syncFrom);
  const days = mapping?.filter?.dateWindowDays || 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function drainPendingOutbox({
  organizationId,
  companyGuid = null,
  limit = 25,
  createdBy = null,
  mappingIndex = null,
  settings = null,
  runLogId = null,
} = {}) {
  const settingsMerged = settings || (await getMergedSettings(organizationId));
  const cycleLimit = Math.min(
    Math.max(limit, 1),
    settingsMerged.recordsPerSyncCycle || 200
  );
  const index = mappingIndex || (await loadMappingIndex({ organizationId, companyGuid }));

  const filter = {
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    status: OUTBOX_STATUSES.PENDING,
  };
  if (companyGuid) filter.companyGuid = companyGuid;

  const rows = await ConnectorOutbox.find(filter)
    .sort({ createdAt: 1 })
    .limit(cycleLimit);

  const created = [];

  for (const row of rows) {
    const moduleKey = ENTITY_TO_MODULE[String(row.entityType || '').toLowerCase()];
    const mapping = moduleKey ? index.get(moduleKey) : null;
    if (mapping && !allowsPush(mapping.syncWay)) {
      row.status = OUTBOX_STATUSES.FAILED;
      row.lastError = `Sync way ${mapping.syncWay} does not allow push`;
      // eslint-disable-next-line no-await-in-loop
      await row.save();
      if (runLogId) {
        // eslint-disable-next-line no-await-in-loop
        await appendRecord(runLogId, {
          side: 'tally',
          action: 'skipped',
          tallyModuleKey: moduleKey,
          recordId: row.arivuId,
          reason: `syncWay=${mapping.syncWay}`,
        });
      }
      continue;
    }

    let payload = row.payload || {};

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

    // ATIP: overlay field + tax mapping rules onto mapper payload before XML
    try {
      const { prepareOutboundPayload } = require('./engines/ruleOverlayService');
      if (!payload._atip) {
        // eslint-disable-next-line no-await-in-loop
        const prepared = await prepareOutboundPayload({
          organizationId,
          companyGuid: row.companyGuid || companyGuid,
          entityType: row.entityType,
          tallyPayload: payload,
        });
        payload = prepared.payload;
      }
    } catch (overlayErr) {
      console.warn('[tallyOrchestrator] rule overlay skipped', overlayErr.message);
    }

    // ATIP Validation Engine — never enqueue invalid payloads
    try {
      const validationEngine = require('./engines/validationEngine');
      const entityType = String(row.entityType || '').toLowerCase();
      const validation = validationEngine.validatePayload({
        direction: 'outbound',
        entityType: entityType === 'invoice' ? 'invoice' : entityType,
        payload,
        requiredFields: entityType === 'party' || entityType === 'ledger' ? ['name'] : [],
      });
      if (!validation.ok) {
        const errorIntelligenceEngine = require('./engines/errorIntelligenceEngine');
        const enriched = errorIntelligenceEngine.enrichError(
          validation.errors.map((e) => e.message).join('; '),
          { entityType, outboxId: String(row._id) }
        );
        row.status = OUTBOX_STATUSES.FAILED;
        row.lastError = enriched.problem;
        row.metadata = {
          ...(row.metadata || {}),
          validation: validation.errors,
          errorIntelligence: errorIntelligenceEngine.toUserPayload(enriched),
        };
        row.attempts = (row.attempts || 0) + 1;
        // eslint-disable-next-line no-await-in-loop
        await row.save();
        continue;
      }
    } catch (valErr) {
      console.warn('[tallyOrchestrator] validation skipped', valErr.message);
    }

    const xml = buildXmlForOutbox({
      entityType: row.entityType,
      payload,
      operation: row.operation === 'push' ? 'upsert' : row.operation,
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
    if (runLogId) {
      // eslint-disable-next-line no-await-in-loop
      await appendRecord(runLogId, {
        side: 'tally',
        action: row.operation === 'update' || row.operation === 'alter' ? 'updated' : 'created',
        tallyModuleKey: moduleKey,
        recordId: row.arivuId,
        externalId: row.externalId || null,
      });
    }
  }

  return { drained: created.length, jobs: created };
}

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
  const settings = await getMergedSettings(organizationId);
  const mappingIndex = await loadMappingIndex({ organizationId, companyGuid: guid });

  const runLog = await startRunLog({
    organizationId,
    companyGuid: guid,
    companyName,
    tallyModuleKey: null,
    tallyModuleName: 'All modules',
    arivuModuleName: '—',
    metadata: { jobType },
  });

  const drain = await drainPendingOutbox({
    organizationId,
    companyGuid: guid,
    createdBy,
    limit: settings.recordsPerSyncCycle || 200,
    mappingIndex,
    settings,
    runLogId: runLog._id,
  });

  const pullJobs = [];
  const pulls = resolveInboundPulls({ jobType, includeVouchers: true });
  let pullBudget = settings.recordsPerSyncCycle || 200;

  const sortedPulls = [...pulls].sort((a, b) => {
    const ka = PULL_MASTER_TO_MODULE[a.masterType] || a.masterType;
    const kb = PULL_MASTER_TO_MODULE[b.masterType] || b.masterType;
    const oa = mappingIndex.get(ka)?.syncOrder ?? 50;
    const ob = mappingIndex.get(kb)?.syncOrder ?? 50;
    return oa - ob;
  });

  for (const pull of sortedPulls) {
    const moduleKey = PULL_MASTER_TO_MODULE[pull.masterType] || null;
    const mapping = moduleKey ? mappingIndex.get(moduleKey) : null;
    if (mapping && !allowsPull(mapping.syncWay)) continue;
    if (pullBudget <= 0) break;

    const syncFrom = mapping ? resolveSyncFrom(mapping, settings) : null;
    const fromDate =
      pull.fromDate ||
      (syncFrom ? syncFrom.toISOString() : null);
    const toDate = pull.toDate || new Date().toISOString();
    const batchLimit = Math.min(pullBudget, 100);
    const changeDetectionEngine = require('./engines/changeDetectionEngine');
    const incrementalFilter = changeDetectionEngine.buildIncrementalPullFilter({ mapping });

    // eslint-disable-next-line no-await-in-loop
    const { job } = await enqueueTallySyncJob({
      organizationId,
      companyGuid: guid,
      jobType: 'pull_masters',
      direction: 'inbound',
      createdBy,
      priority: jobType === 'full' ? 10 : 12,
      payload: {
        masterType: pull.masterType,
        exportId: pull.exportId,
        company: companyName,
        companyGuid: guid,
        fromDate,
        toDate,
        limit: batchLimit,
        filter: mapping?.filter || {},
        tallyModuleKey: moduleKey,
        sinceAlterId: jobType === 'full' ? null : incrementalFilter.sinceAlterId,
        incremental: jobType !== 'full',
      },
    });
    pullJobs.push(String(job._id));
    pullBudget -= batchLimit;

    if (mapping) {
      // eslint-disable-next-line no-await-in-loop
      await TallyModuleMapping.updateOne(
        { _id: mapping._id },
        { $set: { lastSyncAt: new Date() } }
      );
    }
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
      recordsPerSyncCycle: settings.recordsPerSyncCycle,
      runLogId: String(runLog._id),
    },
  });

  await finishRunLog(runLog._id, { status: 'completed' });

  return {
    mode: summary.mode,
    job: summary.job,
    drained: drain.drained,
    pullJobs,
    runLogId: String(runLog._id),
  };
}

module.exports = {
  drainPendingOutbox,
  triggerBidirectionalSync,
  ENTITY_TO_MODULE,
};

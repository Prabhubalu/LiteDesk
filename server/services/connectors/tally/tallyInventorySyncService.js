'use strict';

/**
 * Tally inventory sync — GTM-7
 *
 * Source-of-truth (SoT) rules
 * ---------------------------
 * Per-company SoT lives on TallyCompanyBinding.sourceOfTruth (e.g. { stock: 'tally'|'arivu' }).
 *
 * - stock SoT = 'tally'
 *   - Inbound stock journals / godown balances from Tally are authoritative.
 *   - ingestTallyStockJournal posts Arivu ledger rows (moduleKey tally_stock_journals).
 *   - Outbound Arivu ledger pushes (pushStockMovement) are skipped unless forced.
 *
 * - stock SoT = 'arivu' (default when unset)
 *   - Arivu InventoryLedgerEntry is authoritative for outbound stock movements.
 *   - pushStockMovement enqueues Tally stock journals from ledger entries.
 *   - Inbound Tally journals are informational / reconcile-only unless forced.
 *
 * Reconcile always compares Arivu ItemInventory.onHand against the last known
 * Tally snapshot stored on ConnectorExternalObject.metadata (entityType=stock).
 * Drift rows do not auto-correct; they surface for Integration Center review.
 *
 * sourceRef tally-safe
 * --------------------
 * Tally XML / voucher refs must be ASCII alphanumeric + hyphen/underscore,
 * max 64 chars. Use toTallySafeSourceRef() for all outbound refs.
 */

const ItemInventory = require('../../../models/ItemInventory');
const ConnectorExternalObject = require('../../../models/ConnectorExternalObject');
const TallyCompanyBinding = require('../../../models/TallyCompanyBinding');
const InventoryLedgerEntry = require('../../../models/InventoryLedgerEntry');
const { postInventoryTransaction } = require('../../inventoryTransactionService');
const { enqueueOutbox } = require('../connectorOutboxService');
const {
  CONNECTOR_KEYS,
  CONNECTOR_ENTITY_TYPES,
  CONNECTOR_DIRECTIONS,
} = require('../connectorConstants');
const { upsertLink, findByExternal } = require('../connectorExternalObjectService');
const { getTallyConnectorAdapter } = require('./tallyConnectorAdapterRegistry');

const TALLY_STOCK_MODULE_KEY = 'tally_stock_journals';
const TALLY_SAFE_REF_MAX = 64;

function toTallySafeSourceRef(raw) {
  const base = String(raw || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!base) return `ARV_${Date.now().toString(36).toUpperCase()}`;
  return base.slice(0, TALLY_SAFE_REF_MAX);
}

function resolveStockSoT(binding) {
  const map = binding?.sourceOfTruth && typeof binding.sourceOfTruth === 'object'
    ? binding.sourceOfTruth
    : {};
  const value = String(map.stock || map.inventory || 'arivu').toLowerCase();
  return value === 'tally' ? 'tally' : 'arivu';
}

async function getActiveBinding(organizationId, companyGuid = null) {
  const query = { organizationId, enabled: true };
  if (companyGuid) query.companyGuid = String(companyGuid);
  return TallyCompanyBinding.findOne(query).sort({ updatedAt: -1 }).lean();
}

/**
 * Push an Arivu inventory ledger entry to Tally as a stock movement (outbox + adapter stub).
 */
async function pushStockMovement({
  organizationId,
  ledgerEntryId = null,
  ledgerEntry = null,
  companyGuid = null,
  force = false,
} = {}) {
  if (!organizationId) throw new Error('organizationId required');

  let entry = ledgerEntry;
  if (!entry && ledgerEntryId) {
    entry = await InventoryLedgerEntry.findOne({
      organizationId,
      inventoryLedgerEntryId: String(ledgerEntryId),
    }).lean();
  }
  if (!entry) {
    const err = new Error('Inventory ledger entry not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const binding = await getActiveBinding(organizationId, companyGuid);
  const sot = resolveStockSoT(binding);
  if (sot === 'tally' && !force) {
    return {
      skipped: true,
      reason: 'stock_sot_tally',
      sourceOfTruth: sot,
    };
  }

  const resolvedCompanyGuid = companyGuid || binding?.companyGuid || null;
  const safeRef = toTallySafeSourceRef(
    entry.sourceRef?.recordId
      || entry.inventoryLedgerEntryId
      || entry.inventoryTransactionId
  );
  const lineSafe = toTallySafeSourceRef(
    entry.sourceRef?.lineId || entry.variantId || entry.inventoryLedgerEntryId
  );

  const payload = {
    voucherType: 'Stock Journal',
    sourceRef: {
      moduleKey: entry.sourceRef?.moduleKey || 'inventory_ledger',
      recordId: safeRef,
      lineId: lineSafe,
    },
    arivuLedgerEntryId: entry.inventoryLedgerEntryId,
    variantId: String(entry.variantId),
    inventoryLocationId: entry.inventoryLocationId,
    quantityDelta: entry.quantityDelta,
    entryType: entry.entryType,
    unitOfMeasure: entry.unitOfMeasure || null,
    notes: entry.notes || null,
    postedAt: entry.postedAt || null,
  };

  const outbox = await enqueueOutbox({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType: CONNECTOR_ENTITY_TYPES.STOCK,
    arivuId: String(entry.inventoryLedgerEntryId),
    operation: 'push_stock_movement',
    companyGuid: resolvedCompanyGuid,
    idempotencyKey: `tally-stock-${entry.inventoryLedgerEntryId}`,
    payload,
    metadata: { sourceOfTruth: sot },
  });

  const adapter = getTallyConnectorAdapter();
  let adapterResult = null;
  if (typeof adapter.pushVoucher === 'function') {
    adapterResult = await adapter.pushVoucher({
      organizationId,
      companyGuid: resolvedCompanyGuid,
      voucher: {
        voucherType: 'Stock Journal',
        ...payload,
      },
    });
  }

  return {
    skipped: false,
    sourceOfTruth: sot,
    sourceRef: payload.sourceRef,
    outboxId: String(outbox._id),
    adapterResult,
  };
}

/**
 * Ingest a Tally stock journal into Arivu inventory (postInventoryTransaction).
 * Expects mapped variant + godown → inventoryLocationId via ConnectorExternalObject.
 */
async function ingestTallyStockJournal({
  organizationId,
  userId = null,
  companyGuid = null,
  journal = {},
  force = false,
} = {}) {
  if (!organizationId) throw new Error('organizationId required');

  const binding = await getActiveBinding(organizationId, companyGuid);
  const sot = resolveStockSoT(binding);
  if (sot === 'arivu' && !force) {
    return {
      skipped: true,
      reason: 'stock_sot_arivu',
      sourceOfTruth: sot,
    };
  }

  const externalJournalId = String(
    journal.externalId || journal.voucherNumber || journal.guid || ''
  ).trim();
  if (!externalJournalId) {
    const err = new Error('journal.externalId (or voucherNumber/guid) required');
    err.code = 'VALIDATION';
    throw err;
  }

  const linesIn = Array.isArray(journal.lines) ? journal.lines : [];
  if (!linesIn.length) {
    const err = new Error('journal.lines required');
    err.code = 'VALIDATION';
    throw err;
  }

  const resolvedCompanyGuid = companyGuid || binding?.companyGuid || journal.companyGuid || null;
  const primaryGodownExternalId = String(
    journal.godownExternalId
      || journal.inventoryLocationExternalId
      || linesIn[0]?.godownExternalId
      || ''
  ).trim();

  let inventoryLocationId = journal.inventoryLocationId || null;
  if (!inventoryLocationId && primaryGodownExternalId) {
    const godownLink = await findByExternal({
      organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      entityType: CONNECTOR_ENTITY_TYPES.GODOWN,
      externalId: primaryGodownExternalId,
    });
    inventoryLocationId = godownLink?.arivuId || null;
  }
  if (!inventoryLocationId) {
    const err = new Error('Unable to resolve inventoryLocationId for Tally godown');
    err.code = 'MAPPING_REQUIRED';
    throw err;
  }

  const lines = [];
  for (let i = 0; i < linesIn.length; i += 1) {
    const line = linesIn[i] || {};
    const itemExternalId = String(line.itemExternalId || line.stockItemId || line.externalItemId || '').trim();
    let variantId = line.variantId || null;
    if (!variantId && itemExternalId) {
      const itemLink = await findByExternal({
        organizationId,
        connectorKey: CONNECTOR_KEYS.TALLY,
        entityType: CONNECTOR_ENTITY_TYPES.ITEM,
        externalId: itemExternalId,
      });
      variantId = itemLink?.arivuId || null;
    }
    if (!variantId) {
      const err = new Error(`Unable to resolve variantId for journal line ${i}`);
      err.code = 'MAPPING_REQUIRED';
      throw err;
    }

    const quantityDelta = Number(line.quantityDelta != null ? line.quantityDelta : line.quantity);
    if (!Number.isFinite(quantityDelta) || quantityDelta === 0) continue;

    lines.push({
      variantId,
      quantityDelta,
      unitCostSnapshot: line.unitCostSnapshot != null ? Number(line.unitCostSnapshot) : undefined,
      lineId: toTallySafeSourceRef(line.lineId || `${externalJournalId}_${i}`),
      notes: line.notes || null,
      entryType: quantityDelta >= 0 ? 'adjustment_in' : 'adjustment_out',
    });
  }

  if (!lines.length) {
    const err = new Error('No non-zero journal lines to ingest');
    err.code = 'VALIDATION';
    throw err;
  }

  const safeRecordId = toTallySafeSourceRef(externalJournalId);
  const result = await postInventoryTransaction({
    organizationId,
    userId,
    transactionType: journal.transactionType === 'transfer' ? 'transfer' : 'adjustment',
    inventoryLocationId,
    sourceContext: 'adjustment',
    sourceRef: {
      moduleKey: TALLY_STOCK_MODULE_KEY,
      recordId: safeRecordId,
    },
    notes: journal.notes || `Tally stock journal ${externalJournalId}`,
    lines,
    idempotent: true,
  });

  // Refresh last-known Tally snapshots for reconcile (one link per variant@location).
  for (const line of lines) {
    const balance = await ItemInventory.findOne({
      organizationId,
      variantId: line.variantId,
      inventoryLocationId,
    }).lean();

    const snapshotArivuId = `${String(line.variantId)}:${inventoryLocationId}`;
    const snapshotExternalId = toTallySafeSourceRef(
      `${primaryGodownExternalId || inventoryLocationId}:${String(line.variantId)}`
    );
    await upsertLink({
      organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      entityType: CONNECTOR_ENTITY_TYPES.STOCK,
      externalId: snapshotExternalId,
      arivuId: snapshotArivuId,
      arivuModule: 'inventory',
      companyGuid: resolvedCompanyGuid,
      lastDirection: CONNECTOR_DIRECTIONS.INBOUND,
      metadata: {
        variantId: String(line.variantId),
        inventoryLocationId,
        tallyOnHand: balance?.onHand ?? null,
        lastJournalExternalId: externalJournalId,
        lastIngestedAt: new Date().toISOString(),
        quantityDelta: line.quantityDelta,
      },
    });
  }

  return {
    skipped: false,
    sourceOfTruth: sot,
    sourceRef: { moduleKey: TALLY_STOCK_MODULE_KEY, recordId: safeRecordId },
    result,
  };
}

/**
 * Compare Arivu ItemInventory.onHand vs last known Tally snapshot on stock links.
 * @returns {{ organizationId, compared, driftCount, drifts: Array }}
 */
async function reconcileGodownBalances({ organizationId, companyGuid = null } = {}) {
  if (!organizationId) throw new Error('organizationId required');

  const query = {
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType: CONNECTOR_ENTITY_TYPES.STOCK,
  };
  if (companyGuid) query.companyGuid = String(companyGuid);

  const links = await ConnectorExternalObject.find(query).lean();
  const drifts = [];
  let compared = 0;

  for (const link of links) {
    const meta = link.metadata && typeof link.metadata === 'object' ? link.metadata : {};
    const tallyOnHand = meta.tallyOnHand != null
      ? Number(meta.tallyOnHand)
      : meta.lastKnownBalance != null
        ? Number(meta.lastKnownBalance)
        : null;
    if (tallyOnHand == null || !Number.isFinite(tallyOnHand)) continue;

    const inventoryLocationId = meta.inventoryLocationId || null;
    const variantId = meta.variantId || (link.arivuId && String(link.arivuId).includes(':')
      ? String(link.arivuId).split(':')[0]
      : link.arivuId);
    if (!inventoryLocationId || !variantId) continue;

    const balance = await ItemInventory.findOne({
      organizationId,
      variantId,
      inventoryLocationId,
    }).lean();

    const arivuOnHand = balance ? Number(balance.onHand || 0) : 0;
    compared += 1;
    const delta = arivuOnHand - tallyOnHand;
    if (Math.abs(delta) < 1e-9) continue;

    drifts.push({
      connectorExternalObjectId: String(link._id),
      externalId: link.externalId,
      variantId: String(variantId),
      inventoryLocationId,
      companyGuid: link.companyGuid || null,
      arivuOnHand,
      tallyOnHand,
      delta,
      lastSyncedAt: link.lastSyncedAt || null,
      snapshotAt: meta.lastIngestedAt || meta.snapshotAt || null,
    });
  }

  return {
    organizationId: String(organizationId),
    companyGuid: companyGuid || null,
    compared,
    driftCount: drifts.length,
    drifts,
  };
}

module.exports = {
  toTallySafeSourceRef,
  resolveStockSoT,
  pushStockMovement,
  ingestTallyStockJournal,
  reconcileGodownBalances,
  TALLY_STOCK_MODULE_KEY,
};


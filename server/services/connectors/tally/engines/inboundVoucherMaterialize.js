'use strict';

/**
 * ATIP 2C — first-class inbound voucher materialization into CRM when enabled.
 */

const ConnectorExternalObject = require('../../../../models/ConnectorExternalObject');
const { CONNECTOR_KEYS } = require('../../connectorConstants');
const synchronisationEngine = require('./synchronisationEngine');
const changeDetectionEngine = require('./changeDetectionEngine');
const conflictEngine = require('./conflictEngine');
const auditEngine = require('./auditEngine');
const errorIntelligenceEngine = require('./errorIntelligenceEngine');
const { VOUCHER_MODULE_KEYS } = require('../../../../constants/atipConstants');

const VOUCHER_TYPE_TO_MODULE = Object.freeze({
  Sales: 'sales',
  Purchase: 'purchase',
  Receipt: 'receipt',
  Payment: 'payment',
  'Credit Note': 'credit_note',
  'Debit Note': 'debit_note',
  Journal: 'journal',
  Contra: 'contra',
  'Stock Journal': 'stock_journal',
  'Delivery Note': 'delivery_note',
  'Receipt Note': 'receipt_note',
  'Sales Order': 'sales_order',
  'Purchase Order': 'purchase_order',
});

function resolveTallyModuleKey(voucherType, fallback = 'sales') {
  if (!voucherType) return fallback;
  if (VOUCHER_TYPE_TO_MODULE[voucherType]) return VOUCHER_TYPE_TO_MODULE[voucherType];
  const lower = String(voucherType).toLowerCase().replace(/\s+/g, '_');
  if (VOUCHER_MODULE_KEYS.includes(lower)) return lower;
  return fallback;
}

/**
 * After catalog upsert, optionally create/update CRM records for vouchers.
 */
async function maybeMaterializeInboundVouchers({
  organizationId,
  companyGuid,
  vouchers = [],
  jobId = null,
}) {
  const results = {
    reviewed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    conflicts: 0,
    errors: [],
  };

  for (const voucher of vouchers) {
    const tallyModuleKey = resolveTallyModuleKey(voucher.voucherType || voucher.VOUCHERTYPENAME);
    // eslint-disable-next-line no-await-in-loop
    const prepared = await synchronisationEngine.prepareInbound({
      organizationId,
      companyGuid,
      entityType: tallyModuleKey === 'sales' ? 'invoice' : tallyModuleKey,
      tallyModuleKey,
      tallyRecord: voucher,
    });

    results.reviewed += 1;

    if (!prepared.gate.allowed) {
      results.skipped += 1;
      continue;
    }

    if (!prepared.validation.ok) {
      results.skipped += 1;
      results.errors.push({
        voucher: voucher.voucherNumber || voucher.guid,
        issues: prepared.validation.errors,
      });
      continue;
    }

    const guid = changeDetectionEngine.extractGuid(voucher) || voucher.guid;
    const externalId = `tally:voucher:${String(guid || voucher.voucherNumber || '').toLowerCase()}`;

    // eslint-disable-next-line no-await-in-loop
    const existing = await ConnectorExternalObject.findOne({
      organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      entityType: 'voucher',
      externalId,
    });

    const policy = prepared.gate.policy || 'draft';
    const arivuPayload = {
      ...prepared.transformed.payload,
      status: policy === 'posted_if_valid' ? 'posted' : 'draft',
      invoiceType:
        tallyModuleKey === 'credit_note'
          ? 'credit_note'
          : tallyModuleKey === 'debit_note'
            ? 'debit_note'
            : tallyModuleKey === 'sales'
              ? 'sales'
              : undefined,
      externalReferenceId: guid,
      source: 'tally_inbound',
      tallyModuleKey,
      companyGuid,
      inventoryEntries: voucher.inventoryEntries || [],
      partyLedgerName: voucher.partyLedgerName || voucher.PARTYLEDGERNAME,
      voucherNumber: voucher.voucherNumber,
      voucherDate: voucher.date,
      reference: voucher.reference,
      irn: voucher.irn,
      placeOfSupply: voucher.placeOfSupply,
      partyGstin: voucher.partyGstin,
    };

    if (existing?.arivuId && !String(existing.arivuId).startsWith('pending:')) {
      const shouldConflict = conflictEngine.shouldRaiseConflict({
        arivuUpdatedAt: existing.updatedAt,
        tallyAlterId: voucher.ALTERID || voucher.alterId,
        lastSyncedAlterId: existing.metadata?.lastAlterId,
        lastSyncedArivuUpdatedAt: existing.metadata?.lastSyncedArivuUpdatedAt,
        policy: 'ask_user',
      });
      if (shouldConflict) {
        // eslint-disable-next-line no-await-in-loop
        await conflictEngine.createConflict({
          organizationId,
          companyGuid,
          entityType: tallyModuleKey,
          arivuId: existing.arivuId,
          remoteId: guid,
          arivuPayload: existing.metadata?.arivuSnapshot || null,
          remotePayload: voucher,
          reason: 'concurrent_modification',
        });
        results.conflicts += 1;
        continue;
      }
      existing.metadata = {
        ...(existing.metadata || {}),
        remotePayload: voucher,
        arivuDraft: arivuPayload,
        inboundPolicy: policy,
        lastInboundJobId: jobId,
        materialized: true,
        lastAlterId: voucher.ALTERID || voucher.alterId || null,
      };
      existing.markModified('metadata');
      // eslint-disable-next-line no-await-in-loop
      await existing.save();
      results.updated += 1;
    } else {
      // Materialize as linked external object with draft payload for CRM create pipeline
      // eslint-disable-next-line no-await-in-loop
      const { createFromExternal } = require('../tallyMappingService');
      try {
        // Prefer Mapping Center create path when available
        if (existing && typeof createFromExternal === 'function') {
          // eslint-disable-next-line no-await-in-loop
          await createFromExternal({
            organizationId,
            externalObjectId: String(existing._id),
          });
          results.created += 1;
        } else {
          // Store ready-to-create payload on catalog row
          if (existing) {
            existing.metadata = {
              ...(existing.metadata || {}),
              remotePayload: voucher,
              arivuDraft: arivuPayload,
              inboundPolicy: policy,
              pendingMaterialize: true,
              lastInboundJobId: jobId,
            };
            existing.markModified('metadata');
            // eslint-disable-next-line no-await-in-loop
            await existing.save();
          }
          results.created += 1;
        }
      } catch (err) {
        const enriched = errorIntelligenceEngine.enrichError(err, { tallyModuleKey, guid });
        results.errors.push({
          voucher: voucher.voucherNumber || guid,
          error: errorIntelligenceEngine.toUserPayload(enriched),
        });
        results.skipped += 1;
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await changeDetectionEngine.advanceWatermark({
      organizationId,
      companyGuid,
      tallyModuleKey,
      lastAlterId: voucher.ALTERID || voucher.alterId || null,
      lastMasterId: voucher.MASTERID || voucher.masterId || null,
    });
  }

  await auditEngine.recordEvent({
    organizationId,
    code: 'INBOUND_VOUCHERS_MATERIALIZED',
    message: `Inbound vouchers: created=${results.created} updated=${results.updated} skipped=${results.skipped}`,
    operation: 'inbound_materialize',
    payload: results,
  });

  return results;
}

module.exports = {
  VOUCHER_TYPE_TO_MODULE,
  resolveTallyModuleKey,
  maybeMaterializeInboundVouchers,
};

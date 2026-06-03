/**
 * INV2 — Rebuild ItemInventory rollups from ledger authority.
 *
 * Rebuild policy (locked):
 * - InventoryLedgerEntry is NEVER modified by rebuild
 * - Only ItemInventory rollups are recomputed from ledger + reservation sums
 */

const ItemInventory = require('../models/ItemInventory');
const InventoryLedgerEntry = require('../models/InventoryLedgerEntry');
const InventoryReservation = require('../models/InventoryReservation');
const { roundQty, INVENTORY_RESERVATION_ACTIVE_STATUSES } = require('../constants/inventoryLifecycle');
const { sumLedgerOnHand, recomputeItemInventory } = require('./inventoryRollupService');
const { sumActiveReservedQty } = require('./inventoryReservationService');
const { writeInventoryActivity } = require('./inventoryActivityService');

function qtyDiff(a, b) {
  return Math.abs(roundQty(a) - roundQty(b));
}

async function listLedgerBalancePairs({ organizationId }) {
  return InventoryLedgerEntry.aggregate([
    { $match: { organizationId, status: 'posted' } },
    {
      $group: {
        _id: {
          variantId: '$variantId',
          inventoryLocationId: '$inventoryLocationId'
        }
      }
    }
  ]);
}

async function listReservationBalancePairs({ organizationId }) {
  return InventoryReservation.aggregate([
    {
      $match: {
        organizationId,
        status: { $in: INVENTORY_RESERVATION_ACTIVE_STATUSES }
      }
    },
    {
      $group: {
        _id: {
          variantId: '$variantId',
          inventoryLocationId: '$inventoryLocationId'
        }
      }
    }
  ]);
}

/**
 * Read-only drift detection — does not mutate ledger or rollups.
 */
async function detectRollupDrift({ organizationId }) {
  const balances = await ItemInventory.find({ organizationId }).lean();
  const drift = [];

  for (const balance of balances) {
    const { onHand: ledgerOnHand } = await sumLedgerOnHand({
      organizationId,
      variantId: balance.variantId,
      inventoryLocationId: balance.inventoryLocationId
    });
    const ledgerReserved = await sumActiveReservedQty({
      organizationId,
      variantId: balance.variantId,
      inventoryLocationId: balance.inventoryLocationId
    });

    const onHandDrift = qtyDiff(balance.onHand, ledgerOnHand);
    const reservedDrift = qtyDiff(balance.reserved, ledgerReserved);

    if (onHandDrift > 0 || reservedDrift > 0) {
      drift.push({
        variantId: balance.variantId,
        inventoryLocationId: balance.inventoryLocationId,
        storedOnHand: roundQty(balance.onHand),
        ledgerOnHand: roundQty(ledgerOnHand),
        storedReserved: roundQty(balance.reserved),
        ledgerReserved: roundQty(ledgerReserved),
        onHandDrift,
        reservedDrift
      });
    }
  }

  return drift;
}

async function rebuildAllBalances({ organizationId, userId = null, detectDrift = true }) {
  const driftBefore = detectDrift ? await detectRollupDrift({ organizationId }) : [];

  const ledgerPairs = await listLedgerBalancePairs({ organizationId });
  const reservationPairs = await listReservationBalancePairs({ organizationId });

  const pairKey = (variantId, inventoryLocationId) =>
    `${String(variantId)}::${String(inventoryLocationId)}`;

  const merged = new Map();
  for (const row of ledgerPairs) {
    merged.set(pairKey(row._id.variantId, row._id.inventoryLocationId), row._id);
  }
  for (const row of reservationPairs) {
    merged.set(pairKey(row._id.variantId, row._id.inventoryLocationId), row._id);
  }

  const rebuilt = [];
  for (const pair of merged.values()) {
    const reserved = await sumActiveReservedQty({
      organizationId,
      variantId: pair.variantId,
      inventoryLocationId: pair.inventoryLocationId
    });
    rebuilt.push(
      await recomputeItemInventory({
        organizationId,
        variantId: pair.variantId,
        inventoryLocationId: pair.inventoryLocationId,
        reserved
      })
    );
  }

  const driftAfter = detectDrift ? await detectRollupDrift({ organizationId }) : [];

  await writeInventoryActivity({
    organizationId,
    recordId: String(organizationId),
    userId,
    action: 'inventory_balances_rebuilt',
    message: `Rebuilt ${rebuilt.length} inventory balance rows from ledger (ledger untouched)`,
    details: {
      count: rebuilt.length,
      driftBefore: driftBefore.length,
      driftAfter: driftAfter.length
    }
  });

  return {
    count: rebuilt.length,
    balances: rebuilt,
    driftBefore,
    driftAfter,
    ledgerUntouched: true
  };
}

async function rebuildBalance({ organizationId, variantId, inventoryLocationId, userId = null }) {
  const reserved = await sumActiveReservedQty({ organizationId, variantId, inventoryLocationId });
  const balance = await recomputeItemInventory({
    organizationId,
    variantId,
    inventoryLocationId,
    reserved
  });

  await writeInventoryActivity({
    organizationId,
    recordId: balance.itemInventoryId,
    userId,
    action: 'inventory_balance_rebuilt',
    message: 'Inventory balance rebuilt from ledger',
    details: { variantId, inventoryLocationId, onHand: balance.onHand, reserved: balance.reserved }
  });

  return balance;
}

module.exports = {
  rebuildAllBalances,
  rebuildBalance,
  detectRollupDrift
};

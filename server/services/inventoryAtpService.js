/**
 * INV1 — Available-to-promise read model.
 * Locked formula: ATP = onHand - reserved
 * INV4 optional extension: ATP += incoming when org includeIncomingInAtp
 */

const { roundQty, computeAtp, computeAtpExtended } = require('../constants/inventoryLifecycle');
const { getBalance } = require('./inventoryRollupService');
const { sumActiveReservedQty } = require('./inventoryReservationService');
const { getOrCreateSettings } = require('./inventorySettingsService');

async function getAtpForVariant({
  organizationId,
  variantId,
  inventoryLocationId,
  quantity = null
}) {
  const settings = await getOrCreateSettings(organizationId);
  const includeIncoming = Boolean(settings.includeIncomingInAtp);

  const balance =
    (await getBalance({ organizationId, variantId, inventoryLocationId })) || {};
  const onHand = roundQty(balance.onHand || 0);
  const reserved =
    balance.reserved != null
      ? roundQty(balance.reserved)
      : await sumActiveReservedQty({ organizationId, variantId, inventoryLocationId });
  const safetyStock = roundQty(balance.safetyStock || 0);
  const incoming = roundQty(balance.incoming || 0);
  const available = includeIncoming
    ? computeAtpExtended({ onHand, reserved, incoming, includeIncoming: true })
    : computeAtp({ onHand, reserved });

  const requestedQty = quantity != null ? roundQty(quantity) : null;
  const sufficient = requestedQty != null ? available >= requestedQty : null;

  return {
    variantId,
    inventoryLocationId,
    onHand,
    reserved,
    safetyStock,
    incoming,
    available,
    atpIncludesIncoming: includeIncoming,
    quantity: requestedQty,
    sufficient
  };
}

async function listAtpForVariants({
  organizationId,
  variantIds = [],
  inventoryLocationId,
  quantity = null
}) {
  const rows = [];
  for (const variantId of variantIds) {
    rows.push(
      await getAtpForVariant({
        organizationId,
        variantId,
        inventoryLocationId,
        quantity
      })
    );
  }
  return rows;
}

module.exports = {
  getAtpForVariant,
  listAtpForVariants
};

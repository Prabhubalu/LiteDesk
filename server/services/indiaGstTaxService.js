const {
  GST_COMPONENT_TYPES,
  resolvePlaceOfSupplyStub,
  normalizeStateCode
} = require('../constants/indiaGstConstants');

function toCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(cents) {
  return Math.round(cents) / 100;
}

function roundMoney(value) {
  return fromCents(toCents(value));
}

/**
 * Resolve place of supply (GTM-1 stub — same-state vs interstate).
 *
 * @param {{ sellerStateCode?: string|null, buyerStateCode?: string|null }} input
 * @returns {{
 *   placeOfSupplyStateCode: string|null,
 *   isInterstate: boolean,
 *   sellerStateCode: string|null,
 *   buyerStateCode: string|null,
 *   reason: string
 * }}
 */
function resolvePlaceOfSupply(input = {}) {
  const sellerStateCode = normalizeStateCode(input.sellerStateCode);
  const buyerStateCode = normalizeStateCode(input.buyerStateCode);
  const stub = resolvePlaceOfSupplyStub({ sellerStateCode, buyerStateCode });
  return {
    placeOfSupplyStateCode: stub.placeOfSupplyStateCode,
    isInterstate: stub.isInterstate,
    sellerStateCode,
    buyerStateCode,
    reason: stub.reason
  };
}

/**
 * Split a GST rate into CGST/SGST or IGST (CESS optional, default 0).
 *
 * @param {{
 *   taxableAmount: number,
 *   ratePercent: number,
 *   placeOfSupplyIsInterstate: boolean,
 *   cessRatePercent?: number
 * }} input
 * @returns {{
 *   cgst: { ratePercent: number, amount: number },
 *   sgst: { ratePercent: number, amount: number },
 *   igst: { ratePercent: number, amount: number },
 *   cess: { ratePercent: number, amount: number },
 *   taxTotal: number
 * }}
 */
function splitGstComponents(input = {}) {
  const taxableCents = toCents(input.taxableAmount);
  const rate = Number(input.ratePercent);
  const cessRate = Number(input.cessRatePercent ?? 0);
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  const safeCess = Number.isFinite(cessRate) && cessRate > 0 ? cessRate : 0;
  const interstate = Boolean(input.placeOfSupplyIsInterstate);

  const zero = { ratePercent: 0, amount: 0 };

  if (taxableCents <= 0 || safeRate <= 0) {
    const cessCents = safeCess > 0 ? Math.round((taxableCents * safeCess) / 100) : 0;
    return {
      cgst: { ...zero },
      sgst: { ...zero },
      igst: { ...zero },
      cess: { ratePercent: safeCess, amount: fromCents(cessCents) },
      taxTotal: fromCents(cessCents)
    };
  }

  let cgst = { ...zero };
  let sgst = { ...zero };
  let igst = { ...zero };

  if (interstate) {
    const igstCents = Math.round((taxableCents * safeRate) / 100);
    igst = { ratePercent: safeRate, amount: fromCents(igstCents) };
  } else {
    // Intra-state: equal CGST + SGST halves (odd rates: remainder on SGST).
    const halfRate = safeRate / 2;
    const totalTaxCents = Math.round((taxableCents * safeRate) / 100);
    const cgstCents = Math.floor(totalTaxCents / 2);
    const sgstCents = totalTaxCents - cgstCents;
    cgst = { ratePercent: roundMoney(halfRate), amount: fromCents(cgstCents) };
    sgst = { ratePercent: roundMoney(halfRate), amount: fromCents(sgstCents) };
  }

  const cessCents = safeCess > 0 ? Math.round((taxableCents * safeCess) / 100) : 0;
  const cess = { ratePercent: safeCess, amount: fromCents(cessCents) };

  const taxTotal = roundMoney(cgst.amount + sgst.amount + igst.amount + cess.amount);

  return { cgst, sgst, igst, cess, taxTotal };
}

/**
 * Build a GST tax snapshot for one or more document lines.
 *
 * @param {{
 *   lines?: Array<{
 *     lineId?: string|null,
 *     taxableAmount?: number,
 *     ratePercent?: number,
 *     hsnSac?: string|null,
 *     cessRatePercent?: number
 *   }>,
 *   sellerStateCode?: string|null,
 *   buyerStateCode?: string|null,
 *   placeOfSupplyIsInterstate?: boolean,
 *   placeOfSupplyStateCode?: string|null,
 *   partyGstin?: string|null
 * }} input
 * @returns {object}
 */
function buildGstTaxSnapshot(input = {}) {
  const pos =
    input.placeOfSupplyIsInterstate != null
      ? {
          placeOfSupplyStateCode: normalizeStateCode(input.placeOfSupplyStateCode) || null,
          isInterstate: Boolean(input.placeOfSupplyIsInterstate),
          sellerStateCode: normalizeStateCode(input.sellerStateCode),
          buyerStateCode: normalizeStateCode(input.buyerStateCode),
          reason: 'explicit'
        }
      : resolvePlaceOfSupply({
          sellerStateCode: input.sellerStateCode,
          buyerStateCode: input.buyerStateCode
        });

  const lines = Array.isArray(input.lines) ? input.lines : [];
  const lineSnapshots = [];
  const totals = {
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    taxTotal: 0
  };

  for (const line of lines) {
    const taxableAmount = Number(line.taxableAmount);
    const safeTaxable = Number.isFinite(taxableAmount) ? taxableAmount : 0;
    const components = splitGstComponents({
      taxableAmount: safeTaxable,
      ratePercent: line.ratePercent,
      placeOfSupplyIsInterstate: pos.isInterstate,
      cessRatePercent: line.cessRatePercent
    });

    lineSnapshots.push({
      lineId: line.lineId ?? null,
      hsnSac: line.hsnSac ?? null,
      taxableAmount: roundMoney(safeTaxable),
      ratePercent: Number(line.ratePercent) || 0,
      components: {
        [GST_COMPONENT_TYPES.CGST]: components.cgst,
        [GST_COMPONENT_TYPES.SGST]: components.sgst,
        [GST_COMPONENT_TYPES.IGST]: components.igst,
        [GST_COMPONENT_TYPES.CESS]: components.cess
      },
      taxTotal: components.taxTotal
    });

    totals.taxableAmount = roundMoney(totals.taxableAmount + safeTaxable);
    totals.cgst = roundMoney(totals.cgst + components.cgst.amount);
    totals.sgst = roundMoney(totals.sgst + components.sgst.amount);
    totals.igst = roundMoney(totals.igst + components.igst.amount);
    totals.cess = roundMoney(totals.cess + components.cess.amount);
    totals.taxTotal = roundMoney(totals.taxTotal + components.taxTotal);
  }

  return {
    schemaVersion: 1,
    placeOfSupply: {
      stateCode: pos.placeOfSupplyStateCode,
      isInterstate: pos.isInterstate,
      reason: pos.reason
    },
    sellerStateCode: pos.sellerStateCode,
    buyerStateCode: pos.buyerStateCode,
    partyGstin: input.partyGstin ?? null,
    lines: lineSnapshots,
    totals
  };
}

module.exports = {
  resolvePlaceOfSupply,
  splitGstComponents,
  buildGstTaxSnapshot
};

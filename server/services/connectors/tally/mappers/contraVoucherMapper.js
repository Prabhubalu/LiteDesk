/**
 * ContraEntry → Tally Contra voucher payload.
 */

function mapContraToTallyPayload(contra) {
  const lines = Array.isArray(contra.lines) ? contra.lines : [];
  return {
    voucherType: 'Contra',
    action: 'Create',
    date: contra.contraDate || contra.postedAt || new Date(),
    reference: contra.contraNumber || contra.contraEntryId || null,
    narration: contra.narration || contra.notes || null,
    ledgerEntries: lines.map((line) => ({
      ledgerName: line.ledgerName || null,
      amount: Number(line.debit || 0) - Number(line.credit || 0)
    })),
    externalKey: {
      entityType: 'contra_voucher',
      arivuId: String(contra.contraEntryId || contra._id)
    }
  };
}

module.exports = {
  mapContraToTallyPayload
};

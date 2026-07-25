/**
 * JournalEntry → Tally Journal voucher payload.
 * Policy: Arivu number stored as REFERENCE; Tally series owns VOUCHERNUMBER.
 * Prefer Cancel over Delete for synced vouchers.
 */

function mapJournalToTallyPayload(journal, { ledgerNameByRole = {} } = {}) {
  const lines = Array.isArray(journal.lines) ? journal.lines : [];
  return {
    voucherType: 'Journal',
    action: 'Create',
    date: journal.journalDate || journal.postedAt || new Date(),
    reference: journal.journalNumber || journal.journalEntryId || null,
    narration: journal.narration || journal.notes || null,
    ledgerEntries: lines.map((line) => ({
      ledgerName: line.ledgerName || ledgerNameByRole[line.roleKey] || line.ledgerCode || null,
      amount: Number(line.debit || 0) - Number(line.credit || 0),
      costCentre: line.costCentre || line.costCentreName || null
    })),
    externalKey: {
      entityType: 'journal_voucher',
      arivuId: String(journal.journalEntryId || journal._id)
    }
  };
}

module.exports = {
  mapJournalToTallyPayload
};

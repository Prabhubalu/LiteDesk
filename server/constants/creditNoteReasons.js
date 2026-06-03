const CREDIT_NOTE_REASONS = ['duplicate', 'return', 'pricing_error', 'goodwill', 'other'];

function assertValidCreditNoteReason(value) {
  const reason = String(value || '').trim();
  if (!reason) return null;
  if (!CREDIT_NOTE_REASONS.includes(reason)) {
    const err = new Error(`Invalid credit reason: ${reason}`);
    err.code = 'VALIDATION';
    err.details = { creditReason: reason, allowed: CREDIT_NOTE_REASONS };
    throw err;
  }
  return reason;
}

module.exports = {
  CREDIT_NOTE_REASONS,
  assertValidCreditNoteReason
};

/**
 * Quote validUntil helpers (aligned with server quoteExpiryService UTC calendar-day rule).
 */

export function getValidityExpiryInstant(validUntil) {
  if (!validUntil) return null;
  const d = new Date(validUntil);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
}

export function isQuoteValidityExpired(record, now = new Date()) {
  const expiryAt = getValidityExpiryInstant(record?.validUntil);
  if (!expiryAt) return false;
  return now.getTime() >= expiryAt.getTime();
}

export function daysUntilQuoteValidityEnds(record, now = new Date()) {
  const expiryAt = getValidityExpiryInstant(record?.validUntil);
  if (!expiryAt) return null;
  const ms = expiryAt.getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

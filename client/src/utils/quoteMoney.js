/**
 * Currency-aware formatting for quote UI (lines table, totals, headers).
 */

export function formatQuoteMoney(value, currencyCode, locale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const code = String(currencyCode || '').trim().toUpperCase();
  const loc = locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  if (code) {
    try {
      return new Intl.NumberFormat(loc, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(n);
    } catch {
      return `${code} ${n.toFixed(2)}`;
    }
  }
  return new Intl.NumberFormat(loc, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

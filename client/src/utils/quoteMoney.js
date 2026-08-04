/**
 * Currency-aware formatting for quote UI (lines table, totals, headers).
 * Honors user Currency & number preferences via formatCurrencyValue.
 *
 * Line-item money should never use K/M aggregation (that confuses unit prices).
 */

import { formatCurrencyValue } from '@/utils/currencyOptions';

/**
 * @param {unknown} value
 * @param {string} [currencyCode]
 * @param {unknown} [_locale]
 * @param {{ exact?: boolean }} [opts] exact=true disables K/M aggregation (PO / line editors)
 */
export function formatQuoteMoney(value, currencyCode, _locale, opts = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const code = String(currencyCode || '').trim().toUpperCase();
  return (
    formatCurrencyValue(n, {
      currencyCode: code || null,
      minimumFractionDigits: opts.exact === true ? 2 : undefined,
      maximumFractionDigits: opts.exact === true ? 2 : undefined,
      applyAggregation: opts.exact === true ? false : undefined
    }) || '—'
  );
}

/**
 * Currency-aware formatting for quote UI (lines table, totals, headers).
 * Honors user Currency & number preferences via formatCurrencyValue.
 */

import { formatCurrencyValue } from '@/utils/currencyOptions';

export function formatQuoteMoney(value, currencyCode, _locale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const code = String(currencyCode || '').trim().toUpperCase();
  return formatCurrencyValue(n, { currencyCode: code || null }) || '—';
}

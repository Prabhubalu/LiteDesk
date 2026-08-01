import { formatCurrency, formatNumber, formatUserDate, formatUserDateTime } from '@/utils/localeFormat';

export interface AnalyticsColumnFormat {
  key: string;
  label?: string;
  type?: string;
}

export function formatAnalyticsCellValue(
  value: unknown,
  column?: AnalyticsColumnFormat | null,
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const type = String(column?.type || '').toLowerCase();

  if (value instanceof Date) {
    return formatUserDateTime(value) || '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    if (type === 'currency' || column?.key?.toLowerCase().includes('amount')) {
      return formatCurrency(value) || String(value);
    }
    if (type === 'percent') {
      return `${formatNumber(value, { maximumFractionDigits: 2 })}%`;
    }
    return Number.isInteger(value)
      ? formatNumber(value)
      : formatNumber(value, { maximumFractionDigits: 2 });
  }

  if (typeof value === 'string') {
    if (type === 'date') {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return formatUserDate(new Date(parsed)) || value;
      }
    }
    if (type === 'datetime') {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return formatUserDateTime(new Date(parsed)) || value;
      }
    }
    return value;
  }

  if (typeof value === 'object') {
    const maybeId =
      typeof (value as { _id?: unknown })._id === 'string' ||
      typeof (value as { _id?: unknown })._id === 'object'
        ? String((value as { _id: unknown })._id)
        : '';
    if (type === 'user' && maybeId) {
      return maybeId;
    }
    return JSON.stringify(value);
  }

  return String(value);
}

export function buildMatrixDrillLabel(
  rowFilters: Record<string, unknown>,
  columnFilters: Record<string, unknown>,
  fieldLabels: Record<string, string> = {},
): string {
  const formatPart = (field: string, value: unknown) => {
    const label = fieldLabels[field] || field;
    const display =
      value === null || value === undefined || value === '' ? '(blank)' : String(value);
    return `${label}: ${display}`;
  };

  return [
    ...Object.entries(rowFilters).map(([field, value]) => formatPart(field, value)),
    ...Object.entries(columnFilters).map(([field, value]) => formatPart(field, value)),
  ].join(' · ');
}

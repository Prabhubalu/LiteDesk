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
    return value.toLocaleString();
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    if (type === 'currency' || column?.key?.toLowerCase().includes('amount')) {
      return value.toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      });
    }
    if (type === 'percent') {
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
    }
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  if (typeof value === 'string') {
    if (type === 'date' || type === 'datetime') {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toLocaleString();
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

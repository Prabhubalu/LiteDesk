export type AnalyticsDateRangePreset = 'last7days' | 'last30days' | 'thisMonth' | 'custom';

export interface AnalyticsDateRangeValue {
  preset?: AnalyticsDateRangePreset;
  from?: string;
  to?: string;
  field?: string;
}

export function resolveDateRange(value: AnalyticsDateRangeValue | null | undefined): AnalyticsDateRangeValue {
  const now = new Date();
  if (!value?.preset || value.preset === 'custom') {
    return {
      preset: value?.preset || 'custom',
      from: value?.from,
      to: value?.to,
      field: value?.field || 'createdAt',
    };
  }

  if (value.preset === 'last7days') {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { preset: value.preset, from: from.toISOString(), to: now.toISOString(), field: 'createdAt' };
  }

  if (value.preset === 'last30days') {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { preset: value.preset, from: from.toISOString(), to: now.toISOString(), field: 'createdAt' };
  }

  if (value.preset === 'thisMonth') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { preset: value.preset, from: from.toISOString(), to: now.toISOString(), field: 'createdAt' };
  }

  return { preset: value.preset, field: 'createdAt' };
}

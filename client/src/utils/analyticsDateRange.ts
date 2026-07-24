import {
  getThisMonthRange,
  getThisWeekRange,
  getTodayRange,
} from '@/utils/dateFilterOptions';

export type AnalyticsDateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'custom';

export interface AnalyticsDateRangeValue {
  preset?: AnalyticsDateRangePreset;
  from?: string;
  to?: string;
  field?: string;
}

function getYesterdayRange(): { from: Date; to: Date } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 1);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  to.setMilliseconds(-1);
  return { from, to };
}

function toIsoRange(from: Date, to: Date): { from: string; to: string } {
  return { from: from.toISOString(), to: to.toISOString() };
}

export function resolveDateRange(value: AnalyticsDateRangeValue | null | undefined): AnalyticsDateRangeValue {
  const now = new Date();
  const field = value?.field || 'createdAt';

  if (!value?.preset || value.preset === 'custom') {
    return {
      preset: value?.preset || 'custom',
      from: value?.from,
      to: value?.to,
      field,
    };
  }

  if (value.preset === 'today') {
    const range = getTodayRange();
    return { preset: value.preset, ...toIsoRange(range.from, range.to), field };
  }

  if (value.preset === 'yesterday') {
    const range = getYesterdayRange();
    return { preset: value.preset, ...toIsoRange(range.from, range.to), field };
  }

  if (value.preset === 'thisWeek') {
    const range = getThisWeekRange();
    return { preset: value.preset, ...toIsoRange(range.from, range.to), field };
  }

  if (value.preset === 'last7days') {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { preset: value.preset, from: from.toISOString(), to: now.toISOString(), field };
  }

  if (value.preset === 'last30days') {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { preset: value.preset, from: from.toISOString(), to: now.toISOString(), field };
  }

  if (value.preset === 'thisMonth') {
    const range = getThisMonthRange();
    return { preset: value.preset, ...toIsoRange(range.from, range.to), field };
  }

  return { preset: value.preset, field };
}

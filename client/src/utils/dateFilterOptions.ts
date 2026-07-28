/**
 * Date filter option groups and helpers for list view date filters.
 * Used by ListView and ModuleList for Quick Filters, Relative, Specific Date, and Data Status.
 */

export type DateFilterPreset =
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisQuarter'
  | 'thisYear'
  | 'fromNow'
  | 'beforeNow';
export type DateFilterOp = 'lastDays' | 'nextDays' | 'on' | 'before' | 'after' | 'between' | 'empty' | 'notEmpty';
export type DateFilterQuick =
  | 'beforeToday'
  | 'yesterday'
  | 'afterToday'
  | 'fromNow'
  | 'beforeNow';

export interface DateFilterValue {
  preset?: DateFilterPreset;
  op?: DateFilterOp;
  days?: number;
  date?: string;
  from?: string;
  to?: string;
  /** Client-only label hint for one-click Quick Filters that emit op+date */
  quick?: DateFilterQuick;
}

/** Option groups for the date filter dropdown */
export const DATE_FILTER_OPTION_GROUPS = [
  {
    label: 'Quick Filters',
    options: [
      { value: 'quick:beforeNow', label: 'Before now' },
      { value: 'quick:beforeToday', label: 'Before today' },
      { value: 'quick:yesterday', label: 'Yesterday' },
      { value: 'preset:today', label: 'Today' },
      { value: 'quick:fromNow', label: 'From now' },
      { value: 'quick:afterToday', label: 'After today' },
      { value: 'preset:thisWeek', label: 'This Week' },
      { value: 'preset:thisMonth', label: 'This Month' },
      { value: 'preset:thisQuarter', label: 'This Quarter' },
      { value: 'preset:thisYear', label: 'This Year' }
    ]
  },
  {
    label: 'Relative',
    options: [
      { value: 'op:lastDays', label: 'In the Last X Days', needsInput: 'days' },
      { value: 'op:nextDays', label: 'In the Next X Days', needsInput: 'days' }
    ]
  },
  {
    label: 'Specific Date',
    options: [
      { value: 'op:on', label: 'On', needsInput: 'date' },
      { value: 'op:before', label: 'Before', needsInput: 'date' },
      { value: 'op:after', label: 'After', needsInput: 'date' },
      { value: 'op:between', label: 'Between', needsInput: 'between' }
    ]
  },
  {
    label: 'Data Status',
    options: [
      { value: 'op:empty', label: 'Is Empty' },
      { value: 'op:notEmpty', label: 'Is Not Empty' }
    ]
  }
];

/** Parse stored filter value (object or legacy string) into DateFilterValue */
export function parseDateFilterValue(value: unknown): DateFilterValue | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && 'preset' in (value as object)) {
    return value as DateFilterValue;
  }
  if (typeof value === 'object' && 'op' in (value as object)) {
    return value as DateFilterValue;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return { op: 'on', date: value };
  }
  return null;
}

/** Get start and end of today (UTC-like local) */
export function getTodayRange(): { from: Date; to: Date } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  to.setMilliseconds(-1);
  return { from, to };
}

/** Get start and end of yesterday (local) */
export function getYesterdayRange(): { from: Date; to: Date } {
  const { from: todayStart } = getTodayRange();
  const from = new Date(todayStart);
  from.setDate(from.getDate() - 1);
  const to = new Date(todayStart);
  to.setMilliseconds(-1);
  return { from, to };
}

/** Get start and end of this week (Sun–Sat) */
export function getThisWeekRange(): { from: Date; to: Date } {
  const now = new Date();
  const day = now.getDay();
  const from = new Date(now);
  from.setDate(now.getDate() - day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(from.getDate() + 7);
  to.setMilliseconds(-1);
  return { from, to };
}

/** Get start and end of this month */
export function getThisMonthRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

/** Get start and end of this quarter */
export function getThisQuarterRange(): { from: Date; to: Date } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const from = new Date(now.getFullYear(), (q - 1) * 3, 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
  return { from, to };
}

/** Get start and end of this year */
export function getThisYearRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { from, to };
}

function sameCalendarDay(aIso: string | undefined, b: Date): boolean {
  if (!aIso) return false;
  const a = new Date(aIso);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Start of tomorrow (local) — used with server `after` ($gte start-of-day of date). */
export function getTomorrowStart(): Date {
  const { from: todayStart } = getTodayRange();
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

/**
 * Build one-click Quick Filter values (reuse existing op/before|on|after — no new server presets).
 * Server `before` = $lte end of that calendar day; `after` = $gte start of that calendar day.
 * So Before today → yesterday; After today → tomorrow.
 */
export function buildBeforeTodayFilterValue(): DateFilterValue {
  return { op: 'before', date: getYesterdayRange().from.toISOString(), quick: 'beforeToday' };
}

export function buildYesterdayFilterValue(): DateFilterValue {
  return { op: 'on', date: getYesterdayRange().from.toISOString(), quick: 'yesterday' };
}

export function buildAfterTodayFilterValue(): DateFilterValue {
  return { op: 'after', date: getTomorrowStart().toISOString(), quick: 'afterToday' };
}

/** Events Upcoming system view — startDateTime >= now (exact moment). */
export function buildFromNowFilterValue(): DateFilterValue {
  return { op: 'after', date: new Date().toISOString(), quick: 'fromNow' };
}

/** Events Past system view — startDateTime <= now (exact moment). */
export function buildBeforeNowFilterValue(): DateFilterValue {
  const now = new Date();
  now.setSeconds(now.getSeconds() - 1);
  return { op: 'before', date: now.toISOString(), quick: 'beforeNow' };
}

export function buildQuickDateFilterValue(quick: DateFilterQuick): DateFilterValue {
  if (quick === 'beforeNow') return buildBeforeNowFilterValue();
  if (quick === 'beforeToday') return buildBeforeTodayFilterValue();
  if (quick === 'yesterday') return buildYesterdayFilterValue();
  if (quick === 'fromNow') return buildFromNowFilterValue();
  return buildAfterTodayFilterValue();
}

/** Resolve which one-click Quick Filter (if any) matches a stored date filter value. */
export function resolveQuickDateFilter(value: DateFilterValue | null): DateFilterQuick | null {
  if (!value) return null;
  if (
    value.quick === 'beforeToday' ||
    value.quick === 'yesterday' ||
    value.quick === 'afterToday' ||
    value.quick === 'fromNow' ||
    value.quick === 'beforeNow'
  ) {
    return value.quick;
  }
  if (!value.op || !value.date) return null;
  const { from: yesterdayStart } = getYesterdayRange();
  const tomorrowStart = getTomorrowStart();
  if (value.op === 'before' && sameCalendarDay(value.date, yesterdayStart)) return 'beforeToday';
  if (value.op === 'on' && sameCalendarDay(value.date, yesterdayStart)) return 'yesterday';
  if (value.op === 'after' && sameCalendarDay(value.date, tomorrowStart)) return 'afterToday';
  return null;
}

/**
 * Expand events system-view `_special` markers into Filter UI DateFilterValues.
 * Preserves other keys (e.g. appointmentOnly).
 */
export function expandEventsSpecialViewFilters(
  filters: Record<string, unknown>,
  viewId?: string | null
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...filters };
  const special =
    (typeof next._special === 'string' ? next._special : null) ??
    (viewId === 'upcoming' || viewId === 'past' ? viewId : null);

  if ('_special' in next) delete next._special;

  if (special === 'upcoming') {
    next.startDateTime = buildFromNowFilterValue();
    delete next.endDateTime;
  } else if (special === 'past') {
    next.startDateTime = buildBeforeNowFilterValue();
    delete next.endDateTime;
  }

  return next;
}

/** Convert DateFilterValue to API-friendly params for a given field key (e.g. dueDate, startDateTime) */
export function dateFilterValueToParams(
  fieldKey: string,
  value: DateFilterValue | null
): Record<string, string | number | undefined> {
  if (!value) return {};
  const params: Record<string, string | number | undefined> = {};

  // Exact-moment quicks → named presets (calendar before/after would round to day boundaries)
  if (value.quick === 'fromNow' || value.preset === 'fromNow') {
    params[`${fieldKey}Preset`] = 'fromNow';
    return params;
  }
  if (value.quick === 'beforeNow' || value.preset === 'beforeNow') {
    params[`${fieldKey}Preset`] = 'beforeNow';
    return params;
  }

  if (value.preset) {
    params[`${fieldKey}Preset`] = value.preset;
    return params;
  }
  if (value.op === 'empty') {
    params[`${fieldKey}Op`] = 'empty';
    return params;
  }
  if (value.op === 'notEmpty') {
    params[`${fieldKey}Op`] = 'notEmpty';
    return params;
  }
  if (value.op === 'lastDays' && value.days != null) {
    params[`${fieldKey}Op`] = 'lastDays';
    params[`${fieldKey}Days`] = value.days;
    return params;
  }
  if (value.op === 'nextDays' && value.days != null) {
    params[`${fieldKey}Op`] = 'nextDays';
    params[`${fieldKey}Days`] = value.days;
    return params;
  }
  if (value.op === 'on' && value.date) {
    params[`${fieldKey}Op`] = 'on';
    params[fieldKey] = value.date;
    return params;
  }
  if (value.op === 'before' && value.date) {
    params[`${fieldKey}Op`] = 'before';
    params[`${fieldKey}To`] = value.date;
    return params;
  }
  if (value.op === 'after' && value.date) {
    params[`${fieldKey}Op`] = 'after';
    params[`${fieldKey}From`] = value.date;
    return params;
  }
  if (value.op === 'between' && value.from != null && value.to != null) {
    params[`${fieldKey}Op`] = 'between';
    params[`${fieldKey}From`] = value.from;
    params[`${fieldKey}To`] = value.to;
    return params;
  }
  return {};
}

/**
 * Expand any DateFilterValue objects in a filters map into flat API params.
 * Used product-wide so every module list handles Quick Filters the same way.
 */
export function expandAllDateFilterObjects(
  filters: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...filters };
  for (const [key, value] of Object.entries(normalized)) {
    if (key === 'filterQuery' || key === '_special') continue;
    if (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      ('preset' in (value as object) ||
        'op' in (value as object) ||
        'quick' in (value as object))
    ) {
      const params = dateFilterValueToParams(key, value as DateFilterValue);
      delete normalized[key];
      Object.assign(normalized, params);
    }
  }
  return normalized;
}

/** Human-readable label for current date filter value */
export function getDateFilterLabel(value: DateFilterValue | null): string {
  if (!value) return '';
  const quick = resolveQuickDateFilter(value);
  if (quick === 'beforeNow') return 'Before now';
  if (quick === 'beforeToday') return 'Before today';
  if (quick === 'yesterday') return 'Yesterday';
  if (quick === 'fromNow') return 'From now';
  if (quick === 'afterToday') return 'After today';
  if (value.preset) {
    const labels: Record<string, string> = {
      today: 'Today',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      thisQuarter: 'This Quarter',
      thisYear: 'This Year',
      fromNow: 'From now',
      beforeNow: 'Before now'
    };
    return labels[value.preset] || value.preset;
  }
  if (value.op === 'empty') return 'Is Empty';
  if (value.op === 'notEmpty') return 'Is Not Empty';
  if (value.op === 'lastDays' && value.days != null) return `In the Last ${value.days} Days`;
  if (value.op === 'nextDays' && value.days != null) return `In the Next ${value.days} Days`;
  if (value.op === 'on' && value.date) return `On ${formatDateLabel(value.date)}`;
  if (value.op === 'before' && value.date) return `Before ${formatDateLabel(value.date)}`;
  if (value.op === 'after' && value.date) return `After ${formatDateLabel(value.date)}`;
  if (value.op === 'between' && value.from != null && value.to != null) {
    return `${formatDateLabel(value.from)} – ${formatDateLabel(value.to)}`;
  }
  return '';
}

function formatDateLabel(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

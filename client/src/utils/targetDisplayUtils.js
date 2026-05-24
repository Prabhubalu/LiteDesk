/**
 * Shared display helpers for Targets & Quotas UI.
 */

export const LIFECYCLE_STYLES = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  locked: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  completed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export const STATUS_STYLES = {
  not_started: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  on_track: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  at_risk: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  achieved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  overachieved: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
};

export const APP_LABELS = {
  SALES: 'Sales',
  HELPDESK: 'Helpdesk',
  PLATFORM: 'Platform',
  MARKETING: 'Marketing',
  INVENTORY: 'Inventory',
};

export const MODULE_LABELS = {
  deals: 'Deals',
  cases: 'Cases',
  tasks: 'Tasks',
  forms: 'Forms',
  orders: 'Orders',
  items: 'Items',
};

export function targetProgressPercent(target) {
  const goal = Number(target?.targetValue) || 0;
  const achieved = Number(target?.achievedValue) || 0;
  if (goal <= 0) return 0;
  return Math.min(150, Math.round((achieved / goal) * 100));
}

export function progressBarWidth(pct) {
  return `${Math.min(100, Math.max(0, pct))}%`;
}

export function formatTargetValue(value, metricKind = 'count') {
  const n = Number(value) || 0;
  if (metricKind === 'currency') {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export function formatPeriodRange(start, end) {
  if (!start || !end) return '—';
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  const s = new Date(start).toLocaleDateString(undefined, opts);
  const e = new Date(end).toLocaleDateString(undefined, opts);
  return `${s} – ${e}`;
}

/** YYYY-MM-DD in local timezone (avoids UTC shift from toISOString). */
export function toLocalDateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getMonthRange(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { start: toLocalDateString(start), end: toLocalDateString(end) };
}

/** @param quarter 1–4 */
export function getQuarterRange(year, quarter) {
  const q = Math.min(4, Math.max(1, quarter));
  const start = new Date(year, (q - 1) * 3, 1);
  const end = new Date(year, q * 3, 0);
  return { start: toLocalDateString(start), end: toLocalDateString(end) };
}

export function currentCalendarQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

export function typeIconKey(key) {
  if (key === 'revenue') return 'currency';
  if (key === 'deal_count') return 'deals';
  if (key === 'case_resolution') return 'cases';
  if (key === 'task_completion') return 'tasks';
  return 'default';
}

/**
 * Centralized Intl formatters — components must not call toLocaleString directly.
 * @see client/docs/I18N_GUIDELINES.md
 */

import { DEFAULT_LOCALE } from '@/i18n/constants';

export type LocaleFormatContext = {
  locale?: string;
  timeZone?: string;
  currency?: string;
};

let context: LocaleFormatContext = {
  locale: DEFAULT_LOCALE,
  timeZone: 'UTC',
  currency: 'USD',
};

export function setLocaleFormatContext(next: Partial<LocaleFormatContext>): void {
  context = { ...context, ...next };
}

export function getLocaleFormatContext(): Readonly<LocaleFormatContext> {
  return context;
}

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  ctx: LocaleFormatContext = context
): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  try {
    return new Intl.NumberFormat(ctx.locale ?? DEFAULT_LOCALE, options).format(numeric);
  } catch {
    return String(numeric);
  }
}

export function formatCurrency(
  value: number,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
  ctx: LocaleFormatContext = context
): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  try {
    return new Intl.NumberFormat(ctx.locale ?? DEFAULT_LOCALE, {
      style: 'currency',
      currency: ctx.currency ?? 'USD',
      minimumFractionDigits: options.minimumFractionDigits ?? 2,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
    }).format(numeric);
  } catch {
    return null;
  }
}

export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  ctx: LocaleFormatContext = context
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(ctx.locale ?? DEFAULT_LOCALE, {
      timeZone: ctx.timeZone ?? 'UTC',
      ...options,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatTime(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' },
  ctx: LocaleFormatContext = context
): string {
  return formatDate(value, options, ctx);
}

export function formatRelativeTime(
  value: Date | string | number,
  base: Date = new Date(),
  ctx: LocaleFormatContext = context
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffSeconds = Math.round((date.getTime() - base.getTime()) / 1000);
  const ranges: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];

  try {
    const rtf = new Intl.RelativeTimeFormat(ctx.locale ?? DEFAULT_LOCALE, { numeric: 'auto' });
    for (const [unit, secondsInUnit] of ranges) {
      if (Math.abs(diffSeconds) >= secondsInUnit || unit === 'second') {
        const delta = Math.round(diffSeconds / secondsInUnit);
        return rtf.format(delta, unit);
      }
    }
  } catch {
    /* fall through */
  }

  return formatDate(date, { dateStyle: 'medium' }, ctx);
}

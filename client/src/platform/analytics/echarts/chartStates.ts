/**
 * Chart empty, error, and loading state copy + CSS class helpers.
 * i18n keys referenced in A3 components.
 */

export type AnalyticsChartState = 'loading' | 'empty' | 'error' | 'ready';

export const ANALYTICS_CHART_STATE_I18N = {
  loading: 'analytics.chartLoading',
  empty: 'analytics.chartEmpty',
  emptyFiltered: 'analytics.chartEmptyFiltered',
  error: 'analytics.chartError',
  errorRetry: 'analytics.chartErrorRetry',
  noPermission: 'analytics.chartNoPermission',
} as const;

export const ANALYTICS_CHART_STATE_CLASSES = {
  wrapper: 'relative flex min-h-[12rem] w-full items-center justify-center rounded-xl',
  loading:
    'animate-pulse rounded-xl bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800',
  empty: 'text-neutral-500 dark:text-neutral-400 text-sm text-center px-4',
  error: 'text-danger-600 dark:text-danger-400 text-sm text-center px-4',
} as const;

export interface AnalyticsChartStateContext {
  state: AnalyticsChartState;
  errorMessage?: string | null;
  hasFilters?: boolean;
}

export function resolveChartStateMessageKey(ctx: AnalyticsChartStateContext): string {
  if (ctx.state === 'loading') return ANALYTICS_CHART_STATE_I18N.loading;
  if (ctx.state === 'error') return ANALYTICS_CHART_STATE_I18N.error;
  if (ctx.state === 'empty') {
    return ctx.hasFilters
      ? ANALYTICS_CHART_STATE_I18N.emptyFiltered
      : ANALYTICS_CHART_STATE_I18N.empty;
  }
  return '';
}

/**
 * ECharts theme aligned with Arivu Design Tokens v1.0 (client/src/assets/main.css).
 * Used by all Analytics Platform widgets (A3+).
 *
 * Dependency: echarts (install in A3 — `npm install echarts vue-echarts`)
 */

export type AnalyticsChartThemeMode = 'light' | 'dark';

/** Series palette — saturated, dashboard-vivid, brand-led */
export const ANALYTICS_CHART_PALETTE = {
  light: [
    '#6049E7', // brand violet
    '#14B8A6', // vivid teal
    '#3B82F6', // electric blue
    '#EC4899', // hot pink
    '#F59E0B', // amber
    '#10B981', // emerald
    '#F97316', // orange
    '#06B6D4', // cyan
    '#EF4444', // red
    '#8B5CF6', // bright purple
  ],
  dark: [
    '#A78BFA', // luminous violet
    '#5EEAD4', // bright teal
    '#60A5FA', // sky blue
    '#F472B6', // pink
    '#FBBF24', // gold
    '#4ADE80', // green
    '#FB923C', // orange
    '#22D3EE', // cyan
    '#F87171', // coral red
    '#C084FC', // purple
  ],
} as const;

export const ANALYTICS_CHART_TOKENS = {
  light: {
    background: 'transparent',
    text: '#111827',
    textMuted: '#6b7280',
    axis: '#e5e7eb',
    splitLine: '#f3f4f6',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e5e7eb',
    empty: '#9ca3af',
  },
  dark: {
    background: 'transparent',
    text: '#f9fafb',
    textMuted: '#9ca3af',
    axis: '#374151',
    splitLine: '#1f2937',
    tooltipBg: '#1f2937',
    tooltipBorder: '#374151',
    empty: '#6b7280',
  },
} as const;

export const ANALYTICS_THRESHOLD_COLORS = {
  critical: '#ef4444',
  warning: '#f59e0b',
  good: '#10b981',
  neutral: '#6b7280',
} as const;

export const ANALYTICS_CHART_TYPOGRAPHY = {
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  titleSize: 13,
  labelSize: 12,
  axisSize: 11,
  tooltipSize: 12,
} as const;

export function buildAnalyticsEChartsTheme(mode: AnalyticsChartThemeMode = 'light') {
  const tokens = ANALYTICS_CHART_TOKENS[mode];
  const palette = ANALYTICS_CHART_PALETTE[mode];

  return {
    color: [...palette],
    backgroundColor: tokens.background,
    textStyle: {
      fontFamily: ANALYTICS_CHART_TYPOGRAPHY.fontFamily,
      color: tokens.text,
      fontSize: ANALYTICS_CHART_TYPOGRAPHY.labelSize,
    },
    title: {
      textStyle: {
        color: tokens.text,
        fontSize: ANALYTICS_CHART_TYPOGRAPHY.titleSize,
        fontWeight: 600,
      },
    },
    legend: {
      textStyle: { color: tokens.textMuted },
    },
    tooltip: {
      backgroundColor: tokens.tooltipBg,
      borderColor: 'transparent',
      borderWidth: 0,
      padding: [10, 14],
      textStyle: {
        color: tokens.text,
        fontSize: ANALYTICS_CHART_TYPOGRAPHY.tooltipSize,
      },
      extraCssText:
        mode === 'dark'
          ? 'box-shadow: 0 12px 32px rgba(0,0,0,0.45); border-radius: 10px;'
          : 'box-shadow: 0 10px 28px rgba(15,23,42,0.12); border-radius: 10px;',
    },
    categoryAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: tokens.textMuted,
        fontSize: ANALYTICS_CHART_TYPOGRAPHY.axisSize,
      },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: tokens.textMuted,
        fontSize: ANALYTICS_CHART_TYPOGRAPHY.axisSize,
      },
      splitLine: {
        lineStyle: { color: tokens.splitLine, type: 'dashed', width: 1 },
      },
    },
  };
}

export const ANALYTICS_ECHARTS_THEME_ID = 'arivu-analytics';

import { computed, type Ref } from 'vue';
import type { AnalyticsChartType } from '@/types/analytics.types';
import {
  buildAnalyticsEChartsTheme,
  ANALYTICS_ECHARTS_THEME_ID,
  type AnalyticsChartThemeMode,
} from './analyticsChartTheme';

export interface UseAnalyticsChartOptions {
  chartType: Ref<AnalyticsChartType | string>;
  themeMode?: Ref<AnalyticsChartThemeMode>;
}

let themeRegistered = false;

/**
 * Vue composable for Analytics ECharts widgets (A3).
 * Registers Arivu theme once; returns base option merge helpers.
 */
export function useAnalyticsChart(options: UseAnalyticsChartOptions) {
  const themeMode = options.themeMode ?? computed(() => 'light' as AnalyticsChartThemeMode);

  const theme = computed(() => buildAnalyticsEChartsTheme(themeMode.value));

  async function ensureThemeRegistered() {
    if (themeRegistered) return;
    const echarts = await import('echarts');
    echarts.registerTheme(ANALYTICS_ECHARTS_THEME_ID, buildAnalyticsEChartsTheme('light'));
    echarts.registerTheme(`${ANALYTICS_ECHARTS_THEME_ID}-dark`, buildAnalyticsEChartsTheme('dark'));
    themeRegistered = true;
  }

  function baseOption(overrides: Record<string, unknown> = {}) {
    return {
      animation: true,
      animationDuration: 680,
      animationEasing: 'cubicOut',
      grid: { left: 8, right: 12, top: 20, bottom: 8, containLabel: true },
      ...overrides,
    };
  }

  const themeId = computed(() =>
    themeMode.value === 'dark' ? `${ANALYTICS_ECHARTS_THEME_ID}-dark` : ANALYTICS_ECHARTS_THEME_ID
  );

  return {
    theme,
    themeId,
    ensureThemeRegistered,
    baseOption,
    chartType: options.chartType,
  };
}

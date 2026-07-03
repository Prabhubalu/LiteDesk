import {
  ANALYTICS_CHART_TYPOGRAPHY,
  ANALYTICS_CHART_TOKENS,
  type AnalyticsChartThemeMode,
} from './analyticsChartTheme';

export const ANALYTICS_CHART_ANIMATION = {
  duration: 680,
  easing: 'cubicOut',
  delay: (idx: number) => idx * 45,
} as const;

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Lighten a hex toward white for glossy chart fills */
function blendWithWhite(hex: string, amount: number): string {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const mix = Math.min(Math.max(amount, 0), 1);
  const lr = Math.round(r + (255 - r) * mix);
  const lg = Math.round(g + (255 - g) * mix);
  const lb = Math.round(b + (255 - b) * mix);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

/** Interleave hues so adjacent pie slices stay visually distinct */
const PIE_SLICE_COLOR_ORDER = [0, 2, 4, 1, 5, 3, 7, 8, 6, 9] as const;

export function seriesColorAt(palette: string[], index: number): string {
  return palette[index % palette.length] ?? palette[0] ?? '#6049E7';
}

export function seriesPieColorAt(palette: string[], index: number): string {
  const orderIndex = PIE_SLICE_COLOR_ORDER[index % PIE_SLICE_COLOR_ORDER.length] ?? index;
  return seriesColorAt(palette, orderIndex);
}

export function buildSeriesGradient(
  color: string,
  direction: 'vertical' | 'horizontal' = 'vertical',
  startAlpha = 1,
  endAlpha = 0.92,
  local = true,
): Record<string, unknown> {
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: direction === 'horizontal' ? 1 : 0,
    y2: direction === 'vertical' ? 1 : 0,
    global: !local,
    colorStops: [
      { offset: 0, color: blendWithWhite(color, 0.18) },
      { offset: 0.42, color: hexToRgba(color, startAlpha) },
      { offset: 1, color: hexToRgba(color, endAlpha) },
    ],
  };
}

export function buildAreaGradient(color: string, mode: AnalyticsChartThemeMode): Record<string, unknown> {
  const topAlpha = mode === 'dark' ? 0.42 : 0.28;
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    global: false,
    colorStops: [
      { offset: 0, color: hexToRgba(color, topAlpha) },
      { offset: 1, color: hexToRgba(color, 0.02) },
    ],
  };
}

export function buildPremiumTooltip(
  themeMode: AnalyticsChartThemeMode,
  trigger: 'axis' | 'item' = 'axis',
): Record<string, unknown> {
  const tokens = ANALYTICS_CHART_TOKENS[themeMode];
  const shadow = themeMode === 'dark' ? '0 12px 32px rgba(0,0,0,0.45)' : '0 10px 28px rgba(15,23,42,0.12)';

  return {
    trigger,
    backgroundColor: tokens.tooltipBg,
    borderWidth: 0,
    padding: [10, 14],
    textStyle: {
      color: tokens.text,
      fontFamily: ANALYTICS_CHART_TYPOGRAPHY.fontFamily,
      fontSize: ANALYTICS_CHART_TYPOGRAPHY.tooltipSize,
    },
    extraCssText: `box-shadow: ${shadow}; border-radius: 10px; backdrop-filter: blur(8px);`,
    ...(trigger === 'axis'
      ? {
          axisPointer: {
            type: 'line',
            lineStyle: {
              color: tokens.axis,
              width: 1,
              type: 'dashed',
            },
          },
        }
      : {}),
  };
}

export function buildPremiumGrid(): Record<string, unknown> {
  return {
    left: 12,
    right: 16,
    top: 24,
    bottom: 16,
    containLabel: true,
  };
}

export function buildCategoryAxis(
  themeMode: AnalyticsChartThemeMode,
  data: string[],
  horizontal = false,
): Record<string, unknown> {
  const tokens = ANALYTICS_CHART_TOKENS[themeMode];
  return {
    type: 'category',
    data: horizontal ? data.slice().reverse() : data,
    boundaryGap: true,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: tokens.textMuted,
      fontSize: ANALYTICS_CHART_TYPOGRAPHY.axisSize,
      fontFamily: ANALYTICS_CHART_TYPOGRAPHY.fontFamily,
      margin: 12,
    },
  };
}

export function buildValueAxis(themeMode: AnalyticsChartThemeMode): Record<string, unknown> {
  const tokens = ANALYTICS_CHART_TOKENS[themeMode];
  return {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: tokens.textMuted,
      fontSize: ANALYTICS_CHART_TYPOGRAPHY.axisSize,
      fontFamily: ANALYTICS_CHART_TYPOGRAPHY.fontFamily,
    },
    splitLine: {
      lineStyle: {
        color: tokens.splitLine,
        type: 'dashed',
        width: 1,
      },
    },
  };
}

export function buildBarSeriesItemStyle(
  color: string,
  horizontal = false,
): Record<string, unknown> {
  return {
    color: buildSeriesGradient(color, horizontal ? 'horizontal' : 'vertical', 1, 0.9, true),
    borderRadius: horizontal ? [0, 8, 8, 0] : [8, 8, 0, 0],
    shadowColor: hexToRgba(color, 0.28),
    shadowBlur: 6,
    shadowOffsetY: 2,
  };
}

export function buildIndexedBarItemStyle(
  palette: string[],
  index: number,
  horizontal = false,
): Record<string, unknown> {
  return buildBarSeriesItemStyle(seriesColorAt(palette, index), horizontal);
}

/** Radial fill for pie/donut slices — vivid center highlight, per-slice hue preserved */
export function buildPieSliceColor(color: string): Record<string, unknown> {
  return {
    color: {
      type: 'radial',
      x: 0.5,
      y: 0.5,
      r: 0.78,
      global: false,
      colorStops: [
        { offset: 0, color: blendWithWhite(color, 0.28) },
        { offset: 0.45, color: hexToRgba(color, 1) },
        { offset: 1, color: hexToRgba(color, 0.92) },
      ],
    },
  };
}

export function buildFunnelSliceColor(color: string): Record<string, unknown> {
  return {
    color: buildSeriesGradient(color, 'vertical', 1, 0.88, true),
  };
}

export function buildLineSeriesOptions(
  color: string,
  themeMode: AnalyticsChartThemeMode,
  config: { smooth?: boolean; area?: boolean },
): Record<string, unknown> {
  return {
    type: 'line',
    smooth: config.smooth !== false,
    symbol: 'circle',
    symbolSize: 7,
    showSymbol: false,
    lineStyle: {
      width: 2.75,
      color,
      cap: 'round',
      join: 'round',
      shadowColor: hexToRgba(color, 0.25),
      shadowBlur: 8,
      shadowOffsetY: 4,
    },
    itemStyle: {
      color,
      borderColor: themeMode === 'dark' ? '#111827' : '#ffffff',
      borderWidth: 2,
    },
    areaStyle: config.area ? { color: buildAreaGradient(color, themeMode) } : undefined,
    emphasis: {
      focus: 'series',
      scale: true,
      itemStyle: {
        shadowBlur: 12,
        shadowColor: hexToRgba(color, 0.35),
      },
    },
  };
}

export function buildPieSeriesOptions(
  chartType: string,
  themeMode: AnalyticsChartThemeMode,
): Record<string, unknown> {
  const isDonut = chartType === 'donut';
  const rim = themeMode === 'dark' ? '#111827' : '#ffffff';

  return {
    type: 'pie',
    colorBy: 'data',
    radius: isDonut ? ['46%', '72%'] : ['0%', '68%'],
    center: ['50%', isDonut ? '46%' : '50%'],
    padAngle: isDonut ? 2.5 : 1.5,
    itemStyle: {
      borderRadius: 10,
      borderColor: rim,
      borderWidth: 2,
    },
    label: {
      show: !isDonut,
      color: ANALYTICS_CHART_TOKENS[themeMode].textMuted,
      fontFamily: ANALYTICS_CHART_TYPOGRAPHY.fontFamily,
      fontSize: ANALYTICS_CHART_TYPOGRAPHY.labelSize,
      formatter: '{b}\n{d}%',
    },
    labelLine: {
      smooth: 0.25,
      length: 14,
      length2: 10,
      lineStyle: { color: ANALYTICS_CHART_TOKENS[themeMode].axis },
    },
    emphasis: {
      scale: true,
      scaleSize: 8,
      itemStyle: {
        shadowBlur: 22,
        shadowColor: themeMode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(96, 73, 231, 0.22)',
      },
    },
  };
}

export function buildChartAnimationBase(): Record<string, unknown> {
  return {
    animation: true,
    animationDuration: ANALYTICS_CHART_ANIMATION.duration,
    animationEasing: ANALYTICS_CHART_ANIMATION.easing,
  };
}

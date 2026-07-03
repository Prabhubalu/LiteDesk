import type { AnalyticsDashboardLayoutItem } from '@/types/analytics.types';

export type DashboardBreakpoint = 'desktop' | 'tablet' | 'mobile';

export function detectDashboardBreakpoint(width: number): DashboardBreakpoint {
  if (width < 768) return 'mobile';
  if (width < 1280) return 'tablet';
  return 'desktop';
}

export function adaptDashboardLayout(
  layout: AnalyticsDashboardLayoutItem[],
  breakpoint: DashboardBreakpoint,
): AnalyticsDashboardLayoutItem[] {
  if (!layout.length || breakpoint === 'desktop') {
    return layout;
  }

  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);

  if (breakpoint === 'tablet') {
    return sorted.map((item) => ({
      ...item,
      x: Math.min(Math.floor(item.x / 2), 5),
      w: Math.max(2, Math.min(6, Math.ceil(item.w / 2))),
    }));
  }

  let y = 0;
  return sorted.map((item) => {
    const next = { ...item, x: 0, w: 12, y, h: item.h };
    y += item.h;
    return next;
  });
}

export interface AnalyticsDrillFilter {
  field: string;
  operator: 'eq';
  value: string | number;
}

export function buildDrillFilterPayload(
  dimensionField: string,
  value: string | number,
): { logic: 'AND'; children: AnalyticsDrillFilter[] } {
  return {
    logic: 'AND',
    children: [{ field: dimensionField, operator: 'eq', value }],
  };
}

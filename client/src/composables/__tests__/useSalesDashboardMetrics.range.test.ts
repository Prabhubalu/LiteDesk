import { describe, it, expect } from 'vitest';
import { getDashboardRangeWindow } from '@/composables/useSalesDashboardMetrics';

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('getDashboardRangeWindow', () => {
  it('returns inclusive 12-week window ending today', () => {
    const now = new Date(2026, 6, 9, 15, 0, 0);
    const { start, end, days } = getDashboardRangeWindow('12w', now);
    expect(days).toBe(84);
    expect(ymd(end)).toBe('2026-07-09');
    expect(ymd(start)).toBe('2026-04-17');
  });

  it('falls back to 12w for unknown keys', () => {
    const { days } = getDashboardRangeWindow('nope', new Date(2026, 6, 9));
    expect(days).toBe(84);
  });
});

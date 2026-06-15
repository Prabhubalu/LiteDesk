/** Case record chrome — status/priority chip colors (aligned with Cases list defaults). */

export const CASE_STATUS_COLORS: Readonly<Record<string, string>> = Object.freeze({
  New: '#3B82F6',
  Assigned: '#6366F1',
  'In Progress': '#F59E0B',
  'On Hold': '#6B7280',
  'Waiting for Customer': '#8B5CF6',
  Resolved: '#10B981',
  Closed: '#6B7280'
});

export const CASE_PRIORITY_COLORS: Readonly<Record<string, string>> = Object.freeze({
  Low: '#6B7280',
  Medium: '#2563EB',
  High: '#D97706',
  Critical: '#DC2626'
});

export function hexToRgba(hex: string, alpha: number): string | null {
  if (!hex) return null;
  const h = String(hex).replace(/^#/, '');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function caseStatusColor(status: string | null | undefined): string | null {
  if (!status) return null;
  return CASE_STATUS_COLORS[status] ?? null;
}

export function casePriorityColor(priority: string | null | undefined): string | null {
  if (!priority) return null;
  return CASE_PRIORITY_COLORS[priority] ?? null;
}

export function caseChipSurfaceStyle(color: string | null | undefined): Record<string, string> {
  if (!color) return {};
  const bg = hexToRgba(color, 0.1);
  const ring = hexToRgba(color, 0.28);
  const style: Record<string, string> = {};
  if (bg) style.backgroundColor = bg;
  if (ring) style['--tw-ring-color'] = ring;
  return style;
}

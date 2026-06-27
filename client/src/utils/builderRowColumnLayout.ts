const GRID_COLUMNS = 12;

export function normalizeColumnSpan(raw: unknown): number {
  const span = Math.round(Number(raw) || GRID_COLUMNS);
  return Math.min(GRID_COLUMNS, Math.max(1, span));
}

export function normalizeRowGap(raw: unknown): number {
  const gap = Math.round(Number(raw) || 8);
  return Math.min(48, Math.max(0, gap));
}

export function resolveColumnWidthPercent(bindings: Record<string, unknown> = {}): number {
  if (bindings.widthPercent != null && bindings.widthPercent !== '') {
    return Math.min(100, Math.max(5, Number(bindings.widthPercent) || 100));
  }
  const span = normalizeColumnSpan(bindings.span);
  return Math.round((span / GRID_COLUMNS) * 10000) / 100;
}

export function resolveRowGapPx(bindings: Record<string, unknown> = {}): number {
  return normalizeRowGap(bindings.gap);
}

export function resolveRowCanvasClass(): string {
  return 'grid w-full grid-cols-12';
}

export function resolveRowCanvasStyle(bindings: Record<string, unknown> = {}): Record<string, string> {
  const gap = resolveRowGapPx(bindings);
  return gap ? { gap: `${gap}px` } : {};
}

export function resolveColumnCanvasStyle(bindings: Record<string, unknown> = {}): Record<string, string> {
  const span = normalizeColumnSpan(bindings.span);
  return {
    gridColumn: `span ${span} / span ${span}`,
    minWidth: '0'
  };
}

export function resolveColumnStackClass(): string {
  return 'flex w-full min-w-0 flex-col gap-3';
}

export function resolveRowLayoutCss(bindings: Record<string, unknown> = {}): string {
  const gap = resolveRowGapPx(bindings);
  return [
    'display:grid',
    'grid-template-columns:repeat(12,minmax(0,1fr))',
    'width:100%',
    gap ? `gap:${gap}px` : ''
  ].filter(Boolean).join(';');
}

export function resolveColumnLayoutCss(bindings: Record<string, unknown> = {}): string {
  const span = normalizeColumnSpan(bindings.span);
  return [
    `grid-column:span ${span}`,
    'min-width:0',
    'align-self:stretch'
  ].join(';');
}

export const BUILDER_ROW_COLUMN_SPAN_OPTIONS = [12, 9, 8, 6, 4, 3, 2, 1] as const;

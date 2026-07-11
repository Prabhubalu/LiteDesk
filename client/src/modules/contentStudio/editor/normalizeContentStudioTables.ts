import type { ProseMirrorJson } from '../types/contentStudio';

function parseLegacyColWidth(value: unknown): number[] | null {
  if (Array.isArray(value)) return value.map((item) => Number(item)).filter((n) => Number.isFinite(n));
  if (typeof value === 'string') {
    const match = value.match(/^(\d+(?:\.\d+)?)/);
    return match ? [Math.round(Number(match[1]))] : null;
  }
  return null;
}

function cleanupCellAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  const next = { ...attrs };
  if (next.colWidth) {
    const colwidth = parseLegacyColWidth(next.colWidth);
    if (colwidth) next.colwidth = colwidth;
    delete next.colWidth;
  }
  delete next.isHeader;
  return next;
}

function migrateNode(node: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...node };

  if (next.type === 'tableCell' && next.attrs && typeof next.attrs === 'object') {
    const attrs = next.attrs as Record<string, unknown>;
    if (attrs.isHeader) {
      return migrateNode({
        ...next,
        type: 'tableHeader',
        attrs: cleanupCellAttrs(attrs),
      });
    }
    next.attrs = cleanupCellAttrs(attrs);
  }

  if (Array.isArray(next.content)) {
    next.content = next.content.map((child) => migrateNode(child as Record<string, unknown>));
  }

  return next;
}

export function normalizeContentStudioTables(blocks: ProseMirrorJson | null | undefined): ProseMirrorJson {
  if (!blocks || blocks.type !== 'doc') {
    return blocks || { type: 'doc', content: [] };
  }
  return migrateNode(blocks as unknown as Record<string, unknown>) as unknown as ProseMirrorJson;
}

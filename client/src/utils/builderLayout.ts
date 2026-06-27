import type { ContentComponentNode } from '@/constants/contentComponentRegistry';
import {
  resolveContentAreaPx,
  resolvePageMarginsPx,
  type ContentAreaPx
} from '@/constants/contentPageSettings';

export const BUILDER_LAYOUT_MODES = {
  FLOW: 'flow',
  ABSOLUTE: 'absolute'
} as const;

export type BuilderLayoutMode = (typeof BUILDER_LAYOUT_MODES)[keyof typeof BUILDER_LAYOUT_MODES];

export const BUILDER_GRID_SIZE = 8;

/** @deprecated use resolvePageMarginsPx() — kept for imports that expect inset shape */
export const BUILDER_CONTENT_INSET = resolvePageMarginsPx();

export interface BuilderBlockLayout {
  [key: string]: unknown;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
}

const DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
  Heading: { width: 320, height: 48 },
  Paragraph: { width: 400, height: 72 },
  MergeTag: { width: 200, height: 32 },
  Table: { width: 520, height: 200 },
  Image: { width: 160, height: 120 },
  Divider: { width: 480, height: 2 },
  Spacer: { width: 480, height: 24 },
  PageBreak: { width: 480, height: 24 },
  Section: { width: 520, height: 240 }
};

export function snapToGrid(value: number, grid = BUILDER_GRID_SIZE): number {
  return Math.round(value / grid) * grid;
}

export function resolveLayoutMode(page: ContentComponentNode | null | undefined): BuilderLayoutMode {
  const mode = page?.bindings?.layoutMode;
  if (mode === BUILDER_LAYOUT_MODES.FLOW || mode === BUILDER_LAYOUT_MODES.ABSOLUTE) {
    return mode;
  }

  const children = page?.children || [];
  const hasAbsolutePositions = children.some(
    (child) => typeof child.layout?.x === 'number' || typeof child.layout?.y === 'number'
  );
  if (hasAbsolutePositions) return BUILDER_LAYOUT_MODES.ABSOLUTE;

  return BUILDER_LAYOUT_MODES.FLOW;
}

function defaultSizeForType(type: string, contentWidthPx: number): { width: number; height: number } {
  const fallback = { width: 240, height: 80 };
  const size = DEFAULT_SIZES[type] || fallback;
  const maxWidth = Math.max(120, contentWidthPx);
  const fullWidthTypes = new Set(['Table', 'Heading', 'Paragraph', 'Divider', 'Spacer', 'PageBreak']);
  if (fullWidthTypes.has(type)) {
    return { width: maxWidth, height: size.height };
  }
  return {
    width: Math.min(size.width, maxWidth),
    height: size.height
  };
}

export function clampLayoutToContentArea(
  layout: BuilderBlockLayout,
  contentArea: ContentAreaPx
): BuilderBlockLayout {
  const width = Math.max(32, Number(layout.width) || 240);
  const height = Math.max(32, Number(layout.height) || 80);
  const maxX = contentArea.x + Math.max(0, contentArea.width - width);
  const maxY = contentArea.y + Math.max(0, contentArea.height - height);

  return {
    ...layout,
    width,
    height,
    x: snapToGrid(Math.min(maxX, Math.max(contentArea.x, Number(layout.x) || contentArea.x))),
    y: snapToGrid(Math.min(maxY, Math.max(contentArea.y, Number(layout.y) || contentArea.y)))
  };
}

export function getDefaultBlockLayout(
  type: string,
  existingChildren: ContentComponentNode[],
  pageWidthPx: number,
  pageHeightPx: number
): BuilderBlockLayout {
  const margins = resolvePageMarginsPx();
  const contentArea = resolveContentAreaPx(pageWidthPx, pageHeightPx, margins);
  const size = defaultSizeForType(type, contentArea.width);
  let y = contentArea.y;

  for (const child of existingChildren) {
    const layout = child.layout || {};
    const childY = Number(layout.y) || contentArea.y;
    const childHeight = Number(layout.height) || defaultSizeForType(String(child.type), contentArea.width).height;
    y = Math.max(y, childY + childHeight + 16);
  }

  const maxZ = existingChildren.reduce(
    (max, child) => Math.max(max, Number(child.layout?.zIndex) || 0),
    0
  );

  return clampLayoutToContentArea({
    x: contentArea.x,
    y: existingChildren.length ? y : contentArea.y,
    width: size.width,
    height: size.height,
    zIndex: maxZ + 1
  }, contentArea);
}

export function layoutAtPoint(
  x: number,
  y: number,
  type: string,
  pageWidthPx: number,
  pageHeightPx: number,
  zIndex: number
): BuilderBlockLayout {
  const contentArea = resolveContentAreaPx(pageWidthPx, pageHeightPx, resolvePageMarginsPx());
  const size = defaultSizeForType(type, contentArea.width);

  return clampLayoutToContentArea({
    x: snapToGrid(x - size.width / 2),
    y: snapToGrid(y - size.height / 2),
    width: size.width,
    height: size.height,
    zIndex
  }, contentArea);
}

export function ensureNodeLayout(
  node: ContentComponentNode,
  existingChildren: ContentComponentNode[],
  pageWidthPx: number,
  pageHeightPx = 1123
): ContentComponentNode {
  if (node.layout?.x != null && node.layout?.y != null) return node;
  return {
    ...node,
    layout: getDefaultBlockLayout(String(node.type), existingChildren, pageWidthPx, pageHeightPx)
  };
}

export function migrateFlowChildrenToAbsolute(
  page: ContentComponentNode,
  pageWidthPx: number,
  pageHeightPx = 1123
): ContentComponentNode {
  const next = JSON.parse(JSON.stringify(page)) as ContentComponentNode;
  const contentArea = resolveContentAreaPx(pageWidthPx, pageHeightPx, resolvePageMarginsPx());
  let y = contentArea.y;
  const children = next.children || [];

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!child) continue;

    if (typeof child.layout?.x === 'number' && typeof child.layout?.y === 'number') {
      y = Math.max(y, Number(child.layout.y) + Number(child.layout.height || 80) + 16);
      continue;
    }

    const layout = getDefaultBlockLayout(String(child.type), children.slice(0, index), pageWidthPx, pageHeightPx);
    layout.y = y;
    layout.zIndex = index + 1;
    child.layout = clampLayoutToContentArea(layout, contentArea);
    y += layout.height + 16;
  }

  next.bindings = {
    ...(next.bindings || {}),
    layoutMode: BUILDER_LAYOUT_MODES.ABSOLUTE
  };

  return next;
}

export function sortNodesByZIndex(nodes: ContentComponentNode[]): ContentComponentNode[] {
  return [...nodes].sort((left, right) => {
    const leftZ = Number(left.layout?.zIndex) || 0;
    const rightZ = Number(right.layout?.zIndex) || 0;
    return leftZ - rightZ;
  });
}

export function applyZIndexFromOrder(orderedIds: string[], nodes: ContentComponentNode[]): ContentComponentNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const result: ContentComponentNode[] = [];
  orderedIds.forEach((id, index) => {
    const node = byId.get(id);
    if (!node) return;
    result.push({
      ...node,
      layout: {
        ...(node.layout || {}),
        zIndex: index + 1
      }
    });
  });
  return result;
}

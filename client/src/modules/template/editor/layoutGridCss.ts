import type { Component, Editor } from 'grapesjs';

export const LAYOUT_GRID_STYLE_ID = 'arivu-layout-grid';

/** Marker comment embedded in serialized template CSS. */
export const LAYOUT_GRID_CSS_MARKER = 'arivu-layout-grid';

/** Fixed-page layout rules for Grapes basic-blocks rows/cells (no responsive stacking). */
export const LAYOUT_GRID_FRAME_CSS = `
  .gjs-row {
    display: flex !important;
    flex-direction: row;
    justify-content: flex-start !important;
    align-items: stretch;
    flex-wrap: nowrap;
    padding: 10px !important;
    width: 100% !important;
    min-height: 95px;
    box-sizing: border-box !important;
  }

  .gjs-cell {
    display: flex !important;
    flex-direction: column !important;
    justify-content: flex-start;
    align-items: flex-start;
    align-self: auto;
    width: auto !important;
    max-width: none !important;
    min-height: 75px !important;
    min-width: 0;
    flex-grow: 1 !important;
    flex-shrink: 1 !important;
    flex-basis: 0 !important;
    box-sizing: border-box !important;
  }

  .gjs-cell30 {
    flex-grow: 0 !important;
    flex-basis: 30% !important;
    max-width: 30% !important;
  }

  .gjs-cell70 {
    flex-grow: 0 !important;
    flex-basis: 70% !important;
    max-width: 70% !important;
  }

  @media (max-width: 768px) {
    .gjs-row {
      display: flex !important;
      flex-wrap: nowrap;
      min-height: 95px;
    }

    .gjs-cell {
      display: flex !important;
      width: auto !important;
      max-width: none !important;
      min-height: 75px !important;
      flex-grow: 1 !important;
      flex-shrink: 1 !important;
      flex-basis: 0 !important;
    }

    .gjs-cell30 {
      flex-grow: 0 !important;
      flex-basis: 30% !important;
      max-width: 30% !important;
    }

    .gjs-cell70 {
      flex-grow: 0 !important;
      flex-basis: 70% !important;
      max-width: 70% !important;
    }
  }
`;

export function appendLayoutGridCss(css: string): string {
  const trimmed = String(css || '').trim();
  if (trimmed.includes(LAYOUT_GRID_CSS_MARKER)) {
    return trimmed;
  }
  if (!trimmed) {
    return `/* ${LAYOUT_GRID_CSS_MARKER} */${LAYOUT_GRID_FRAME_CSS}`;
  }
  return `${trimmed}\n/* ${LAYOUT_GRID_CSS_MARKER} */${LAYOUT_GRID_FRAME_CSS}`;
}

export function injectLayoutGridFrameCss(editor: Editor): void {
  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (!doc) return;

  let styleEl = doc.getElementById(LAYOUT_GRID_STYLE_ID);
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = LAYOUT_GRID_STYLE_ID;
    doc.head.appendChild(styleEl);
  }

  styleEl.textContent = LAYOUT_GRID_FRAME_CSS;
}

export function isEmbeddedLayoutGridStyle(component: Component): boolean {
  const tag = String(component.get('tagName') || '').toLowerCase();
  if (tag !== 'style') return false;

  const content = String(component.get('content') || '');
  return content.includes('gjs-row') || content.includes('gjs-cell');
}

export function stripEmbeddedLayoutGridStyleTags(root: Component | null | undefined): void {
  if (!root) return;

  const children = [...root.components()];
  for (const child of children) {
    if (isEmbeddedLayoutGridStyle(child)) {
      child.remove();
      continue;
    }
    stripEmbeddedLayoutGridStyleTags(child);
  }
}

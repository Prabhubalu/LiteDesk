import { LAYOUT_GRID_FRAME_CSS } from './layoutGridCss';
import type { TemplateOutputFormat } from './plugins';

/** Shared GrapesJS canvas chrome (selection, placeholders, merge chips). */
export const GRAPES_CANVAS_CHROME_CSS = `
  [data-gjs-highlightable],
  .gjs-dashed [data-gjs-highlightable] {
    outline: none !important;
  }

  .gjs-selected {
    outline: 2px solid #6049E7 !important;
    outline-offset: -2px;
  }

  .gjs-selected-parent {
    outline: none !important;
  }

  .gjs-plh-image {
    background: #fafafa;
    outline: none !important;
    border: 1px dashed #d4d4d4;
    border-radius: 4px;
  }

  ::selection {
    background: rgb(96 73 231 / 0.22);
    color: inherit;
  }

  [contenteditable='true'],
  .arivu-inline-text-editing,
  .arivu-sheet-cell-editing {
    caret-color: #6049e7 !important;
    outline: none !important;
    white-space: pre-wrap;
  }

  .gjs-selected[contenteditable='true'],
  .gjs-selected.arivu-inline-text-editing {
    outline: none !important;
    box-shadow: inset 0 0 0 1px rgb(96 73 231 / 0.35) !important;
  }

  .builder-merge-chip {
    display: inline;
    padding: 0 4px;
    margin: 0 1px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: #eef2ff;
    color: #4338ca;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: inherit;
    vertical-align: baseline;
    user-select: none;
    pointer-events: none;
    -webkit-user-modify: read-only;
    box-shadow: none;
  }

  [contenteditable='true'] .builder-merge-chip,
  .arivu-inline-text-editing .builder-merge-chip,
  .arivu-sheet-cell-editing .builder-merge-chip {
    border-color: #c7d2fe;
  }
`;

/** PDF canvas: keep block text whitespace for document editing. */
export const GRAPES_PDF_TEXT_BLOCK_CSS = `
  [data-text-block='true'],
  [data-paragraph='true'],
  [data-heading='true'],
  [data-rich-text='true'],
  [data-address-block='true'],
  [data-organization-block='true'] {
    display: block;
    white-space: pre-wrap;
  }
`;

/** PDF builder table/sheet editing rules — must not leak into email canvas. */
export const GRAPES_PDF_BUILDER_CANVAS_CSS = `
  ${LAYOUT_GRID_FRAME_CSS}

  table {
    table-layout: fixed;
    border-collapse: collapse;
    max-width: 100%;
  }

  td,
  th {
    position: relative;
    vertical-align: top;
    min-height: 2rem;
    overflow: visible;
    width: auto !important;
    max-width: none !important;
  }

  td.arivu-sheet-cell-editing,
  th.arivu-sheet-cell-editing {
    outline: 2px solid #6049E7 !important;
    outline-offset: -2px;
    white-space: pre-wrap;
  }

  td.arivu-table-cell-in-range,
  th.arivu-table-cell-in-range {
    box-shadow: inset 0 0 0 2px rgb(96 73 231 / 0.45);
    background: rgb(96 73 231 / 0.08);
  }

  td.arivu-table-cell-range-primary,
  th.arivu-table-cell-range-primary {
    box-shadow: inset 0 0 0 2px #6049E7;
    background: rgb(96 73 231 / 0.14);
  }

  body.arivu-table-col-resizing {
    cursor: col-resize !important;
    user-select: none;
  }

  body.arivu-table-col-resizing * {
    cursor: col-resize !important;
  }

  .arivu-line-item-block {
    width: 100%;
  }
`;

/** Minimal email canvas helpers — no structural overrides on tables/cells. */
export const GRAPES_EMAIL_CANVAS_CSS = `
  img {
    max-width: 100%;
    height: auto;
  }

  table {
    max-width: 100%;
  }

  /* Email HTML uses normal whitespace; pre-wrap makes indent/spaces shove text while editing. */
  [contenteditable='true'],
  .arivu-inline-text-editing {
    white-space: normal;
  }
`;

/** @deprecated Use resolveCanvasFrameCss — kept for tests referencing the PDF default. */
export const GRAPES_CANVAS_FRAME_CSS = `${GRAPES_CANVAS_CHROME_CSS}${GRAPES_PDF_TEXT_BLOCK_CSS}${GRAPES_PDF_BUILDER_CANVAS_CSS}`;

export function resolveCanvasFrameCss(outputFormat: TemplateOutputFormat = 'pdf'): string {
  if (outputFormat === 'email') {
    return `${GRAPES_CANVAS_CHROME_CSS}${GRAPES_EMAIL_CANVAS_CSS}`;
  }
  return GRAPES_CANVAS_FRAME_CSS;
}

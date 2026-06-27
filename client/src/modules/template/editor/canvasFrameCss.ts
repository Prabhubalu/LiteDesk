import { LAYOUT_GRID_FRAME_CSS } from './layoutGridCss';

/** Injected into the GrapesJS canvas iframe — clean edit chrome, no structural noise. */
export const GRAPES_CANVAS_FRAME_CSS = `
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

  .builder-merge-chip {
    display: inline-block;
    padding: 1px 6px;
    margin: 0 1px;
    border-radius: 4px;
    background: #eef2ff;
    color: #4338ca;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.4;
    vertical-align: baseline;
    user-select: none;
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

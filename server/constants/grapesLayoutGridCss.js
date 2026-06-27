'use strict';

/**
 * Keep in sync with client/src/modules/template/editor/layoutGridCss.ts
 * Required for grapes gjs-row / gjs-cell layouts in PDF and preview output.
 */
const GRAPES_LAYOUT_GRID_CSS = `
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

module.exports = {
  GRAPES_LAYOUT_GRID_CSS
};

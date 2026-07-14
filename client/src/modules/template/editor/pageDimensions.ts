import type { Editor } from 'grapesjs';
import {
  DEFAULT_PAGE_MARGINS_MM,
  type PageMarginsMm
} from '@/constants/contentPageSettings';
import {
  applyPrintAreaLayout,
  bindLayoutGridGuards,
  bindPrintAreaGuards,
  ensurePrintArea,
  registerPrintAreaComponent,
  registerLayoutGridComponents
} from './printArea';
import { bindTableSelection } from './tableActions';
import { bindTableCellResizeHandle } from './tableColumnResize';
import { bindTableSheetEditor } from './tableSheetEditor';
import { bindCanvasTextInsertion } from './canvasInsertion';
import { repairAllTextComponents, hydrateEditableTextComponents } from './textContent';

const PAGE_DIMENSIONS_STYLE_ID = 'arivu-page-dimensions';

export interface PageDimensionsPx {
  width: number;
  height: number;
}

export interface PageLayoutOptions {
  dimensions: PageDimensionsPx;
  marginsMm?: Partial<PageMarginsMm>;
  isEmail?: boolean;
}

export function parseDimensionPx(value: string | number | undefined | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const parsed = parseInt(String(value || '').replace(/px$/i, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function injectPageDimensionCss(editor: Editor, width: number, height: number): void {
  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (!doc) return;

  let styleEl = doc.getElementById(PAGE_DIMENSIONS_STYLE_ID);
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = PAGE_DIMENSIONS_STYLE_ID;
    doc.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    html, body {
      width: ${width}px;
      max-width: ${width}px;
      min-width: ${width}px;
      height: 100%;
      margin: 0;
      min-height: ${height}px;
      overflow-x: hidden;
    }

    [data-gjs-type="wrapper"] {
      width: ${width}px !important;
      max-width: ${width}px !important;
      min-width: ${width}px !important;
      min-height: ${height}px !important;
      box-sizing: border-box;
    }
  `;
}

export function applyPageDimensions(editor: Editor, options: PageLayoutOptions): void {
  const { width, height } = options.dimensions;
  if (!width || !height) return;

  const widthPx = `${width}px`;
  const heightPx = `${height}px`;

  const frame = editor.Canvas.getFrames()[0];
  if (frame) {
    frame.set({ width: widthPx, height: heightPx }, { noUndo: true });
  }

  if (options.isEmail) {
    injectEmailCanvasCss(editor, width, height);
    return;
  }

  ensurePrintArea(editor);
  applyPrintAreaLayout(editor, options.dimensions, options.marginsMm);

  injectPageDimensionCss(editor, width, height);
}

function injectEmailCanvasCss(editor: Editor, width: number, height: number): void {
  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (!doc) return;

  let styleEl = doc.getElementById(PAGE_DIMENSIONS_STYLE_ID);
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = PAGE_DIMENSIONS_STYLE_ID;
    doc.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    html, body {
      margin: 0;
      padding: 0;
      min-height: ${height}px;
      background: #f3f4f6;
    }

    [data-gjs-type="wrapper"] {
      width: ${width}px !important;
      max-width: ${width}px !important;
      min-height: ${height}px !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
      background: #ffffff;
    }
  `;
}

export interface PageLayoutSetupOptions {
  isEmail?: boolean;
}

export function setupPageLayout(editor: Editor, options: PageLayoutSetupOptions = {}): void {
  // Email still needs caret lock + merge-chip RTE for Variables panel inserts.
  bindCanvasTextInsertion(editor);

  if (options.isEmail) {
    const repairText = () => {
      const wrapper = editor.getWrapper();
      if (!wrapper) return;
      repairAllTextComponents(wrapper);
      hydrateEditableTextComponents(wrapper);
    };
    editor.on('load', repairText);
    editor.on('project:load', repairText);
    return;
  }

  registerPrintAreaComponent(editor);
  registerLayoutGridComponents(editor);
  bindLayoutGridGuards(editor);
  bindPrintAreaGuards(editor);
  bindTableSelection(editor);
  bindTableSheetEditor(editor);

  const repairText = () => {
    const wrapper = editor.getWrapper();
    if (!wrapper) return;
    repairAllTextComponents(wrapper);
    hydrateEditableTextComponents(wrapper);
  };
  editor.on('load', repairText);
  editor.on('project:load', repairText);

  bindTableCellResizeHandle(editor);
}

export function bindPageDimensionFrameCss(
  editor: Editor,
  getLayout: () => PageLayoutOptions
): void {
  const apply = () => {
    const layout = getLayout();
    if (layout.dimensions.width && layout.dimensions.height) {
      if (!layout.isEmail) {
        injectPageDimensionCss(editor, layout.dimensions.width, layout.dimensions.height);
      }
      applyPageDimensions(editor, layout);
    }
  };

  editor.on('canvas:frame:load', apply);
  editor.on('load', apply);
}

export function resolveTemplateMarginsMm(
  margins?: Partial<PageMarginsMm> | null
): PageMarginsMm {
  return {
    top: margins?.top ?? DEFAULT_PAGE_MARGINS_MM.top,
    right: margins?.right ?? DEFAULT_PAGE_MARGINS_MM.right,
    bottom: margins?.bottom ?? DEFAULT_PAGE_MARGINS_MM.bottom,
    left: margins?.left ?? DEFAULT_PAGE_MARGINS_MM.left
  };
}

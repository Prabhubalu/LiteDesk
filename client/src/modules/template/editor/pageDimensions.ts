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

const PAGE_DIMENSIONS_STYLE_ID = 'arivu-page-dimensions';

export interface PageDimensionsPx {
  width: number;
  height: number;
}

export interface PageLayoutOptions {
  dimensions: PageDimensionsPx;
  marginsMm?: Partial<PageMarginsMm>;
}

export function parseDimensionPx(value: string | number | undefined | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const parsed = parseInt(String(value || '').replace(/px$/i, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function injectPageDimensionCss(editor: Editor, height: number): void {
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
      height: 100%;
      margin: 0;
      min-height: ${height}px;
    }

    [data-gjs-type="wrapper"] {
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

  ensurePrintArea(editor);
  applyPrintAreaLayout(editor, options.dimensions, options.marginsMm);

  injectPageDimensionCss(editor, height);
}

export function setupPageLayout(editor: Editor): void {
  registerPrintAreaComponent(editor);
  registerLayoutGridComponents(editor);
  bindLayoutGridGuards(editor);
  bindPrintAreaGuards(editor);
  bindTableSelection(editor);
  bindTableSheetEditor(editor);
  bindCanvasTextInsertion(editor);
  bindTableCellResizeHandle(editor);
}

export function bindPageDimensionFrameCss(
  editor: Editor,
  getLayout: () => PageLayoutOptions
): void {
  const apply = () => {
    const layout = getLayout();
    if (layout.dimensions.width && layout.dimensions.height) {
      injectPageDimensionCss(editor, layout.dimensions.height);
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

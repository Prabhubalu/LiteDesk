import type { Editor } from 'grapesjs';
import { injectLayoutGridFrameCss } from './layoutGridCss';
import type { PageLayoutOptions } from './pageDimensions';
import { applyPrintAreaLayout, ensurePrintArea } from './printArea';
import {
  clearSupplementalCss,
  getSupplementalCss,
  injectSupplementalCanvasCss,
  setSupplementalCss
} from './supplementalCssStore';
import { hydrateTableCellsFromDom } from './tableModel';
import { refreshCanvasTablesAfterHtmlApply } from './tableSheetEditor';
import { hydrateEditableTextComponents } from './textContent';
import { hydrateCanvasImages } from './logoContent';

export interface ApplyHtmlToEditorCanvasOptions {
  isEmail?: boolean;
  pageLayout?: Pick<PageLayoutOptions, 'dimensions' | 'marginsMm'>;
}

export function applyHtmlToEditorCanvas(
  editor: Editor,
  html: string,
  css: string,
  options: ApplyHtmlToEditorCanvasOptions = {}
): void {
  const isEmail = Boolean(options.isEmail);
  const canvasHtml = String(html || '');
  const canvasCss = String(css || '').trim();

  editor.select(undefined);
  editor.setComponents(canvasHtml);

  if (canvasCss) {
    setSupplementalCss(editor, canvasCss);
    injectSupplementalCanvasCss(editor, canvasCss);
  } else {
    clearSupplementalCss(editor);
  }

  const finalize = () => {
    if (!isEmail) {
      if (options.pageLayout?.dimensions?.width && options.pageLayout?.dimensions?.height) {
        applyPrintAreaLayout(
          editor,
          options.pageLayout.dimensions,
          options.pageLayout.marginsMm
        );
      } else {
        ensurePrintArea(editor);
        injectLayoutGridFrameCss(editor);
      }
    }
    const wrapper = editor.getWrapper();
    if (wrapper) {
      hydrateEditableTextComponents(wrapper);
    }
    // Email layout tables are not spreadsheet cells — PDF sheet hydrate/repaint
    // flattens nested HTML (buttons, promo blocks) into plain text.
    if (!isEmail) {
      hydrateTableCellsFromDom(editor);
      refreshCanvasTablesAfterHtmlApply(editor);
    }
    hydrateCanvasImages(editor);
    const supplementalCss = getSupplementalCss(editor);
    if (supplementalCss) {
      injectSupplementalCanvasCss(editor, supplementalCss);
    }
    editor.refresh();
  };

  if (editor.getWrapper()) {
    finalize();
    return;
  }

  editor.once('load', () => {
    queueMicrotask(finalize);
  });
}

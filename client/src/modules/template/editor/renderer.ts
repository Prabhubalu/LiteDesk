import type { Editor } from 'grapesjs';
import {
  DEFAULT_PAGE_MARGINS_MM,
  isEmailOutputFormat,
  resolvePageDimensionsMm,
  type PageMarginsMm
} from '@/constants/contentPageSettings';
import { normalizeGrapesHtmlMergeTokens } from '@/utils/builderMergeTagHtml';
import { restoreLogoMergeSources } from './logoContent';
import { decodeMsoConditionals } from '../utils/emailHtmlExport';
import { formatHtmlDocument, stripGrapesDocumentWrapper } from '../utils/formatHtmlDocument';
import { appendLayoutGridCss } from './layoutGridCss';
import { getEditorMsoChunks } from './msoChunksStore';
import { PRINT_AREA_ATTR } from './printArea';
import { dedupeCssRules, getSupplementalCss, mergeExportedCss } from './supplementalCssStore';

export interface RenderedTemplateOutput {
  html: string;
  css: string;
}

export interface ExtractRenderedOutputOptions {
  /** PDF templates append layout-grid CSS; email templates must not. */
  appendLayoutGrid?: boolean;
}

export interface TemplateHtmlPageSettings {
  paperSize?: string;
  orientation?: string;
  customPageWidth?: number;
  customPageHeight?: number;
  margins?: PageMarginsMm;
}

export interface BuildTemplateHtmlDocumentOptions {
  outputFormat?: string;
  pageSettings?: TemplateHtmlPageSettings;
}

const GRAPES_RENDER_RESET_CSS = `
  .builder-merge-chip,
  [data-merge-field="true"] {
    display: inline !important;
    padding: 0 !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    color: inherit !important;
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
    font-weight: inherit !important;
  }

  [data-text-block="true"],
  [data-paragraph="true"],
  [data-heading="true"],
  [data-address-block="true"],
  [data-organization-block="true"] {
    display: block;
    white-space: pre-wrap;
  }
`;

export function extractRenderedOutput(
  editor: Editor,
  options: ExtractRenderedOutputOptions = {}
): RenderedTemplateOutput {
  const appendLayoutGrid = options.appendLayoutGrid !== false;
  let html = editor.getHtml() || '';
  html = stripGrapesDocumentWrapper(html);
  const msoChunks = getEditorMsoChunks(editor);
  if (Array.isArray(msoChunks) && msoChunks.length) {
    html = decodeMsoConditionals(html, msoChunks);
  }
  const css = editor.getCss() || '';
  const mergedCss = mergeExportedCss(css, getSupplementalCss(editor));
  const exportedCss = appendLayoutGrid ? appendLayoutGridCss(mergedCss) : mergedCss;
  return {
    html,
    css: dedupeCssRules(exportedCss)
  };
}

function resolvePageSizeCss(pageSettings?: TemplateHtmlPageSettings): string {
  const paperSize = String(pageSettings?.paperSize || 'A4');
  const orientation = pageSettings?.orientation === 'landscape' ? 'landscape' : 'portrait';

  if (paperSize === 'Custom') {
    const dimensions = resolvePageDimensionsMm('Custom', orientation, {
      customPageWidth: pageSettings?.customPageWidth,
      customPageHeight: pageSettings?.customPageHeight
    });
    return `${dimensions.width}mm ${dimensions.height}mm`;
  }

  return `${paperSize} ${orientation}`;
}

function wrapHtmlDocument(bodyHtml: string, css: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
${css}
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/** Read live canvas body HTML without mutating Grapes component models. */
export function exportBodyHtmlFromCanvasFrame(editor: Editor): string {
  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (!doc) {
    const fallback = stripGrapesDocumentWrapper(editor.getHtml() || '');
    return restoreLogoMergeSources(normalizeGrapesHtmlMergeTokens(fallback));
  }

  const printArea = doc.querySelector(`[${PRINT_AREA_ATTR}="true"]`);
  if (printArea instanceof HTMLElement) {
    return restoreLogoMergeSources(normalizeGrapesHtmlMergeTokens(printArea.outerHTML));
  }

  const wrapper = doc.querySelector('[data-gjs-type="wrapper"]');
  if (wrapper instanceof HTMLElement) {
    const parts = [...wrapper.children].map((child) => child.outerHTML);
    return restoreLogoMergeSources(normalizeGrapesHtmlMergeTokens(parts.join('')));
  }

  const fallback = stripGrapesDocumentWrapper(editor.getHtml() || '');
  return restoreLogoMergeSources(normalizeGrapesHtmlMergeTokens(fallback));
}

/** Full HTML document for the current canvas — merge chips normalized to {{tokens}}. */
export function buildTemplateHtmlDocument(
  editor: Editor,
  options: BuildTemplateHtmlDocumentOptions = {}
): string {
  const isEmail = isEmailOutputFormat(options.outputFormat);
  const { css: componentCss } = extractRenderedOutput(editor, {
    appendLayoutGrid: !isEmail
  });
  const bodyHtml = exportBodyHtmlFromCanvasFrame(editor);
  const css = String(componentCss || '').trim();

  if (isEmail) {
    const emailCss = `${GRAPES_RENDER_RESET_CSS}\n${css}`.trim();
    return formatHtmlDocument(wrapHtmlDocument(bodyHtml, emailCss));
  }

  const margins = { ...DEFAULT_PAGE_MARGINS_MM, ...options.pageSettings?.margins };
  const pageSizeCss = resolvePageSizeCss(options.pageSettings);
  const pageCss = `
    @page {
      size: ${pageSizeCss};
      margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.45;
    }
    ${GRAPES_RENDER_RESET_CSS}
    ${css}
  `.trim();

  return formatHtmlDocument(wrapHtmlDocument(bodyHtml, pageCss));
}

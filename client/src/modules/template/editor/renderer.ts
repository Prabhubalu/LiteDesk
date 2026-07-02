import type { Editor } from 'grapesjs';
import { appendLayoutGridCss } from './layoutGridCss';
import { decodeMsoConditionals } from '../utils/emailHtmlExport';
import { getEditorMsoChunks } from './msoChunksStore';

export interface RenderedTemplateOutput {
  html: string;
  css: string;
}

export interface ExtractRenderedOutputOptions {
  /** PDF templates append layout-grid CSS; email templates must not. */
  appendLayoutGrid?: boolean;
}

export function extractRenderedOutput(
  editor: Editor,
  options: ExtractRenderedOutputOptions = {}
): RenderedTemplateOutput {
  const appendLayoutGrid = options.appendLayoutGrid !== false;
  let html = editor.getHtml() || '';
  const msoChunks = getEditorMsoChunks(editor);
  if (Array.isArray(msoChunks) && msoChunks.length) {
    html = decodeMsoConditionals(html, msoChunks);
  }
  const css = editor.getCss() || '';
  return {
    html,
    css: appendLayoutGrid ? appendLayoutGridCss(css) : css
  };
}

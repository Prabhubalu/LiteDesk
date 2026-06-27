import type { Editor } from 'grapesjs';
import { appendLayoutGridCss } from './layoutGridCss';

export interface RenderedTemplateOutput {
  html: string;
  css: string;
}

export function extractRenderedOutput(editor: Editor): RenderedTemplateOutput {
  return {
    html: editor.getHtml() || '',
    css: appendLayoutGridCss(editor.getCss() || '')
  };
}

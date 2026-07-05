import type { Editor } from 'grapesjs';
import { extractRenderedOutput, buildTemplateHtmlDocument, exportBodyHtmlFromCanvasFrame } from '../editor/renderer';
import { stripGrapesDocumentWrapper } from './formatHtmlDocument';

export interface ParsedEmailHtml {
  html: string;
  css: string;
}

export function buildEmailHtmlDocument(editor: Editor): string {
  return buildTemplateHtmlDocument(editor, { outputFormat: 'email' });
}

export function getEmailHtmlParts(editor: Editor): ParsedEmailHtml {
  const { css } = extractRenderedOutput(editor, { appendLayoutGrid: false });
  return {
    html: exportBodyHtmlFromCanvasFrame(editor),
    css
  };
}

/**
 * Parse a full HTML document or fragment into body HTML + CSS for GrapesJS.
 */
const PRINT_AREA_CSS_SCOPE = '[data-print-area="true"]';

/** Strip export-only rules and scope document selectors onto the print area. */
export function filterImportedDocumentCss(css: string): string {
  let source = String(css || '').trim();
  if (!source) return '';

  source = source.replace(/@page\s*\{[\s\S]*?\}/gi, '');
  source = source.replace(
    /\.builder-merge-chip\s*,\s*\[data-merge-field="true"\]\s*\{[\s\S]*?\}/gi,
    ''
  );
  source = source.replace(/\/\*\s*arivu-layout-grid\s*\*\/[\s\S]*$/i, '');
  source = scopeDocumentSelectorsToPrintArea(source);

  return source.replace(/\n{3,}/g, '\n\n').trim();
}

function scopeDocumentSelectorsToPrintArea(css: string): string {
  return String(css || '')
    .replace(/\bhtml\s*,\s*body\b/gi, PRINT_AREA_CSS_SCOPE)
    .replace(/(^|[,{}\s])body(\s*\{)/gi, `$1${PRINT_AREA_CSS_SCOPE}$2`);
}

export interface ParseTemplateHtmlDocumentOptions {
  isEmail?: boolean;
}

/** Parse a pasted or edited full HTML document into canvas body HTML + CSS. */
export function parseTemplateHtmlDocumentForCanvas(
  raw: string,
  options: ParseTemplateHtmlDocumentOptions = {}
): ParsedEmailHtml {
  const { html, css } = parseEmailHtmlInput(raw);
  const bodyHtml = stripGrapesDocumentWrapper(extractEmailBodyHtml(html));
  const isEmail = Boolean(options.isEmail);

  return {
    html: bodyHtml,
    css: isEmail ? css : filterImportedDocumentCss(css)
  };
}

export function parseEmailHtmlInput(raw: string): ParsedEmailHtml {
  const source = String(raw || '').trim();
  if (!source) {
    return { html: '', css: '' };
  }

  try {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return { html: extractEmailBodyHtml(source), css: '' };
    }

    const cssBlocks = [...doc.querySelectorAll('style')]
      .map((node) => node.textContent || '')
      .filter(Boolean);
    const linkedCss = [...doc.querySelectorAll('link[rel="stylesheet"]')]
      .map((node) => `/* ignored external: ${node.getAttribute('href') || ''} */`)
      .filter(Boolean);

    const bodyHtml = doc.body?.innerHTML?.trim() || extractEmailBodyHtml(source);

    return {
      html: bodyHtml,
      css: [...cssBlocks, ...linkedCss].join('\n\n').trim()
    };
  } catch {
    return { html: extractEmailBodyHtml(source), css: '' };
  }
}

/**
 * Extract canvas-safe body HTML from a full email document or fragment.
 */
export function extractEmailBodyHtml(html: string): string {
  let source = String(html || '').trim();
  if (!source) return '';

  const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    return bodyMatch[1].trim();
  }

  source = source.replace(/^<!DOCTYPE[^>]*>/i, '');
  source = source.replace(/<\/?html[^>]*>/gi, '');
  source = source.replace(/<head[\s\S]*?<\/head>/gi, '');
  source = source.replace(/<\/?body[^>]*>/gi, '');

  return source.trim();
}

export function isFullHtmlDocument(html: string): boolean {
  const source = String(html || '').trim();
  return /^<!DOCTYPE/i.test(source)
    || /<html[\s>]/i.test(source)
    || /<head[\s>]/i.test(source)
    || /<body[\s>]/i.test(source);
}

const MSO_CONDITIONAL_REGEX = /<!--\[if[\s\S]*?<!\[endif\]-->/gi;
export const MSO_PLACEHOLDER_ATTR = 'data-arivu-mso-conditional';

export interface MsoEncodeResult {
  html: string;
  chunks: string[];
}

/** Replace Outlook conditional comments with hidden placeholders Grapes can preserve. */
export function encodeMsoConditionals(html: string): MsoEncodeResult {
  const chunks: string[] = [];
  const encoded = String(html || '').replace(MSO_CONDITIONAL_REGEX, (match) => {
    const index = chunks.length;
    chunks.push(match);
    return `<div ${MSO_PLACEHOLDER_ATTR}="${index}" style="display:none!important;mso-hide:all;font-size:0;line-height:0;max-height:0;overflow:hidden;width:0;height:0" aria-hidden="true"></div>`;
  });
  return { html: encoded, chunks };
}

export function decodeMsoConditionals(html: string, chunks: string[]): string {
  if (!chunks.length) return html;
  const pattern = new RegExp(
    `<div[^>]*${MSO_PLACEHOLDER_ATTR}\\s*=\\s*["'](\\d+)["'][^>]*>\\s*</div>`,
    'gi'
  );
  return String(html || '').replace(pattern, (_match, index) => chunks[Number(index)] || '');
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function slugifyFilename(value: string): string {
  return String(value || 'email-template')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'email-template';
}

import type { Editor } from 'grapesjs';
import { extractRenderedOutput } from '../editor/renderer';

export interface ParsedEmailHtml {
  html: string;
  css: string;
}

export function buildEmailHtmlDocument(editor: Editor): string {
  const { html, css } = getEmailHtmlParts(editor);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
</head>
<body>${html}</body>
</html>`;
}

export function getEmailHtmlParts(editor: Editor): ParsedEmailHtml {
  return extractRenderedOutput(editor, { appendLayoutGrid: false });
}

/**
 * Parse a full HTML document or fragment into body HTML + CSS for GrapesJS.
 */
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

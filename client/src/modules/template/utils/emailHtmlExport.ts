import type { Editor } from 'grapesjs';
import { extractRenderedOutput, buildTemplateHtmlDocument, exportBodyHtmlFromCanvasFrame } from '../editor/renderer';
import { stripGrapesDocumentWrapper } from './formatHtmlDocument';
import { normalizeImportedEmailHtml } from './normalizeImportedEmailHtml';

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
  source = source.replace(/@media\s+print\s*\{[\s\S]*?\}\s*/gi, '');
  source = source.replace(
    /\.builder-merge-chip\s*,\s*\[data-merge-field="true"\]\s*\{[\s\S]*?\}/gi,
    ''
  );
  source = source.replace(/\/\*\s*arivu-layout-grid\s*\*\/[\s\S]*$/i, '');
  source = scopeDocumentSelectorsToPrintArea(source);
  source = stripPrintAreaBrowserChrome(source);
  source = normalizeA4PageBoxCss(source);
  // Fixed px widths from email/print HTML break A4 print-area fit in Design.
  source = clampOversizedCssWidths(source);

  return source.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Pasted "browser preview" sheets often set width:210mm / height:297mm on an
 * inner .a4-page. That is full A4 — wider than the Design print area (A4 minus
 * margins) — so rewrite to fill the print area instead.
 */
export function normalizeA4PageBoxCss(css: string): string {
  let source = String(css || '');

  // Common A4 absolute sizes → fluid fill of the builder print area.
  source = source.replace(
    /(^|;|{)\s*width\s*:\s*210mm\s*(?=;|})/gi,
    '$1width: 100%'
  );
  source = source.replace(
    /(^|;|{)\s*min-width\s*:\s*210mm\s*(?=;|})/gi,
    '$1min-width: 0'
  );
  source = source.replace(
    /(^|;|{)\s*height\s*:\s*297mm\s*(?=;|})/gi,
    '$1height: auto'
  );
  source = source.replace(
    /(^|;|{)\s*min-height\s*:\s*297mm\s*(?=;|})/gi,
    '$1min-height: 100%'
  );
  // Letter size (US) variants.
  source = source.replace(
    /(^|;|{)\s*width\s*:\s*8\.5in\s*(?=;|})/gi,
    '$1width: 100%'
  );
  source = source.replace(
    /(^|;|{)\s*height\s*:\s*11in\s*(?=;|})/gi,
    '$1height: auto'
  );

  source = source.replace(
    /(^|;|{)\s*box-shadow\s*:\s*[^;{}]+(?=;|})/gi,
    '$1box-shadow: none'
  );

  return source;
}

/**
 * Body styles meant for a browser canvas (gray background, flex centering,
 * outer padding) must not apply to the Design print area.
 */
function stripPrintAreaBrowserChrome(css: string): string {
  const scope = PRINT_AREA_CSS_SCOPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bodyRule = new RegExp(
    `(${scope})\\s*\\{([^{}]*)\\}`,
    'gi'
  );

  return String(css || '').replace(bodyRule, (_full, selector, body) => {
    let next = String(body || '');
    next = next.replace(/(^|;)\s*background(?:-color)?\s*:\s*[^;]+/gi, '$1');
    next = next.replace(/(^|;)\s*padding\s*:\s*[^;]+/gi, '$1');
    next = next.replace(/(^|;)\s*margin\s*:\s*[^;]+/gi, '$1');
    next = next.replace(/(^|;)\s*display\s*:\s*flex\s*/gi, '$1');
    next = next.replace(/(^|;)\s*justify-content\s*:\s*[^;]+/gi, '$1');
    next = next.replace(/(^|;)\s*align-items\s*:\s*[^;]+/gi, '$1');
    next = next.replace(/;;+/g, ';').replace(/^\s*;\s*/, '').trim();
    return `${selector} { ${next} }`;
  });
}

/** Replace large fixed widths with 100% so content stays inside the print area. */
function clampOversizedCssWidths(css: string): string {
  return String(css || '').replace(
    /(^|;|{)\s*(min-width|max-width|width)\s*:\s*(\d+(?:\.\d+)?)px\s*(?=;|})/gi,
    (full, prefix, prop, value) => {
      const px = Number(value);
      // A4 content area is typically ~650–720px with margins; clamp anything larger.
      if (Number.isFinite(px) && px > 640) {
        const nextProp = String(prop).toLowerCase() === 'min-width' ? 'max-width' : prop;
        return `${prefix}${nextProp}: 100%`;
      }
      return full;
    }
  );
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
  const isEmail = Boolean(options.isEmail);
  const { html, css } = parseEmailHtmlInput(raw);
  // parseEmailHtmlInput already returns body inner HTML — do not run extractEmailBodyHtml
  // again (that defaults to email centering wraps).
  let bodyHtml = stripGrapesDocumentWrapper(String(html || '').trim());
  // Malformed pastes can leave orphan <body> tags after DOM unwrap.
  bodyHtml = bodyHtml.replace(/<\/?body[^>]*>/gi, '').trim();

  if (isEmail) {
    bodyHtml = normalizeImportedEmailHtml(bodyHtml);
  } else {
    bodyHtml = normalizePrintBodyHtml(bodyHtml);
  }

  return {
    html: bodyHtml,
    css: isEmail ? css : filterImportedDocumentCss(css)
  };
}

/**
 * Keep a single page wrapper (e.g. .a4-page) for flex layouts, but strip inline
 * A4 mm sizes that overflow the Design print area.
 */
export function normalizePrintBodyHtml(html: string): string {
  const source = String(html || '').trim();
  if (!source) return '';

  try {
    const doc = new DOMParser().parseFromString(
      `<div id="arivu-print-root">${source}</div>`,
      'text/html'
    );
    const root = doc.getElementById('arivu-print-root');
    if (!root) return source;

    // Nested <body> from malformed paste — unwrap into the print root.
    root.querySelectorAll('body').forEach((bodyEl) => {
      const parent = bodyEl.parentNode;
      if (!parent) return;
      while (bodyEl.firstChild) {
        parent.insertBefore(bodyEl.firstChild, bodyEl);
      }
      parent.removeChild(bodyEl);
    });

    root.querySelectorAll('[style]').forEach((el) => {
      const style = el.getAttribute('style') || '';
      const next = normalizeA4PageBoxCss(`x{${style}}`)
        .replace(/^x\{/, '')
        .replace(/\}$/, '');
      if (next.trim()) el.setAttribute('style', next);
      else el.removeAttribute('style');
    });

    return root.innerHTML.trim() || source;
  } catch {
    return source;
  }
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
      // Raw extract only — caller decides email vs print normalization.
      return { html: extractEmailBodyHtml(source, { normalizeEmail: false }), css: '' };
    }

    const cssBlocks = [...doc.querySelectorAll('style')]
      .map((node) => node.textContent || '')
      .filter(Boolean);
    const linkedCss = [...doc.querySelectorAll('link[rel="stylesheet"]')]
      .map((node) => `/* ignored external: ${node.getAttribute('href') || ''} */`)
      .filter(Boolean);

    const bodyHtml = doc.body?.innerHTML?.trim()
      || extractEmailBodyHtml(source, { normalizeEmail: false });

    return {
      html: bodyHtml,
      css: [...cssBlocks, ...linkedCss].join('\n\n').trim()
    };
  } catch {
    return { html: extractEmailBodyHtml(source, { normalizeEmail: false }), css: '' };
  }
}

/**
 * Extract canvas-safe body HTML from a full email document or fragment.
 * @param options.normalizeEmail When false, skip email-only table centering wraps (PDF/print).
 */
export function extractEmailBodyHtml(
  html: string,
  options: { normalizeEmail?: boolean } = {}
): string {
  const normalizeEmail = options.normalizeEmail !== false;
  let source = String(html || '').trim();
  if (!source) return '';

  const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    const inner = bodyMatch[1];
    return normalizeEmail ? normalizeImportedEmailHtml(inner) : String(inner || '').trim();
  }

  source = source.replace(/^<!DOCTYPE[^>]*>/i, '');
  source = source.replace(/<\/?html[^>]*>/gi, '');
  source = source.replace(/<head[\s\S]*?<\/head>/gi, '');
  source = source.replace(/<\/?body[^>]*>/gi, '');

  return normalizeEmail ? normalizeImportedEmailHtml(source) : source.trim();
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

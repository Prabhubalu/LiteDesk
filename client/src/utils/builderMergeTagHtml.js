import { normalizeMergeTagPath } from '@/modules/template/editor/mergeTokens';

export const BUILDER_MERGE_CHIP_CLASS = 'builder-merge-chip';
export const MERGE_CHIP_CARET_ANCHOR = '\u200B';

const MERGE_TOKEN_PATTERN = /\{\{([^}]+)\}\}/g;

const BLOCK_LINE_TAGS = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE']);

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function isMergeChipElement(element) {
  return (
    element.classList?.contains(BUILDER_MERGE_CHIP_CLASS)
    || element.getAttribute('data-merge-field') === 'true'
    || element.hasAttribute('data-merge-path')
  );
}

function mergePathFromElement(element) {
  const attrPath = element.getAttribute('data-merge-path');
  if (attrPath) return attrPath.trim();

  const text = String(element.textContent || '').trim();
  const match = text.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  return match?.[1]?.trim() || text.replace(/[{}]/g, '').trim();
}

function mergeChipMarkup(path) {
  const trimmed = normalizeMergeTagPath(String(path || '').trim());
  return `<span class="${BUILDER_MERGE_CHIP_CLASS}" contenteditable="false" data-merge-path="${escapeAttr(trimmed)}" unselectable="on">${escapeAttr(trimmed)}</span>${MERGE_CHIP_CARET_ANCHOR}`;
}

function normalizeTokenText(text) {
  return String(text ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/[ \t]*\n[ \t]*/g, '\n');
}

function contentHasHtmlMarkup(text) {
  return /<(?:span|font|strong|em|b|i|u|p|div|h[1-6]|br)\b[^>]*>/i.test(String(text ?? ''));
}

export { contentHasHtmlMarkup };

function hostHasRichMarkup(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.querySelector('[style]')) return true;
  return contentHasHtmlMarkup(element.innerHTML);
}

export { hostHasRichMarkup, hostHasLineBreakMarkup };

function stripCaretAnchors(text) {
  return String(text ?? '').replace(/\u200B/g, '');
}

export function createMergeChipElement(path, doc = document) {
  const trimmed = normalizeMergeTagPath(String(path || '').trim());
  const span = doc.createElement('span');
  span.className = BUILDER_MERGE_CHIP_CLASS;
  span.contentEditable = 'false';
  span.setAttribute('data-merge-path', trimmed);
  span.setAttribute('unselectable', 'on');
  span.textContent = trimmed;
  return span;
}

function decorateTextNodeWithMergeChips(textNode) {
  const text = String(textNode.textContent ?? '');
  if (!text.includes('{{')) return false;

  const regex = new RegExp(MERGE_TOKEN_PATTERN.source, 'g');
  const parts = [];
  let lastIndex = 0;
  let match = regex.exec(text);
  while (match) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'chip', value: String(match[1] || '').trim() });
    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }
  if (!parts.some((part) => part.type === 'chip')) return false;

  const parent = textNode.parentNode;
  if (!parent) return false;

  const doc = textNode.ownerDocument;
  const fragment = doc.createDocumentFragment();
  for (const part of parts) {
    if (part.type === 'text') {
      if (part.value) fragment.appendChild(doc.createTextNode(part.value));
      continue;
    }
    fragment.appendChild(createMergeChipElement(part.value, doc));
    fragment.appendChild(doc.createTextNode(MERGE_CHIP_CARET_ANCHOR));
  }

  parent.insertBefore(fragment, textNode);
  textNode.remove();
  return true;
}

/**
 * Convert {{token}} text inside existing styled markup to chips without flattening HTML.
 * @param {HTMLElement} element
 */
export function applyMergeChipsInPlace(element) {
  if (!(element instanceof HTMLElement)) return;

  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.includes('{{')) textNodes.push(node);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    decorateTextNodeWithMergeChips(textNode);
  }
}

/**
 * Serialize live DOM to stored HTML, preserving inline styles and converting chips to tokens.
 * @param {HTMLElement} element
 */
export function serializeElementHtmlWithMergeTokens(element) {
  if (!(element instanceof HTMLElement)) return '';

  const clone = element.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return element.innerHTML;

  clone.querySelectorAll(`.${BUILDER_MERGE_CHIP_CLASS}, [data-merge-path]`).forEach((chip) => {
    const path = mergePathFromElement(chip);
    chip.replaceWith(document.createTextNode(formatMergeToken(path)));
  });

  const walker = clone.ownerDocument.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();
  while (textNode) {
    if (textNode.textContent?.includes('\u200B')) {
      textNode.textContent = stripCaretAnchors(textNode.textContent);
    }
    textNode = walker.nextNode();
  }

  return clone.innerHTML;
}

function serializeNodeToMergeTokens(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return String(node.textContent ?? '').replace(/\u200B/g, '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node;
  if (isMergeChipElement(element)) {
    return `{{${mergePathFromElement(element)}}}`;
  }

  if (element.tagName === 'BR') {
    return '\n';
  }

  let out = '';
  for (const child of element.childNodes) {
    out += serializeNodeToMergeTokens(child);
  }

  if (BLOCK_LINE_TAGS.has(element.tagName)) {
    return out.endsWith('\n') ? out : `${out}\n`;
  }

  return out;
}

function hostHasLineBreakMarkup(element) {
  if (!(element instanceof HTMLElement)) return false;
  return Boolean(element.querySelector('br, div, p'));
}

/**
 * Read merge-token text from a live DOM host (preserves spaces — no innerHTML round-trip).
 * @param {ParentNode} root
 */
export function nodesToMergeTokens(root) {
  if (!root) return '';

  let out = '';
  for (const child of root.childNodes) {
    out += serializeNodeToMergeTokens(child);
  }
  return normalizeTokenText(out);
}

/**
 * @param {HTMLElement} element
 */
export function elementToMergeTokens(element) {
  return nodesToMergeTokens(element);
}

/** Encode trailing spaces so they survive innerHTML parse/serialize cycles. */
function preserveSpacesForHtml(text) {
  return String(text ?? '').replace(/[ \t]+$/g, (spaces) => '\u00A0'.repeat(spaces.length));
}

/**
 * Render merge-token text as non-editable chips inside a host element.
 * @param {HTMLElement} element
 * @param {string} tokenText
 */
export function applyMergeChipsToElement(element, tokenText) {
  const raw = String(tokenText ?? '');

  if (hostHasRichMarkup(element) || hostHasLineBreakMarkup(element)) {
    applyMergeChipsInPlace(element);
    return;
  }

  if (contentHasHtmlMarkup(raw)) {
    element.innerHTML = stripCaretAnchors(raw);
    applyMergeChipsInPlace(element);
    return;
  }

  element.innerHTML = mergeTokensToChipHtml(raw);
}

/**
 * @param {string} html
 */
export function mergeTokensToChipHtml(html) {
  const raw = String(html ?? '');
  const withBreaks = raw.includes('\n') ? raw.replace(/\n/g, '<br>') : raw;
  if (!withBreaks.includes('{{')) {
    return preserveSpacesForHtml(withBreaks);
  }

  const parts = [];
  let lastIndex = 0;
  const regex = new RegExp(MERGE_TOKEN_PATTERN.source, 'g');
  let match = regex.exec(withBreaks);
  while (match) {
    parts.push(preserveSpacesForHtml(withBreaks.slice(lastIndex, match.index)));
    parts.push(mergeChipMarkup(String(match[1] || '').trim()));
    lastIndex = regex.lastIndex;
    match = regex.exec(withBreaks);
  }
  parts.push(preserveSpacesForHtml(withBreaks.slice(lastIndex)));
  return parts.join('');
}

/**
 * Normalize editable cell HTML to stored merge-token text (preserves line breaks).
 * @param {string} html
 */
export function normalizeCellMergeTokenHtml(html) {
  return normalizeTokenText(
    String(html ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
  );
}

/**
 * @param {string} html
 */
export function chipHtmlToMergeTokens(html) {
  if (typeof document === 'undefined') {
    return normalizeCellMergeTokenHtml(html);
  }

  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');
  return nodesToMergeTokens(template.content);
}

const MERGE_CHIP_WITH_CLASS =
  /<span[^>]*class="[^"]*builder-merge-chip[^"]*"[^>]*data-merge-path="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi;

const MERGE_CHIP_WITH_CLASS_ALT =
  /<span[^>]*data-merge-path="([^"]+)"[^>]*class="[^"]*builder-merge-chip[^"]*"[^>]*>[\s\S]*?<\/span>/gi;

const MERGE_FIELD_SPAN =
  /<span[^>]*data-merge-field=["']true["'][^>]*>([\s\S]*?)<\/span>/gi;

const MERGE_FIELD_SPAN_ALT =
  /<span[^>]*data-gjs-type=["']text["'][^>]*data-merge-field=["']true["'][^>]*>([\s\S]*?)<\/span>/gi;

function formatMergeToken(path) {
  const trimmed = normalizeMergeTagPath(String(path || '').trim());
  if (!trimmed) return '';
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) return trimmed;
  return `{{${trimmed}}}`;
}

function tokenFromSpanContent(content) {
  const raw = String(content || '').trim();
  if (!raw) return '';
  if (raw.startsWith('{{') && raw.endsWith('}}')) return raw;
  return formatMergeToken(raw);
}

/** Convert builder merge chips in Grapes HTML into plain {{token}} text. */
export function normalizeGrapesHtmlMergeTokens(html) {
  let result = String(html || '');

  result = result.replace(MERGE_CHIP_WITH_CLASS, (_, path) => formatMergeToken(path));
  result = result.replace(MERGE_CHIP_WITH_CLASS_ALT, (_, path) => formatMergeToken(path));
  result = result.replace(MERGE_FIELD_SPAN, (_, content) => tokenFromSpanContent(content));
  result = result.replace(MERGE_FIELD_SPAN_ALT, (_, content) => tokenFromSpanContent(content));

  return result;
}

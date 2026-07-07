'use strict';

const { createEmptyBlockDocument } = require('./contentBlockValidationService');

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripDangerousHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function textNode(text) {
  const safe = decodeHtmlEntities(text).replace(/\s+/g, ' ').trim();
  if (!safe) return null;
  return { type: 'text', text: safe };
}

function paragraphFromHtml(innerHtml) {
  const text = decodeHtmlEntities(String(innerHtml || '').replace(/<br\s*\/?>/gi, '\n'))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function listFromHtml(tag, innerHtml) {
  const itemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const items = [];
  let match = itemPattern.exec(innerHtml);
  while (match) {
    const paragraph = paragraphFromHtml(match[1]);
    if (paragraph) {
      items.push({ type: 'listItem', content: [paragraph] });
    }
    match = itemPattern.exec(innerHtml);
  }
  if (!items.length) return null;
  return {
    type: tag === 'ol' ? 'orderedList' : 'bulletList',
    content: items,
  };
}

function imageFromHtml(tagHtml) {
  const srcMatch = tagHtml.match(/\ssrc=["']([^"']+)["']/i);
  const altMatch = tagHtml.match(/\salt=["']([^"']*)["']/i);
  const src = srcMatch?.[1] || '';
  if (!src) return null;
  return {
    type: 'image',
    attrs: {
      src,
      alt: altMatch?.[1] || '',
      title: null,
    },
  };
}

function blockFromMatch(tag, innerHtml, fullTag) {
  const normalized = String(tag || '').toLowerCase();
  if (/^h[1-4]$/.test(normalized)) {
    const level = Number(normalized.slice(1));
    const text = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, '')).trim();
    if (!text) return null;
    return {
      type: 'heading',
      attrs: { level },
      content: [{ type: 'text', text }],
    };
  }
  if (normalized === 'p') return paragraphFromHtml(innerHtml);
  if (normalized === 'blockquote') {
    const paragraph = paragraphFromHtml(innerHtml);
    return paragraph ? { type: 'blockquote', content: [paragraph] } : null;
  }
  if (normalized === 'ul' || normalized === 'ol') return listFromHtml(normalized, innerHtml);
  if (normalized === 'hr') return { type: 'horizontalRule' };
  if (normalized === 'img') return imageFromHtml(fullTag);
  if (normalized === 'pre' || normalized === 'code') {
    const code = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, '')).trim();
    if (!code) return null;
    return { type: 'codeBlock', content: [{ type: 'text', text: code }] };
  }
  const paragraph = paragraphFromHtml(innerHtml);
  return paragraph;
}

function htmlToBlocks(html) {
  const cleaned = stripDangerousHtml(html).trim();
  if (!cleaned) return createEmptyBlockDocument();

  const blocks = [];
  const pattern = /<(h[1-4]|p|ul|ol|blockquote|hr|img|pre|code|div)(?:\s[^>]*)?>([\s\S]*?)<\/\1>|<(hr|img)(?:\s[^>]*)?\/?>/gi;
  let match = pattern.exec(cleaned);
  let matchedAny = false;

  while (match) {
    matchedAny = true;
    const tag = match[1] || match[3];
    const innerHtml = match[2] || '';
    const fullTag = match[0];
    const block = blockFromMatch(tag, innerHtml, fullTag);
    if (block) blocks.push(block);
    match = pattern.exec(cleaned);
  }

  if (!matchedAny) {
    const paragraph = paragraphFromHtml(cleaned);
    if (paragraph) blocks.push(paragraph);
  }

  if (!blocks.length) return createEmptyBlockDocument();
  return { type: 'doc', content: blocks };
}

module.exports = {
  htmlToBlocks,
  stripDangerousHtml,
  decodeHtmlEntities,
};

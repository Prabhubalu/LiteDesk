'use strict';

/**
 * Extract inner HTML suitable for GrapesJS canvas (body content only).
 * Full documents break Grapes parsing and collapse to plain text.
 *
 * @param {string} html
 * @returns {string}
 */
function extractEmailBodyHtml(html) {
  let source = String(html || '').trim();
  if (!source) return '';

  const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1].trim();
  }

  source = source.replace(/^<!DOCTYPE[^>]*>/i, '');
  source = source.replace(/<\/?html[^>]*>/gi, '');
  source = source.replace(/<head[\s\S]*?<\/head>/gi, '');
  source = source.replace(/<\/?body[^>]*>/gi, '');

  return source.trim();
}

/**
 * @param {string} html
 * @returns {boolean}
 */
function isFullHtmlDocument(html) {
  const source = String(html || '').trim();
  return /^<!DOCTYPE/i.test(source)
    || /<html[\s>]/i.test(source)
    || /<head[\s>]/i.test(source)
    || /<body[\s>]/i.test(source);
}

module.exports = {
  extractEmailBodyHtml,
  isFullHtmlDocument
};

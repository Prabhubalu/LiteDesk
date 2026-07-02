'use strict';

const MAX_HTML_BYTES = 2 * 1024 * 1024;

/** @typedef {{ type: string, detail: string, line?: number }} SanitizerRemoval */

/**
 * @param {string} html
 * @returns {number|undefined}
 */
function lineNumberAt(html, index) {
  if (index <= 0) return 1;
  return html.slice(0, index).split('\n').length;
}

/**
 * @param {string} html
 * @param {RegExp} regex
 * @param {string} type
 * @param {SanitizerRemoval[]} removals
 * @returns {string}
 */
function stripMatches(html, regex, type, removals) {
  return html.replace(regex, (match, _g1, offset) => {
    removals.push({
      type,
      detail: match.length > 120 ? `${match.slice(0, 117)}...` : match,
      line: lineNumberAt(html, offset)
    });
    return '';
  });
}

/**
 * @param {string} html
 * @returns {{ html: string, css: string, removals: SanitizerRemoval[], warnings: SanitizerRemoval[] }}
 */
function sanitizeEmailHtml(html) {
  const input = String(html || '');
  if (Buffer.byteLength(input, 'utf8') > MAX_HTML_BYTES) {
    const error = new Error('HTML exceeds 2 MB limit');
    error.code = 'HTML_TOO_LARGE';
    error.statusCode = 400;
    throw error;
  }

  const removals = [];
  const warnings = [];
  let output = input;

  output = stripMatches(
    output,
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    'javascript',
    removals
  );
  output = stripMatches(output, /<script\b[^>]*\/?>/gi, 'javascript', removals);
  output = stripMatches(output, /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, 'iframe', removals);
  output = stripMatches(output, /<iframe\b[^>]*\/?>/gi, 'iframe', removals);
  output = stripMatches(output, /<object\b[^>]*>[\s\S]*?<\/object>/gi, 'embed', removals);
  output = stripMatches(output, /<embed\b[^>]*\/?>/gi, 'embed', removals);
  output = stripMatches(output, /<form\b[^>]*>[\s\S]*?<\/form>/gi, 'form', warnings);
  output = stripMatches(
    output,
    /<link\b[^>]*rel=["']stylesheet["'][^>]*\/?>/gi,
    'external-css',
    warnings
  );
  output = stripMatches(
    output,
    /<meta\b[^>]*http-equiv=["']refresh["'][^>]*\/?>/gi,
    'meta-refresh',
    removals
  );

  output = output.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (match, _v, offset) => {
    removals.push({
      type: 'event-handler',
      detail: match.trim(),
      line: lineNumberAt(input, offset)
    });
    return '';
  });

  output = output.replace(
    /(\s(?:href|src|action)\s*=\s*["'])javascript:[^"']*(["'])/gi,
    (match, prefix, suffix, offset) => {
      removals.push({
        type: 'javascript-url',
        detail: match.trim(),
        line: lineNumberAt(input, offset)
      });
      return `${prefix}#${suffix}`;
    }
  );

  const styleBlocks = [];
  output = output.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, cssBlock) => {
    styleBlocks.push(String(cssBlock || '').trim());
    return '';
  });

  return {
    html: output.trim(),
    css: styleBlocks.filter(Boolean).join('\n\n'),
    removals,
    warnings
  };
}

/**
 * @param {string} html
 * @returns {string}
 */
function extractDocumentTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || '';
}

module.exports = {
  MAX_HTML_BYTES,
  sanitizeEmailHtml,
  extractDocumentTitle
};

'use strict';

/**
 * Minimal markdown → HTML for release note descriptions (v1).
 * Client still runs DOMPurify before render.
 * @param {string} markdown
 * @returns {string}
 */
function markdownToHtml(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';

  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const withLinks = withBold.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  const paragraphs = withLinks
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`);

  return paragraphs.join('');
}

module.exports = {
  markdownToHtml
};

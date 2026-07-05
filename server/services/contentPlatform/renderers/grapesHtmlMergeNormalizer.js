'use strict';

const MERGE_CHIP_WITH_CLASS =
  /<span[^>]*class="[^"]*builder-merge-chip[^"]*"[^>]*data-merge-path="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi;

const MERGE_CHIP_WITH_CLASS_ALT =
  /<span[^>]*data-merge-path="([^"]+)"[^>]*class="[^"]*builder-merge-chip[^"]*"[^>]*>[\s\S]*?<\/span>/gi;

const MERGE_FIELD_SPAN =
  /<span[^>]*data-merge-field=["']true["'][^>]*>([\s\S]*?)<\/span>/gi;

const MERGE_FIELD_SPAN_ALT =
  /<span[^>]*data-gjs-type=["']text["'][^>]*data-merge-field=["']true["'][^>]*>([\s\S]*?)<\/span>/gi;

const { normalizeMergeTagExpression } = require('../../../utils/mergeTagPathNormalizer');

function formatMergeToken(path) {
  const trimmed = normalizeMergeTagExpression(String(path || '').trim());
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

/**
 * Convert builder merge chips in saved Grapes HTML into plain {{token}} text.
 * @param {string} html
 */
function normalizeGrapesHtmlMergeTokens(html) {
  let result = String(html || '');

  result = result.replace(MERGE_CHIP_WITH_CLASS, (_, path) => formatMergeToken(path));
  result = result.replace(MERGE_CHIP_WITH_CLASS_ALT, (_, path) => formatMergeToken(path));
  result = result.replace(MERGE_FIELD_SPAN, (_, content) => tokenFromSpanContent(content));
  result = result.replace(MERGE_FIELD_SPAN_ALT, (_, content) => tokenFromSpanContent(content));

  result = result.replace(
    /<img\b([^>]*?)\sdata-merge-src=(["'])([^"']+)\2([^>]*)>/gi,
    (_, before, quote, mergeSrc, after) => {
      const body = `${before}${after}`.replace(/\ssrc=(["'])[^"']*\1/i, '');
      return `<img${body} src=${quote}${mergeSrc}${quote}>`;
    }
  );

  return result;
}

module.exports = {
  normalizeGrapesHtmlMergeTokens,
  formatMergeToken
};

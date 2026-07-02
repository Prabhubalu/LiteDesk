'use strict';

/** @typedef {{ raw: string, pattern: string, platform: string, index: number }} DetectedMergeTag */

const MERGE_TAG_PATTERNS = [
  { platform: 'handlebars', pattern: /\{\{\s*([^#/^][^}]*?)\s*\}\}/g },
  { platform: 'mailchimp', pattern: /\*\|([A-Z0-9_]+)\|\*/g },
  { platform: 'salesforce', pattern: /%([A-Z0-9_]+)%/g },
  { platform: 'brackets', pattern: /\[\[([^\]]+)\]\]/g },
  { platform: 'hubspot', pattern: /\{%[\s\S]*?%\}/g }
];

/**
 * @param {string} html
 * @returns {DetectedMergeTag[]}
 */
function detectMergeTags(html) {
  const source = String(html || '');
  const found = [];
  const seen = new Set();

  for (const { platform, pattern } of MERGE_TAG_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(source)) !== null) {
      const raw = match[0];
      if (seen.has(raw)) continue;
      seen.add(raw);
      found.push({
        raw,
        pattern: platform,
        platform,
        index: match.index
      });
    }
  }

  return found.sort((a, b) => a.index - b.index);
}

/**
 * @param {string} html
 * @param {Record<string, { path?: string, skip?: boolean }>} mappings
 * @returns {string}
 */
function applyMergeTagMappings(html, mappings = {}) {
  let output = String(html || '');
  const entries = Object.entries(mappings || {});

  for (const [raw, mapping] of entries) {
    if (!raw || !mapping || mapping.skip || !mapping.path) continue;
    const token = mapping.path.includes('{{')
      ? mapping.path
      : `{{${mapping.path}}}`;
    output = output.split(raw).join(token);
  }

  return output;
}

module.exports = {
  MERGE_TAG_PATTERNS,
  detectMergeTags,
  applyMergeTagMappings
};

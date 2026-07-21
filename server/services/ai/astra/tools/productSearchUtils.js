'use strict';

/**
 * Shared helpers for Astra product-config search tools.
 */

function tokenize(query = '') {
  return String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9._-]+/)
    .filter((t) => t.length >= 2);
}

function scoreHaystack(haystack, needles) {
  const h = String(haystack || '').toLowerCase();
  let score = 0;
  for (const n of needles) {
    if (!n) continue;
    if (h.includes(n)) score += n.length >= 4 ? 2 : 1;
  }
  return score;
}

function matchQuery(row, needles, fields = []) {
  if (!needles.length) return true;
  const hay = fields.map((f) => row?.[f]).filter(Boolean).join(' ');
  return scoreHaystack(hay, needles) > 0;
}

function toCitations(records, sourceType) {
  return (records || [])
    .map((row) => ({
      sourceType,
      sourceId: String(row.id || row._id || ''),
      excerpt: String(row.title || row.name || '').slice(0, 160),
      score: 1,
    }))
    .filter((c) => c.sourceId);
}

function orgScope(organizationId) {
  return {
    $or: [
      { organizationId: null },
      { organizationId },
    ],
  };
}

module.exports = {
  tokenize,
  scoreHaystack,
  matchQuery,
  toCitations,
  orgScope,
};

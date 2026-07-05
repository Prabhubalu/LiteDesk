'use strict';

const KNOWN_SCOPE_ROOTS = [
  'Organization',
  'CurrentOrganization',
  'CustomerOrganization',
  'People',
  'Quote',
  'Invoice',
  'SalesOrder',
  'Deal',
  'Case',
  'Task',
  'Item',
  'System',
  'CurrentUser',
  'Record',
  'CurrentTenant',
  'Line'
];

function normalizePathSegment(segment, index) {
  const part = String(segment || '').trim();
  if (!part) return part;

  if (index === 0) {
    const lower = part.toLowerCase();
    const known = KNOWN_SCOPE_ROOTS.find((root) => root.toLowerCase() === lower);
    return known || part;
  }

  if (/^[A-Z0-9_]+$/.test(part) && part !== part.toLowerCase()) {
    return part.toLowerCase();
  }

  return part;
}

/**
 * Normalize merge tag path casing (ORGANIZATION.NAME → Organization.name).
 * @param {string} expression
 */
function normalizeMergeTagExpression(expression) {
  const raw = String(expression || '').trim();
  if (!raw) return raw;

  const [pathPart, ...formatParts] = raw.split('|').map((part) => part.trim());
  const parts = pathPart.split('.').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return raw;

  const normalizedPath = parts
    .map((part, index) => normalizePathSegment(part, index))
    .join('.');

  if (!formatParts.length) return normalizedPath;
  return [normalizedPath, ...formatParts].join('|');
}

module.exports = {
  KNOWN_SCOPE_ROOTS,
  normalizeMergeTagExpression,
  normalizePathSegment
};

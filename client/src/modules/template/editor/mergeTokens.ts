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

function normalizePathSegment(segment: string, index: number): string {
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

export function normalizeMergeTagPath(path: string): string {
  const raw = String(path || '').trim();
  if (!raw) return raw;

  const [pathPart = '', ...formatParts] = raw.split('|').map((part) => part.trim());
  const parts = pathPart.split('.').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return raw;

  const normalizedPath = parts
    .map((part, index) => normalizePathSegment(part, index))
    .join('.');

  if (!formatParts.length) return normalizedPath;
  return [normalizedPath, ...formatParts].join('|');
}

export function formatMergeToken(path: string): string {
  const trimmed = normalizeMergeTagPath(path.trim());
  if (!trimmed) return '{{field}}';
  if (trimmed.startsWith('{{')) return trimmed;
  return `{{${trimmed}}}`;
}

export function parseMergePathFromContent(content: string): string {
  const match = content.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  return match?.[1]?.trim() || content.replace(/[{}]/g, '').trim();
}

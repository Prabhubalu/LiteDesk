export function formatMergeToken(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '{{field}}';
  if (trimmed.startsWith('{{')) return trimmed;
  return `{{${trimmed}}}`;
}

export function parseMergePathFromContent(content: string): string {
  const match = content.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  return match?.[1]?.trim() || content.replace(/[{}]/g, '').trim();
}

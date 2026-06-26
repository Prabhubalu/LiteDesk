/**
 * Split display text into plain segments and merge-tag tokens for canvas preview.
 * @param {string} text
 * @returns {Array<{ kind: 'text' | 'merge', value: string }>}
 */
export function parsePreviewSegments(text) {
  const input = String(text || '');
  if (!input.includes('{{')) {
    return input ? [{ kind: 'text', value: input }] : [];
  }

  const segments = [];
  const pattern = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match = pattern.exec(input);

  while (match) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: input.slice(lastIndex, match.index) });
    }
    segments.push({ kind: 'merge', value: match[1].trim() });
    lastIndex = match.index + match[0].length;
    match = pattern.exec(input);
  }

  if (lastIndex < input.length) {
    segments.push({ kind: 'text', value: input.slice(lastIndex) });
  }

  return segments;
}

/**
 * Human-readable names for inbox thread participants (from participantDisplay / addresses).
 */

export function displayNameFromAddress(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^you$/i.test(s)) return 'You';

  const angle = s.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (angle) {
    const name = angle[1].trim();
    if (name && !name.includes('@')) return name;
    return humanizeEmailLocal(angle[2] || angle[1]);
  }

  if (s.includes('@')) {
    return humanizeEmailLocal(s);
  }

  return s;
}

function humanizeEmailLocal(value) {
  const email = String(value || '').trim();
  const local = (email.includes('@') ? email.split('@')[0] : email) || email;
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * @param {string} participantDisplay - e.g. "Jane Doe <j@x.com> ↔ You" or "a@x.com ↔ You"
 * @param {{ recordLabel?: string, relatedModuleKey?: string }} [opts]
 */
export function threadListSenderLine(participantDisplay, opts = {}) {
  const recordLabel = String(opts.recordLabel || '').trim();
  const mk = String(opts.relatedModuleKey || '').toLowerCase();
  if (recordLabel && recordLabel !== '—' && (mk === 'people' || mk === 'organizations')) {
    return recordLabel;
  }

  const p = String(participantDisplay || '').trim();
  if (!p) {
    return recordLabel && recordLabel !== '—' ? recordLabel : 'Unknown';
  }

  const names = [];
  for (const side of p.split(/\s*↔\s*/)) {
    const segment = String(side || '').trim();
    if (!segment) continue;
    if (/^you$/i.test(segment)) {
      names.push('You');
      continue;
    }
    for (const piece of segment.split(',')) {
      const name = displayNameFromAddress(piece.trim());
      if (name) names.push(name);
    }
  }

  const others = names.filter((n) => n !== 'You');
  if (others.length === 0) return names.includes('You') ? 'You' : 'Unknown';
  if (others.length === 1) return others[0];
  if (others.length === 2) return others.join(', ');
  return `${others.slice(0, 2).join(', ')} +${others.length - 2}`;
}

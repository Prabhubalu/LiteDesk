import { displayNameFromAddress } from '@/utils/emailParticipantDisplay';

/**
 * Split a To/Cc/Bcc field into individual address tokens (supports "Name <email>" values).
 */
export function splitRecipientField(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const tokens = [];
  let current = '';
  let inAngle = false;

  for (const ch of raw) {
    if (ch === '<') inAngle = true;
    if (ch === '>' && inAngle) {
      inAngle = false;
      current += ch;
      continue;
    }
    if ((ch === ',' || ch === ';') && !inAngle) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) tokens.push(current.trim());

  return tokens;
}

export function joinRecipientField(tokens) {
  return tokens.filter(Boolean).join(', ');
}

export function chipLabelForToken(token) {
  const label = displayNameFromAddress(token);
  const email = extractEmailFromToken(token);
  if (label && email && label.toLowerCase() !== email.toLowerCase()) return label;
  return email || label || token;
}

export function extractEmailFromToken(token) {
  const raw = String(token || '').trim();
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
}

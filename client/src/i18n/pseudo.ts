/**
 * Pseudo-localization transforms for layout QA (en-XA) and RTL QA (ar-XB).
 * @see client/docs/I18N_QA_CHECKLIST.md
 */

const ACCENT_MAP: Record<string, string> = {
  a: 'á',
  A: 'Á',
  e: 'ë',
  E: 'Ë',
  i: 'ï',
  I: 'Ï',
  o: 'ö',
  O: 'Ö',
  u: 'ü',
  U: 'Ü',
  s: 'š',
  S: 'Š',
  c: 'ç',
  C: 'Ç',
  n: 'ñ',
  N: 'Ñ',
};

/** Expand string ~30% with padding brackets for overflow testing. */
export function expandPseudoText(input: string): string {
  if (!input || input.startsWith('[')) return input;
  const accented = [...input]
    .map((ch) => ACCENT_MAP[ch] ?? ch)
    .join('');
  const pad = '~'.repeat(Math.max(1, Math.ceil(accented.length * 0.3)));
  return `[${accented}${pad}]`;
}

/** Apply pseudo transform to all string leaves in a message map. */
export function pseudoTransformMessages(messages: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    out[key] = pseudoTransformMessageValue(value);
  }
  return out;
}

/**
 * Preserve ICU placeholders while accenting visible text.
 */
export function pseudoTransformMessageValue(message: string): string {
  if (!message) return message;

  const placeholders: string[] = [];
  const stripped = message.replace(
    /\{[^{}]+\}/g,
    (match) => {
      placeholders.push(match);
      return `\u0000${placeholders.length - 1}\u0000`;
    }
  );

  const transformed = expandPseudoText(stripped);

  return transformed.replace(/\u0000(\d+)\u0000/g, (_, index) => placeholders[Number(index)] ?? '');
}

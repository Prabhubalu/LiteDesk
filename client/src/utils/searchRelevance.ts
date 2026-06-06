const NO_MATCH_SCORE = 99;

function escapeSearchRegex(term: string): string {
  return String(term || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearchTerm(term: string): string {
  return String(term || '').trim();
}

/** Comma-separated values are treated as OR terms. */
export function parseSearchTerms(query: string): string[] {
  const normalized = normalizeSearchTerm(query);
  if (!normalized) return [];
  return normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Lower score = better match.
 * 0 = prefix, 1 = word-boundary prefix, 2 = contains, 99 = no match
 */
export function scoreTextMatch(text: string, query: string): number {
  const normalized = normalizeSearchTerm(query);
  if (!normalized) return NO_MATCH_SCORE;

  const value = String(text ?? '').trim();
  if (!value) return NO_MATCH_SCORE;

  const lowerValue = value.toLowerCase();
  const lowerQuery = normalized.toLowerCase();

  if (lowerValue.startsWith(lowerQuery)) return 0;

  const wordBoundaryRegex = new RegExp(`(?:^|\\s)${escapeSearchRegex(normalized)}`, 'i');
  if (wordBoundaryRegex.test(value)) return 1;

  if (lowerValue.includes(lowerQuery)) return 2;

  return NO_MATCH_SCORE;
}

export function scoreRecordTexts(texts: string[], query: string, primary = true): number {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return NO_MATCH_SCORE;

  let best = NO_MATCH_SCORE;
  const offset = primary ? 0 : 3;

  for (const term of terms) {
    for (const text of texts) {
      const textScore = scoreTextMatch(text, term);
      if (textScore === NO_MATCH_SCORE) continue;
      best = Math.min(best, textScore + offset);
    }
  }

  return best;
}

export function matchesAnySearchTerm(text: string, query: string): boolean {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return false;
  const lowerValue = String(text ?? '').toLowerCase();
  return terms.some((term) => lowerValue.includes(term.toLowerCase()));
}

export function sortBySearchRelevance<T>(
  items: T[],
  query: string,
  getSearchableTexts: (item: T) => { texts: string[]; primary?: boolean }[]
): T[] {
  if (parseSearchTerms(query).length === 0 || items.length === 0) return items;

  return [...items].sort((a, b) => {
    const scoreA = Math.min(
      ...getSearchableTexts(a).map(({ texts, primary = true }) =>
        scoreRecordTexts(texts, query, primary)
      )
    );
    const scoreB = Math.min(
      ...getSearchableTexts(b).map(({ texts, primary = true }) =>
        scoreRecordTexts(texts, query, primary)
      )
    );
    return scoreA - scoreB;
  });
}

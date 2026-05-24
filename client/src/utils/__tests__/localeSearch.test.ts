import { describe, expect, it } from 'vitest';
import { localeIncludes, localeSort, normalizeSearchKey } from '../localeSearch';

describe('localeSearch', () => {
  it('normalizes accents for comparison', () => {
    expect(normalizeSearchKey('José')).toBe(normalizeSearchKey('Jose'));
  });

  it('transliterates umlauts', () => {
    expect(normalizeSearchKey('Müller')).toBe(normalizeSearchKey('Muller'));
  });

  it('finds accent-insensitive matches', () => {
    expect(localeIncludes('José García', 'jose')).toBe(true);
  });

  it('sorts with locale-aware compare', () => {
    const sorted = localeSort(['Zara', 'Ábel', 'mario'], (s) => s, { locale: 'en' });
    expect(sorted[0]).toBe('Ábel');
  });
});

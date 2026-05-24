import { describe, expect, it } from 'vitest';
import { expandPseudoText, pseudoTransformMessageValue } from '../pseudo';

describe('pseudo localization', () => {
  it('expands and accents plain text', () => {
    const result = expandPseudoText('Save');
    expect(result).toMatch(/^\[/);
    expect(result.length).toBeGreaterThan('Save'.length);
  });

  it('preserves ICU placeholders', () => {
    const msg = '{count, plural, one {# record} other {# records}}';
    const out = pseudoTransformMessageValue(msg);
    expect(out).toContain('# record');
    expect(out).toMatch(/\{[^{}]*#/);
  });
});

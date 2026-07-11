import { describe, expect, it } from 'vitest';
import { picklistChipStyle } from '@/utils/picklistColorPalette';
import { picklistBadgeStyle } from '@/utils/peopleParticipationPicklistColors';

describe('picklistChipStyle', () => {
  it('returns empty for missing color', () => {
    expect(picklistChipStyle(null)).toEqual({});
    expect(picklistChipStyle('')).toEqual({});
  });

  it('returns soft fill, ink, and hairline border', () => {
    const style = picklistChipStyle('#2563EB');
    expect(style.backgroundColor).toBe('rgba(37, 99, 235, 0.12)');
    expect(style.color).toBe('#2563EB');
    expect(style.borderColor).toBe('rgba(37, 99, 235, 0.28)');
    expect(style.borderWidth).toBe('1px');
    expect(style.borderStyle).toBe('solid');
  });

  it('darkens ink for light hues', () => {
    const style = picklistChipStyle('#EAB308');
    expect(style.color).not.toBe('#EAB308');
    expect(style.backgroundColor).toMatch(/^rgba\(234, 179, 8, 0\.12\)$/);
  });

  it('picklistBadgeStyle delegates to soft chip', () => {
    expect(picklistBadgeStyle('#16A34A')).toEqual(picklistChipStyle('#16A34A'));
  });
});

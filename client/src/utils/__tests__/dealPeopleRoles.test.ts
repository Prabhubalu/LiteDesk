import { describe, expect, it } from 'vitest';
import {
  defaultDealPersonRole,
  enforceSinglePrimaryPerson,
  isDealPersonRole,
  normalizeDealPersonRole,
} from '@/utils/dealPeopleRoles';

describe('dealPeopleRoles', () => {
  it('recognizes system deal person roles', () => {
    expect(isDealPersonRole('decision_maker')).toBe(true);
    expect(isDealPersonRole('Champion')).toBe(true);
    expect(isDealPersonRole('primary_contact')).toBe(false);
    expect(isDealPersonRole('unknown')).toBe(false);
  });

  it('migrates legacy primary_contact to decision_maker', () => {
    expect(normalizeDealPersonRole('primary_contact')).toBe('decision_maker');
    expect(normalizeDealPersonRole('decision_maker')).toBe('decision_maker');
    expect(normalizeDealPersonRole('nope')).toBe('other');
  });

  it('defaults first person to decision_maker and later to influencer', () => {
    expect(defaultDealPersonRole(false)).toBe('decision_maker');
    expect(defaultDealPersonRole(true)).toBe('influencer');
  });

  it('enforces exactly one primary without changing roles', () => {
    const rows = [
      { personId: 'a', role: 'influencer', isPrimary: true, isActive: true },
      { personId: 'b', role: 'champion', isPrimary: true, isActive: true },
    ];
    const next = enforceSinglePrimaryPerson(rows, 'b', (v) => String(v ?? ''));
    expect(next.filter((r) => r.isPrimary)).toHaveLength(1);
    expect(next.find((r) => r.personId === 'b')?.isPrimary).toBe(true);
    expect(next.find((r) => r.personId === 'a')?.role).toBe('influencer');
    expect(next.find((r) => r.personId === 'b')?.role).toBe('champion');
  });

  it('keeps one person identity: normalize does not invent duplicate roles', () => {
    expect(normalizeDealPersonRole('technical_contact')).toBe('technical_contact');
    expect(normalizeDealPersonRole('procurement')).toBe('procurement');
    expect(normalizeDealPersonRole('legal')).toBe('legal');
  });
});

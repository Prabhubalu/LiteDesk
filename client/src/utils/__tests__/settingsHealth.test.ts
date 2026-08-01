import { describe, expect, it } from 'vitest';
import {
  countEnabledNumbering,
  evaluateSettingsHealth,
  unwrapTaxList,
} from '@/utils/settingsHealth';

describe('evaluateSettingsHealth', () => {
  it('flags incomplete org and disabled 2FA', () => {
    const items = evaluateSettingsHealth({
      orgName: '',
      orgCurrency: 'USD',
      canCheckSecurity: true,
      twoFactorEnabled: false,
      canCheckTaxes: false,
      canCheckNumbering: false,
    });
    expect(items.find((i) => i.catalogId === 'organization')?.status).toBe('attention');
    expect(items.find((i) => i.catalogId === 'security')?.status).toBe('attention');
  });

  it('marks taxes ok when rates exist', () => {
    const items = evaluateSettingsHealth({
      orgName: 'Acme',
      orgCurrency: 'USD',
      canCheckSecurity: false,
      canCheckTaxes: true,
      taxCount: 2,
      canCheckNumbering: true,
      numberingEnabledCount: 1,
    });
    expect(items.find((i) => i.catalogId === 'organization')?.status).toBe('ok');
    expect(items.find((i) => i.catalogId === 'inventory.taxes')?.status).toBe('ok');
    expect(items.find((i) => i.catalogId === 'automation.module-numbering')?.status).toBe('ok');
  });

  it('uses unknown when optional signals failed', () => {
    const items = evaluateSettingsHealth({
      orgName: 'Acme',
      orgCurrency: 'USD',
      canCheckSecurity: true,
      twoFactorEnabled: null,
      canCheckTaxes: true,
      taxCount: null,
      canCheckNumbering: false,
    });
    expect(items.find((i) => i.catalogId === 'security')?.status).toBe('unknown');
    expect(items.find((i) => i.catalogId === 'inventory.taxes')?.status).toBe('unknown');
  });
});

describe('unwrap helpers', () => {
  it('unwraps tax list shapes', () => {
    expect(unwrapTaxList([{ id: 1 }])).toHaveLength(1);
    expect(unwrapTaxList({ data: [{ id: 1 }, { id: 2 }] })).toHaveLength(2);
  });

  it('counts enabled numbering configs', () => {
    expect(countEnabledNumbering([{ enabled: true }, { enabled: false }])).toBe(1);
    expect(countEnabledNumbering(null)).toBeNull();
  });
});

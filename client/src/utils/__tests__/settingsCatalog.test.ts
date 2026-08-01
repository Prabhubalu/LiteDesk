import { describe, expect, it } from 'vitest';
import {
  SETTINGS_CATALOG,
  getAccessibleSettingsCatalog,
  isSettingsHub,
  searchSettingsCatalog,
} from '@/utils/settingsCatalog';

const t = (key: string) => {
  const map: Record<string, string> = {
    'settings.tabSecurity': 'Security',
    'settings.tabSecurityDesc': 'Manage SSO and login policies',
    'settings.tabUsersAccess': 'Users & Access',
    'settings.tabUsersAccessDesc': 'Control who can use the platform',
    'settings.usersTabRoles': 'Roles & Permissions',
    'settings.tabInventory': 'Inventory',
    'settings.tabInventoryDesc': 'Stock and warehouses',
    'settings.inventoryTaxes': 'Taxes',
    'settings.inventoryTaxesDesc': 'Configure tax rates',
    'settings.inventoryCharges': 'Charges',
    'settings.inventoryChargesDesc': 'Configure charges',
  };
  return map[key] || key;
};

describe('searchSettingsCatalog', () => {
  const ctx = {
    isOwner: true,
    role: 'owner',
    permissions: {},
    inventoryEnabled: true,
  };
  const catalog = getAccessibleSettingsCatalog(ctx);

  it('ranks exact alias ahead of substring', () => {
    const hits = searchSettingsCatalog('sso', catalog, t);
    expect(hits[0]?.id).toBe('security');
  });

  it('deep-links taxes via vat alias', () => {
    const hits = searchSettingsCatalog('vat', catalog, t);
    expect(hits[0]?.id).toBe('inventory.taxes');
    expect(hits[0]?.parentLabel).toBe('Inventory');
  });

  it('deep-links roles leaf', () => {
    const hits = searchSettingsCatalog('roles', catalog, t);
    expect(hits[0]?.id).toBe('users-access.roles');
  });

  it('keeps hubs for overview grid', () => {
    expect(SETTINGS_CATALOG.some((e) => e.id === 'inventory.taxes' && !isSettingsHub(e))).toBe(true);
    expect(getAccessibleSettingsCatalog(ctx).filter(isSettingsHub).every(isSettingsHub)).toBe(true);
  });
});

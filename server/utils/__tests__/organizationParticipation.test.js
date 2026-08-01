const {
  resolveAvailableOrganizationRoles,
  appsOwningRole,
  ORGANIZATION_PARTICIPATION_BY_APP,
} = require('../constants/organizationParticipation');
const {
  applyTypesWrite,
  deriveTypesFromParticipations,
  validateOrganizationTypesForEnabledApps,
} = require('../utils/syncOrganizationParticipation');
const { resolveOrganizationTypes } = require('../utils/organizationTypeResolver');

describe('organizationParticipation', () => {
  test('Sales-only exposes Lead + Customer', () => {
    expect(
      resolveAvailableOrganizationRoles([{ appKey: 'SALES', status: 'ACTIVE' }])
    ).toEqual(['Lead', 'Customer']);
  });

  test('Inventory adds Vendor; Portal adds Partner; Marketing adds Marketing Lead', () => {
    expect(
      resolveAvailableOrganizationRoles([
        { appKey: 'SALES', status: 'ACTIVE' },
        { appKey: 'HELPDESK', status: 'ACTIVE' },
        { appKey: 'INVENTORY', status: 'ACTIVE' },
        { appKey: 'MARKETING', status: 'ACTIVE' },
        { appKey: 'PORTAL', status: 'ACTIVE' },
      ])
    ).toEqual(['Lead', 'Customer', 'Marketing Lead', 'Vendor', 'Partner']);
  });

  test('Customer is owned by Sales, Helpdesk, Marketing when enabled', () => {
    expect(
      appsOwningRole('Customer', [
        { appKey: 'SALES', status: 'ACTIVE' },
        { appKey: 'HELPDESK', status: 'ACTIVE' },
        { appKey: 'INVENTORY', status: 'ACTIVE' },
      ])
    ).toEqual(['SALES', 'HELPDESK']);
  });

  test('applyTypesWrite builds participations and denormalized types', () => {
    const { types, participations } = applyTypesWrite({
      types: ['Customer', 'Vendor'],
      enabledAppKeys: ['SALES', 'INVENTORY'],
    });
    expect(types).toEqual(['Customer', 'Vendor']);
    expect(participations.SALES.role).toBe('Customer');
    expect(participations.INVENTORY.role).toBe('Vendor');
    expect(participations.PORTAL).toBeUndefined();
  });

  test('deriveTypesFromParticipations unions roles', () => {
    expect(
      deriveTypesFromParticipations({
        SALES: { role: 'Lead' },
        HELPDESK: { role: 'Customer' },
        PORTAL: { role: 'Partner' },
      })
    ).toEqual(['Lead', 'Customer', 'Partner']);
  });

  test('validate rejects types for disabled apps', () => {
    const allowed = resolveAvailableOrganizationRoles([{ appKey: 'SALES', status: 'ACTIVE' }]);
    const result = validateOrganizationTypesForEnabledApps(['Vendor'], allowed);
    expect(result.valid).toBe(false);
    expect(result.invalid).toContain('Vendor');
  });

  test('resolver byApp matches registry', () => {
    const resolved = resolveOrganizationTypes({
      enabledApps: ['SALES', 'PORTAL'],
    });
    expect(resolved.byApp.SALES.types).toEqual([
      ...ORGANIZATION_PARTICIPATION_BY_APP.SALES.allowedTypes,
    ]);
    expect(resolved.byApp.PORTAL.types).toEqual(['Partner']);
    expect(resolved.byApp.INVENTORY).toBeUndefined();
  });
});

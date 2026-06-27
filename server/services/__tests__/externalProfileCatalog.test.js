'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  filterCatalogForExternalAccess,
  filterCatalogForProfileKey,
  getExternalProfileDefaultModuleKeys,
  isPlatformAdminCatalogModule
} = require('../../constants/externalProfileCatalog');
const { SYSTEM_PROFILE_KEYS } = require('../../permissions/profileKeys');
const {
  expandProfilePermissionsForUI,
  normalizeRolePermissions
} = require('../rolePermissionCatalogService');
const { buildPortalCustomerPermissions } = require('../profileMatrixBuilders');

describe('externalProfileCatalog', () => {
  it('returns portal customer default module keys', () => {
    const keys = getExternalProfileDefaultModuleKeys(SYSTEM_PROFILE_KEYS.PORTAL_CUSTOMER);
    assert.ok(keys.includes('cases'));
    assert.ok(keys.includes('documents'));
    assert.equal(keys.includes('people'), false);
  });

  it('identifies platform admin catalog rows', () => {
    assert.equal(isPlatformAdminCatalogModule({ scope: 'platform', key: 'users' }), true);
    assert.equal(isPlatformAdminCatalogModule({ scope: 'core', key: 'people' }), false);
  });

  it('filters catalog to external access scope (core + app, no platform admin)', () => {
    const catalog = {
      modules: [
        { key: 'users', scope: 'platform', sectionId: 'platform' },
        { key: 'people', scope: 'core', sectionId: 'core' },
        { key: 'cases', scope: 'app', appKey: 'HELPDESK', sectionId: 'app-helpdesk' },
        { key: 'documents', scope: 'core', sectionId: 'core' }
      ],
      sections: [
        { id: 'platform', label: 'Platform Administration' },
        { id: 'core', label: 'Core' },
        { id: 'app-helpdesk', label: 'Helpdesk' }
      ]
    };
    const filtered = filterCatalogForExternalAccess(catalog, {
      profileKey: SYSTEM_PROFILE_KEYS.PORTAL_CUSTOMER
    });
    assert.equal(filtered.modules.length, 3);
    assert.equal(filtered.externalProfile, true);
    assert.equal(filtered.profileScoped, false);
    assert.deepEqual(
      filtered.modules.map((m) => m.key).sort(),
      ['cases', 'documents', 'people']
    );
    assert.deepEqual(filtered.sections.map((s) => s.id).sort(), ['app-helpdesk', 'core']);
  });

  it('filterCatalogForProfileKey delegates to external access filter', () => {
    const catalog = {
      modules: [
        { key: 'settings', scope: 'platform', sectionId: 'platform' },
        { key: 'invoices', scope: 'core', sectionId: 'core' }
      ],
      sections: [
        { id: 'platform', label: 'Platform Administration' },
        { id: 'core', label: 'Core' }
      ]
    };
    const filtered = filterCatalogForProfileKey(catalog, SYSTEM_PROFILE_KEYS.PORTAL_CUSTOMER);
    assert.equal(filtered.modules.length, 1);
    assert.equal(filtered.modules[0].key, 'invoices');
  });
});

describe('expandProfilePermissionsForUI', () => {
  it('maps appPermissions to AUDIT catalog keys', () => {
    const expanded = expandProfilePermissionsForUI({
      permissions: { events: { read: true, create: false, update: false, delete: false } },
      appPermissions: {
        AUDIT: {
          audits: { read: true, update: true, create: false, delete: false, scope: 'own' }
        }
      }
    });
    assert.equal(expanded['AUDIT:audits']?.read, true);
    assert.equal(expanded['AUDIT:audits']?.update, true);
    assert.equal(expanded.events?.read, true);
  });

  it('builds portal customer storage with catalog-aligned audit split', () => {
    const payload = buildPortalCustomerPermissions();
    assert.equal(payload.permissions.cases?.read, true);
    assert.equal(payload.permissions.cases?.update, true);
    assert.equal(payload.permissions.people, undefined);
    const ui = expandProfilePermissionsForUI(payload);
    assert.equal(ui.cases?.read, true);
    assert.equal(ui.documents?.read, true);
  });
});

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const Profile = require('../../models/Profile');
const {
  mergeFieldPermissionMaps,
  mergeModulePermissionMaps,
  resolveRoleLeanWithProfile
} = require('../../services/roleProfileResolver');

test('mergeFieldPermissionMaps applies role overrides on profile baseline', () => {
  const profile = {
    'SALES.deals.amount': 'read',
    'SALES.people.email': 'hidden'
  };
  const role = {
    'SALES.deals.amount': 'write'
  };

  const merged = mergeFieldPermissionMaps(profile, role);
  assert.equal(merged['SALES.deals.amount'], 'write');
  assert.equal(merged['SALES.people.email'], 'hidden');
});

test('mergeFieldPermissionMaps keeps profile-only keys when role has no override', () => {
  const profile = { 'SALES.deals.stage': 'read' };
  const role = {};
  const merged = mergeFieldPermissionMaps(profile, role);
  assert.equal(merged['SALES.deals.stage'], 'read');
});

test('mergeModulePermissionMaps uses profile baseline when role has no module grants', () => {
  const profile = {
    cases: { read: true, create: true, update: true, delete: false, scope: 'own' },
    documents: { read: true, create: false, update: false, delete: false, scope: 'own' }
  };
  const role = {};
  const merged = mergeModulePermissionMaps(profile, role);
  assert.equal(merged.cases.read, true);
  assert.equal(merged.documents.read, true);
});

test('mergeModulePermissionMaps applies role overrides on profile baseline', () => {
  const profile = {
    cases: { read: true, create: true, update: true, delete: false, scope: 'own' },
    documents: { read: true, create: false, update: false, delete: false, scope: 'own' }
  };
  const role = {
    documents: { read: false, create: false, update: false, delete: false, scope: 'own' }
  };
  const merged = mergeModulePermissionMaps(profile, role);
  assert.equal(merged.cases.read, true);
  assert.equal(merged.documents.read, false);
});

test('resolveRoleLeanWithProfile applies additive role module overrides on profile baseline', async () => {
  const profileId = '507f1f77bcf86cd799439011';
  const profileLean = {
    _id: profileId,
    profileKey: 'portal_customer',
    permissions: {
      cases: { read: true, create: true, update: true, delete: false, scope: 'own' },
      documents: { read: true, create: false, update: false, delete: false, scope: 'own' },
      forms: { read: false, create: false, update: false, delete: false, scope: 'own' }
    }
  };

  const findByIdMock = mock.method(Profile, 'findById', () => ({
    lean: async () => profileLean
  }));

  const roleLean = {
    _id: '507f1f77bcf86cd799439012',
    privilegeMode: 'profile',
    profileId,
    permissions: {
      forms: { read: true, create: true, update: true, delete: false, scope: 'own' },
      documents: { read: true, create: true, update: false, delete: false, scope: 'own' }
    }
  };

  const resolved = await resolveRoleLeanWithProfile(roleLean, {
    settings: { rbacV2Enabled: true }
  });

  assert.equal(resolved.permissions.forms.read, true);
  assert.equal(resolved.permissions.documents.create, true);
  assert.equal(resolved.permissions.cases.read, true);
  findByIdMock.mock.restore();
});

test('pickModulePermissionOverrides keeps only grants that differ from profile', () => {
  const { pickModulePermissionOverrides } = require('../../services/roleProfileResolver');
  const profile = {
    cases: { read: true, create: true, update: true, delete: false, scope: 'own' },
    documents: { read: true, create: false, update: false, delete: false, scope: 'own' }
  };
  const candidate = {
    cases: { read: true, create: true, update: true, delete: false, scope: 'own' },
    documents: { read: false, create: false, update: false, delete: false, scope: 'own' },
    people: { read: true, create: false, update: false, delete: false, scope: 'own' }
  };
  const overrides = pickModulePermissionOverrides(profile, candidate);
  assert.equal(overrides.cases, undefined);
  assert.equal(overrides.documents.read, false);
  assert.equal(overrides.people.read, true);
});

test('sanitizeModulePermissionOverrides drops nested non-grant shapes', () => {
  const { sanitizeModulePermissionOverrides } = require('../../services/roleProfileResolver');
  const sanitized = sanitizeModulePermissionOverrides({}, {
    cases: { read: false, create: false, update: false, delete: false, scope: 'own' },
    performance: { targets: { view: false } },
    people: { read: true, create: false, update: false, delete: false, scope: 'own' }
  });
  assert.equal(sanitized.performance, undefined);
  assert.equal(sanitized.cases.read, false);
  assert.equal(sanitized.people.read, true);
});

test('resolveRoleLeanWithProfile applies deny and additive role overrides', async () => {
  const profileId = '507f1f77bcf86cd799439011';
  const profileLean = {
    _id: profileId,
    profileKey: 'portal_customer',
    permissions: {
      cases: { read: true, create: true, update: true, delete: false, scope: 'own' },
      documents: { read: true, create: false, update: false, delete: false, scope: 'own' }
    }
  };

  const findByIdMock = mock.method(Profile, 'findById', () => ({
    lean: async () => profileLean
  }));

  const roleLean = {
    _id: '507f1f77bcf86cd799439012',
    privilegeMode: 'profile',
    profileId,
    permissions: {
      cases: { read: false, create: false, update: false, delete: false, scope: 'own' },
      people: { read: true, create: false, update: false, delete: false, scope: 'own' }
    }
  };

  const resolved = await resolveRoleLeanWithProfile(roleLean, {
    settings: { rbacV2Enabled: true }
  });

  assert.equal(resolved.permissions.cases.read, false);
  assert.equal(resolved.permissions.people.read, true);
  assert.equal(resolved.permissions.documents.read, true);
  findByIdMock.mock.restore();
});

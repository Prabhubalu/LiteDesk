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

test('resolveRoleLeanWithProfile ignores stale role module grants in profile mode', async () => {
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
      responses: { read: true, create: false, update: false, delete: false, scope: 'own' }
    }
  };

  const resolved = await resolveRoleLeanWithProfile(roleLean, {
    settings: { rbacV2Enabled: true }
  });

  assert.equal(resolved.permissions.forms.read, false);
  assert.equal(resolved.permissions.responses, undefined);
  findByIdMock.mock.restore();
});

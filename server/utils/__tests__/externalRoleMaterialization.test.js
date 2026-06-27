'use strict';

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Role = require('../../models/Role');
const {
  materializeEffectiveCRMEnvelopeOnUser,
  resolveExternalRoleIdForSession,
  clearExternalUserStaleEnvelope
} = require('../rolePermissionProjection');

describe('external role materialization', () => {
  it('resolveExternalRoleIdForSession prefers explicit JWT role id', () => {
    const explicit = new mongoose.Types.ObjectId();
    const user = {
      defaultExternalRoleId: new mongoose.Types.ObjectId(),
      externalRoleAssignments: [{ roleId: new mongoose.Types.ObjectId(), status: 'ACTIVE' }]
    };
    assert.equal(String(resolveExternalRoleIdForSession(user, explicit)), String(explicit));
  });

  it('resolveExternalRoleIdForSession falls back to sole active assignment', () => {
    const soleRoleId = new mongoose.Types.ObjectId();
    const user = {
      externalRoleAssignments: [
        { roleId: soleRoleId, status: 'ACTIVE' },
        { roleId: new mongoose.Types.ObjectId(), status: 'INACTIVE' }
      ]
    };
    assert.equal(String(resolveExternalRoleIdForSession(user, null)), String(soleRoleId));
  });

  it('clearExternalUserStaleEnvelope removes stale internal permissions', () => {
    const user = {
      roleId: new mongoose.Types.ObjectId(),
      permissions: { contacts: { view: true }, people: { view: true } },
      appAccess: [{ appKey: 'SALES', status: 'ACTIVE' }],
      allowedApps: ['SALES']
    };
    clearExternalUserStaleEnvelope(user);
    assert.equal(user.roleId, null);
    assert.deepEqual(user.permissions, {});
    assert.deepEqual(user.appAccess, []);
    assert.deepEqual(user.allowedApps, []);
  });

  it('materializeEffectiveCRMEnvelopeOnUser hydrates external user from JWT role id', async () => {
    const externalRoleId = new mongoose.Types.ObjectId();
    const organizationId = new mongoose.Types.ObjectId();
    const externalRoleLean = {
      _id: externalRoleId,
      name: 'Portal Customer',
      userType: 'EXTERNAL',
      appEntitlements: [{ appKey: 'PORTAL', enabled: true, appRoleKey: 'CUSTOMER' }],
      permissions: { cases: { read: true, scope: 'own' } }
    };

    const findOneMock = mock.method(Role, 'findOne', () => ({
      lean: async () => externalRoleLean
    }));

    const user = {
      userType: 'EXTERNAL',
      roleId: new mongoose.Types.ObjectId(),
      permissions: { contacts: { view: true }, people: { view: true } },
      appAccess: [{ appKey: 'SALES', status: 'ACTIVE' }],
      externalRoleAssignments: [{ roleId: externalRoleId, status: 'ACTIVE' }],
      organizationId
    };
    const organization = {
      _id: organizationId,
      enabledApps: [{ appKey: 'PORTAL', status: 'ACTIVE' }]
    };

    await materializeEffectiveCRMEnvelopeOnUser(user, {
      organization,
      activeExternalRoleId: externalRoleId
    });

    assert.equal(String(user.activeExternalRoleId), String(externalRoleId));
    assert.ok(Array.isArray(user.allowedApps));
    assert.ok(user.allowedApps.includes('PORTAL'));
    assert.equal(user.allowedApps.includes('SALES'), false);

    findOneMock.mock.restore();
  });
});

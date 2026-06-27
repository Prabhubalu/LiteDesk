'use strict';

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Role = require('../../models/Role');
const { hydrateExternalUserSession } = require('../externalRoleSessionService');

describe('externalRoleSessionService — stale roleId', () => {
  it('hydrates permissions from activeExternalRoleId, not persisted roleId', async () => {
    const externalRoleId = new mongoose.Types.ObjectId();
    const staleRoleId = new mongoose.Types.ObjectId();
    const organizationId = new mongoose.Types.ObjectId();

    const externalRoleLean = {
      _id: externalRoleId,
      name: 'Portal Customer',
      userType: 'EXTERNAL',
      appEntitlements: [{ appKey: 'PORTAL', enabled: true, appRoleKey: 'CUSTOMER' }],
      permissions: { contacts: { view: true } }
    };

    const findOneMock = mock.method(Role, 'findOne', () => ({
      lean: async () => externalRoleLean
    }));

    const user = {
      userType: 'EXTERNAL',
      roleId: staleRoleId,
      externalRoleAssignments: [{ roleId: externalRoleId, status: 'ACTIVE' }],
      organizationId
    };
    const organization = {
      _id: organizationId,
      enabledApps: [{ appKey: 'PORTAL', status: 'ACTIVE' }]
    };

    const result = await hydrateExternalUserSession(user, externalRoleId, organization);

    assert.equal(result.ok, true);
    assert.equal(String(user.activeExternalRoleId), String(externalRoleId));
    assert.equal(findOneMock.mock.calls.length, 1);
    assert.equal(String(findOneMock.mock.calls[0].arguments[0]._id), String(externalRoleId));
    assert.notEqual(String(findOneMock.mock.calls[0].arguments[0]._id), String(staleRoleId));

    findOneMock.mock.restore();
  });
});

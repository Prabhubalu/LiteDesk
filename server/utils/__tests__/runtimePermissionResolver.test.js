'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildOrgPermissionContext,
  buildModulesByAppFromRole,
  resolveRuntimePermission,
  resolveStringPermission,
  parsePermissionString,
  passesOrgAuthorizationGuards,
  materializeRuntimePermissionsOnUser
} = require('../../services/runtimePermissionResolver');
const { projectRoleToUserPermissions } = require('../rolePermissionProjection');

test('org guard blocks deals when SALES app disabled', () => {
  const orgContext = buildOrgPermissionContext({
    enabledApps: [{ appKey: 'HELPDESK', status: 'ACTIVE' }],
    moduleOverrides: {}
  });

  assert.equal(passesOrgAuthorizationGuards(orgContext, 'deals', 'SALES'), false);
});

test('appPermissions projected into modulesByApp and enforceable at runtime', () => {
  const role = {
    name: 'Agent',
    permissions: {
      contacts: { read: true, create: false, update: false, delete: false }
    },
    appPermissions: {
      AUDIT: {
        findings: { read: true, create: true, update: false, delete: false }
      }
    }
  };

  const byApp = buildModulesByAppFromRole(role);
  assert.equal(byApp.AUDIT.findings.view, true);
  assert.equal(byApp.AUDIT.findings.create, true);

  const orgContext = buildOrgPermissionContext({
    enabledApps: [
      { appKey: 'SALES', status: 'ACTIVE' },
      { appKey: 'AUDIT', status: 'ACTIVE' }
    ],
    moduleOverrides: {}
  });

  const user = {
    permissions: projectRoleToUserPermissions(role, []),
    _permissionRuntime: {
      envelope: projectRoleToUserPermissions(role, []),
      modulesByApp: byApp,
      flat: {}
    },
    _orgPermissionContext: orgContext
  };

  assert.equal(
    resolveRuntimePermission(user, 'findings', 'view', { appKey: 'AUDIT', orgContext }),
    true
  );
  assert.equal(
    resolveRuntimePermission(user, 'findings', 'view', { appKey: 'SALES', orgContext }),
    false
  );
});

test('stale deals grant denied when SALES disabled for org', () => {
  const role = {
    name: 'User',
    permissions: {
      deals: { read: true, create: true, update: true, delete: true }
    }
  };

  const orgContext = buildOrgPermissionContext({
    enabledApps: [{ appKey: 'HELPDESK', status: 'ACTIVE' }],
    moduleOverrides: {}
  });

  const user = {
    permissions: projectRoleToUserPermissions(role, []),
    _permissionRuntime: {
      envelope: projectRoleToUserPermissions(role, []),
      modulesByApp: buildModulesByAppFromRole(role),
      flat: {}
    },
    _orgPermissionContext: orgContext
  };

  assert.equal(
    resolveRuntimePermission(user, 'deals', 'view', { appKey: 'SALES', orgContext }),
    false
  );
});

test('core module participation override denies people for app', () => {
  const orgContext = buildOrgPermissionContext({
    enabledApps: [
      { appKey: 'SALES', status: 'ACTIVE' },
      { appKey: 'HELPDESK', status: 'ACTIVE' }
    ],
    moduleOverrides: {
      people: { HELPDESK: false }
    }
  });

  assert.equal(passesOrgAuthorizationGuards(orgContext, 'people', 'HELPDESK'), false);
  assert.equal(passesOrgAuthorizationGuards(orgContext, 'contacts', 'HELPDESK'), false);
});

test('parsePermissionString maps people.attach.sales to create + SALES', () => {
  const parsed = parsePermissionString('people.attach.sales');
  assert.equal(parsed.module, 'people');
  assert.equal(parsed.action, 'create');
  assert.equal(parsed.appKey, 'SALES');
});

test('resolveStringPermission enforces org-disabled app on people.attach.sales', () => {
  const role = {
    name: 'User',
    permissions: {
      contacts: { read: true, create: true, update: true, delete: false }
    }
  };

  const orgContext = buildOrgPermissionContext({
    enabledApps: [{ appKey: 'HELPDESK', status: 'ACTIVE' }],
    moduleOverrides: { people: { HELPDESK: true } }
  });

  const user = {
    allowedApps: ['SALES'],
    appAccess: [{ appKey: 'SALES', status: 'ACTIVE', roleKey: 'USER' }],
    permissions: projectRoleToUserPermissions(role, []),
    _permissionRuntime: {
      envelope: projectRoleToUserPermissions(role, []),
      modulesByApp: buildModulesByAppFromRole(role),
      flat: {}
    },
    _orgPermissionContext: orgContext
  };

  assert.equal(
    resolveStringPermission(user, 'people.attach.sales', { orgContext }),
    false
  );
});

test('resolveStringPermission allows people.attach.sales when org, role, and seat grant', () => {
  const role = {
    name: 'User',
    permissions: {
      contacts: { read: true, create: true, update: false, delete: false }
    }
  };

  const orgContext = buildOrgPermissionContext({
    enabledApps: [{ appKey: 'SALES', status: 'ACTIVE' }],
    moduleOverrides: {}
  });

  const user = {
    allowedApps: ['SALES'],
    appAccess: [{ appKey: 'SALES', status: 'ACTIVE', roleKey: 'USER' }],
    permissions: projectRoleToUserPermissions(role, []),
    _permissionRuntime: {
      envelope: projectRoleToUserPermissions(role, []),
      modulesByApp: buildModulesByAppFromRole(role),
      flat: {}
    },
    _orgPermissionContext: orgContext
  };

  assert.equal(
    resolveStringPermission(user, 'people.attach.sales', { orgContext }),
    true
  );
});

test('resolveStringPermission maps people.participation.edit to contacts edit', () => {
  const role = {
    name: 'User',
    permissions: {
      contacts: { read: true, create: false, update: true, delete: false }
    }
  };

  const orgContext = buildOrgPermissionContext({
    enabledApps: [{ appKey: 'SALES', status: 'ACTIVE' }],
    moduleOverrides: {}
  });

  const user = {
    permissions: projectRoleToUserPermissions(role, []),
    _permissionRuntime: {
      envelope: projectRoleToUserPermissions(role, []),
      modulesByApp: buildModulesByAppFromRole(role),
      flat: {}
    },
    _orgPermissionContext: orgContext
  };

  assert.equal(
    resolveStringPermission(user, 'people.participation.edit', { orgContext }),
    true
  );
});

test('materializeRuntimePermissionsOnUser attaches runtime + org context', async () => {
  const user = {
    organizationId: '000000000000000000000001',
    appAccess: [],
    permissions: {}
  };

  const roleLean = {
    name: 'Manager',
    permissions: {
      contacts: { read: true, create: true, update: true, delete: false },
      deals: { read: true, create: false, update: false, delete: false }
    },
    appPermissions: {
      HELPDESK: {
        cases: { read: true, create: true, update: false, delete: false }
      }
    }
  };

  await materializeRuntimePermissionsOnUser(user, {
    roleLean,
    organization: {
      enabledApps: [
        { appKey: 'SALES', status: 'ACTIVE' },
        { appKey: 'HELPDESK', status: 'ACTIVE' }
      ],
      moduleOverrides: {}
    }
  });

  assert.ok(user._permissionRuntime);
  assert.ok(user._orgPermissionContext);
  assert.equal(user.permissions.deals.view, true);
  assert.equal(user._permissionRuntime.modulesByApp.HELPDESK.cases.view, true);
});

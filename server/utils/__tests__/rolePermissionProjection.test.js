'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  projectRoleToUserPermissions,
  roleAllowsPlatformOwnedFieldEdits,
  buildCasesEnvelopeFromAppAccess,
  ensurePermissionEnvelopeDefaults,
  sanitizeUserResponsePayload
} = require('../rolePermissionProjection');
const { APP_KEYS } = require('../../constants/appKeys');

test('viewAll true when canViewAllData even if module scope is team', () => {
  const role = {
    name: 'Admin',
    canViewAllData: true,
    permissions: {
      contacts: { read: true, create: true, update: true, delete: true, export: false, import: false, scope: 'team' }
    }
  };
  const p = projectRoleToUserPermissions(role, []);
  assert.equal(p.contacts.viewAll, true);
});

test('viewAll when module scope is all', () => {
  const role = {
    name: 'User',
    canViewAllData: false,
    permissions: {
      contacts: { read: true, create: true, update: true, delete: false, export: false, import: false, scope: 'all' }
    }
  };
  const p = projectRoleToUserPermissions(role, []);
  assert.equal(p.contacts.viewAll, true);
});

test('cases envelope prefers role.permissions.cases over appAccess', () => {
  const role = {
    name: 'Agent',
    canViewAllData: false,
    permissions: {
      cases: { read: true, create: true, update: false, delete: false, scope: 'own' }
    }
  };
  const p = projectRoleToUserPermissions(role, []);
  assert.equal(p.cases.view, true);
  assert.equal(p.cases.create, true);
  assert.equal(p.cases.edit, false);
});

test('HELPDESK cases envelope from appAccess', () => {
  const c = buildCasesEnvelopeFromAppAccess([
    { appKey: APP_KEYS.HELPDESK, roleKey: 'AGENT', status: 'ACTIVE' }
  ]);
  assert.equal(c.view, true);
  assert.equal(c.edit, true);
  assert.equal(c.viewAll, true);
});

test('roleAllowsPlatformOwnedFieldEdits for Owner/Admin only', () => {
  assert.equal(roleAllowsPlatformOwnedFieldEdits({ name: 'Admin' }), true);
  assert.equal(roleAllowsPlatformOwnedFieldEdits({ name: 'Manager' }), false);
});

test('ensurePermissionEnvelopeDefaults fills missing module keys', () => {
  const m = { contacts: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false } };
  ensurePermissionEnvelopeDefaults(m);
  assert.ok(m.deals);
  assert.ok(m.forms);
  assert.ok(m.cases);
});

test('sanitizeUserResponsePayload removes password and internal flags', () => {
  const o = sanitizeUserResponsePayload({
    email: 'x@example.com',
    password: 'secret',
    _roleAllowsPlatformOwnedFieldEdit: true,
    permissions: { contacts: { view: true } }
  });
  assert.equal(o.password, undefined);
  assert.equal(o._roleAllowsPlatformOwnedFieldEdit, undefined);
  assert.equal(o.email, 'x@example.com');
});

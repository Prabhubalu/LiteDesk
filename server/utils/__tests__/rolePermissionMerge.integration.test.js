'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  mergeIncomingRolePermissions,
  normalizeRolePermissions,
  expandRolePermissionsForUI,
  buildActionsFromDefinition,
  PLATFORM_ADMIN_KEYS
} = require('../../services/rolePermissionCatalogService');

test('A: disabling Sales in UI payload does not wipe stored deals permissions on merge', () => {
  const existing = {
    permissions: {
      contacts: { read: true, create: true, update: true, delete: false },
      deals: { read: true, create: true, update: true, delete: true, export: true }
    },
    appPermissions: {}
  };

  const incoming = {
    people: { read: true, create: false, update: false, delete: false },
    organizations: { read: true, create: false, update: false, delete: false }
  };

  const merged = mergeIncomingRolePermissions(existing, incoming);
  assert.equal(merged.permissions.deals.read, true);
  assert.equal(merged.permissions.deals.delete, true);
  assert.equal(merged.permissions.deals.export, true);
});

test('B: re-enabling Sales in UI restores deals row edits via merge', () => {
  const existing = {
    permissions: {
      deals: { read: true, create: false, update: false, delete: false }
    }
  };

  const incoming = {
    deals: { read: true, create: true, update: true, delete: false }
  };

  const merged = mergeIncomingRolePermissions(existing, incoming);
  assert.equal(merged.permissions.deals.create, true);
  assert.equal(merged.permissions.deals.update, true);
});

test('C: legacy role with contacts renders People in UI expansion', () => {
  const expanded = expandRolePermissionsForUI({
    permissions: {
      contacts: { read: true, create: true, update: false, delete: false }
    }
  });
  assert.equal(expanded.people.read, true);
  assert.equal(expanded.people.create, true);
});

test('D: buildActionsFromDefinition tolerates missing/empty module permissions', () => {
  const actions = buildActionsFromDefinition(null, 'custom_module', 'crud');
  assert.ok(actions.includes('read'));
  assert.ok(actions.includes('create'));
});

test('E: unknown action types normalize without throwing', () => {
  const normalized = normalizeRolePermissions({
    people: {
      read: true,
      create: false,
      customAction: true,
      execution: true
    }
  });
  assert.equal(normalized.permissions.contacts.read, true);
  assert.equal(normalized.permissions.contacts.execution, true);
  assert.equal(normalized.permissions.contacts.customAction, undefined);
});

test('appPermissions preserved when UI only sends legacy keys', () => {
  const existing = {
    permissions: { contacts: { read: true } },
    appPermissions: {
      AUDIT: { findings: { read: true, create: true } }
    }
  };

  const incoming = { people: { read: true } };
  const merged = mergeIncomingRolePermissions(existing, incoming);
  assert.equal(merged.appPermissions.AUDIT.findings.create, true);
});

test('platform admin keys always available in catalog builder exports', () => {
  assert.ok(PLATFORM_ADMIN_KEYS.includes('settings'));
  assert.ok(PLATFORM_ADMIN_KEYS.includes('users'));
});

test('D: missing ModuleDefinition still yields safe default actions', () => {
  const actions = buildActionsFromDefinition(undefined, 'removed_module', 'crud');
  assert.ok(actions.includes('read'));
  assert.ok(actions.includes('create'));
  assert.ok(actions.includes('update'));
});

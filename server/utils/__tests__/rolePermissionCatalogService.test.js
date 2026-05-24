'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveCatalogKey,
  buildActionsFromDefinition,
  normalizeHelpdeskCaseModuleKey,
  expandRolePermissionsForUI
} = require('../../services/rolePermissionCatalogService');

test('normalizeHelpdeskCaseModuleKey maps ticket variants to cases', () => {
  assert.equal(normalizeHelpdeskCaseModuleKey('ticket'), 'cases');
  assert.equal(normalizeHelpdeskCaseModuleKey('TICKETS'), 'cases');
  assert.equal(normalizeHelpdeskCaseModuleKey('deals'), 'deals');
});

test('resolveCatalogKey uses flat keys for core and SALES legacy modules', () => {
  assert.equal(resolveCatalogKey(null, 'people'), 'people');
  assert.equal(resolveCatalogKey('SALES', 'deals'), 'deals');
  assert.equal(resolveCatalogKey('HELPDESK', 'ticket'), 'cases');
});

test('resolveCatalogKey uses app prefix for non-legacy app modules', () => {
  assert.equal(resolveCatalogKey('AUDIT', 'findings'), 'AUDIT:findings');
});

test('buildActionsFromDefinition respects module definition flags', () => {
  const actions = buildActionsFromDefinition(
    { view: true, create: true, edit: true, delete: false, execution: true },
    'forms',
    'crud'
  );
  assert.ok(actions.includes('read'));
  assert.ok(actions.includes('create'));
  assert.ok(!actions.includes('delete'));
  assert.ok(actions.includes('execution'));
});

test('expandRolePermissionsForUI mirrors contacts to people and app-scoped keys', () => {
  const expanded = expandRolePermissionsForUI({
    permissions: {
      contacts: { read: true, create: false },
      deals: { read: true }
    },
    appPermissions: {
      AUDIT: {
        findings: { read: true, create: true }
      }
    }
  });
  assert.equal(expanded.people.read, true);
  assert.equal(expanded.deals.read, true);
  assert.equal(expanded['AUDIT:findings'].create, true);
});

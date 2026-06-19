'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveCatalogKey,
  buildActionsFromDefinition,
  normalizeHelpdeskCaseModuleKey,
  expandRolePermissionsForUI,
  mapFieldCatalogEntries,
  resolveFieldCatalogForModule
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

test('mapFieldCatalogEntries excludes system and hidden fields', () => {
  const mapped = mapFieldCatalogEntries([
    { key: 'firstName', label: 'First Name' },
    { key: 'deletedAt', label: 'Deleted At' },
    { key: 'email', label: 'Email', isVisibleInConfig: false }
  ]);
  assert.deepEqual(mapped.map((f) => f.key), ['firstName']);
});

test('resolveFieldCatalogForModule resolves org override before platform', () => {
  const lookup = {
    orgByModuleKey: new Map([
      ['organizations', [{ key: 'name', label: 'Name' }]]
    ]),
    platformByAppModule: new Map(),
    platformByModuleKey: new Map([
      ['organizations', [{ key: 'website', label: 'Website' }]]
    ])
  };
  const catalog = resolveFieldCatalogForModule(
    { moduleKey: 'organizations', scope: 'core', participatingApps: ['SALES'] },
    lookup,
    ['SALES']
  );
  assert.deepEqual(catalog.map((f) => f.key), ['name']);
});

test('resolveFieldCatalogForModule skips platform administration modules', () => {
  const lookup = {
    orgByModuleKey: new Map(),
    platformByAppModule: new Map([['platform:reports', [{ key: 'title', label: 'Title' }]]]),
    platformByModuleKey: new Map()
  };
  const catalog = resolveFieldCatalogForModule(
    { moduleKey: 'reports', scope: 'platform' },
    lookup,
    ['SALES']
  );
  assert.equal(catalog.length, 0);
});

test('resolveFieldCatalogForModule falls back to schema fields for items forms quotes', () => {
  const lookup = {
    orgByModuleKey: new Map(),
    platformByAppModule: new Map(),
    platformByModuleKey: new Map()
  };
  for (const moduleKey of ['items', 'forms', 'quotes']) {
    const catalog = resolveFieldCatalogForModule(
      { moduleKey, scope: 'core', participatingApps: ['SALES'] },
      lookup,
      ['SALES']
    );
    assert.ok(catalog.length > 0, `expected field catalog for ${moduleKey}`);
  }
});

test('resolveFieldCatalogForModule falls back for audit and helpdesk app modules', () => {
  const lookup = {
    orgByModuleKey: new Map(),
    platformByAppModule: new Map(),
    platformByModuleKey: new Map()
  };
  const auditsCatalog = resolveFieldCatalogForModule(
    { moduleKey: 'audits', scope: 'app', appKey: 'AUDIT' },
    lookup,
    ['AUDIT']
  );
  assert.ok(auditsCatalog.length > 0, 'expected field catalog for audit audits module');

  const responsesCatalog = resolveFieldCatalogForModule(
    { moduleKey: 'responses', scope: 'app', appKey: 'AUDIT' },
    lookup,
    ['AUDIT']
  );
  assert.ok(responsesCatalog.length > 0, 'expected field catalog for audit responses module');

  const casesCatalog = resolveFieldCatalogForModule(
    { moduleKey: 'cases', scope: 'app', appKey: 'HELPDESK' },
    lookup,
    ['HELPDESK']
  );
  assert.ok(casesCatalog.length > 0, 'expected field catalog for helpdesk cases module');

  const scheduleCatalog = resolveFieldCatalogForModule(
    { moduleKey: 'schedule', scope: 'app', appKey: 'AUDIT' },
    lookup,
    ['AUDIT']
  );
  assert.equal(scheduleCatalog.length, 0, 'schedule is a workflow surface without field catalog');
});

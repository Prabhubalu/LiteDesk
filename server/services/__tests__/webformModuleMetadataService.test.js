'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  resolveModuleAppKey,
  moduleScope,
  APP_DEFAULT_MODULES,
  PLATFORM_MODULE_ORDER
} = require('../webformModuleMetadataService');

describe('webformModuleMetadataService.resolveModuleAppKey', () => {
  it('maps platform core modules to PLATFORM', () => {
    assert.strictEqual(resolveModuleAppKey('people'), 'PLATFORM');
    assert.strictEqual(resolveModuleAppKey('organizations'), 'PLATFORM');
    assert.strictEqual(resolveModuleAppKey('tasks'), 'PLATFORM');
    assert.strictEqual(resolveModuleAppKey('quotes'), 'PLATFORM');
  });

  it('maps app-native modules', () => {
    assert.strictEqual(resolveModuleAppKey('deals'), 'SALES');
    assert.strictEqual(resolveModuleAppKey('cases'), 'HELPDESK');
    assert.strictEqual(resolveModuleAppKey('projects'), 'PROJECTS');
    assert.strictEqual(resolveModuleAppKey('audits'), 'AUDIT');
  });

  it('falls back to provided app key', () => {
    assert.strictEqual(resolveModuleAppKey('custom_module', 'AUDIT'), 'AUDIT');
  });
});

describe('webformModuleMetadataService.moduleScope', () => {
  it('classifies platform core modules as platform scope', () => {
    assert.strictEqual(moduleScope('people', 'PLATFORM'), 'platform');
    assert.strictEqual(moduleScope('organizations', 'PLATFORM'), 'platform');
    assert.strictEqual(moduleScope('tasks', 'PLATFORM'), 'platform');
    assert.strictEqual(moduleScope('quotes', 'PLATFORM'), 'platform');
  });

  it('classifies app-native modules as app scope', () => {
    assert.strictEqual(moduleScope('deals', 'SALES'), 'app');
    assert.strictEqual(moduleScope('cases', 'HELPDESK'), 'app');
    assert.strictEqual(moduleScope('projects', 'PROJECTS'), 'app');
  });
});

describe('webformModuleMetadataService.APP_DEFAULT_MODULES', () => {
  it('lists only app-native sales defaults', () => {
    assert.deepStrictEqual(APP_DEFAULT_MODULES.SALES, ['deals']);
  });

  it('includes audit defaults', () => {
    assert.deepStrictEqual(APP_DEFAULT_MODULES.AUDIT, ['audits', 'findings']);
  });
});

describe('webformModuleMetadataService.PLATFORM_MODULE_ORDER', () => {
  it('starts with people and organizations', () => {
    assert.strictEqual(PLATFORM_MODULE_ORDER[0], 'people');
    assert.strictEqual(PLATFORM_MODULE_ORDER[1], 'organizations');
  });
});

describe('webformModuleMetadataService.serializeModuleFieldsForWebformClient', () => {
  const { serializeModuleFieldsForWebformClient } = require('../webformModuleMetadataService');

  it('returns form fields plus dependency controller fields', () => {
    const moduleFields = [
      {
        key: 'status',
        label: 'Status',
        dataType: 'Picklist',
        dependencies: [{
          type: 'visibility',
          fieldKey: 'sales_type',
          operator: 'equals',
          value: 'Lead'
        }],
        options: ['Open']
      },
      {
        key: 'sales_type',
        label: 'Type',
        dataType: 'Picklist',
        dependencies: [],
        options: ['Lead', 'Contact']
      },
      { key: 'priority', label: 'Priority', dependencies: [] }
    ];
    const webformFields = [{ crmFieldKey: 'status' }];
    const out = serializeModuleFieldsForWebformClient(moduleFields, webformFields);
    assert.strictEqual(out.length, 2);
    assert.deepStrictEqual(out.map((field) => field.key).sort(), ['sales_type', 'status']);
  });

  it('includes lookup relationship controllers referenced by dependencies', () => {
    const moduleFields = [
      {
        key: 'deal_stage',
        label: 'Stage',
        dataType: 'Picklist',
        dependencies: [{
          type: 'visibility',
          fieldKey: 'organization',
          operator: 'exists'
        }]
      },
      {
        key: 'organization',
        label: 'Organization',
        dataType: 'Lookup (Relationship)',
        lookupSettings: { targetModule: 'organizations' },
        dependencies: []
      }
    ];
    const webformFields = [{ crmFieldKey: 'deal_stage' }];
    const out = serializeModuleFieldsForWebformClient(moduleFields, webformFields);
    const organization = out.find((field) => field.key === 'organization');
    assert.ok(organization);
    assert.strictEqual(organization.dataType, 'Lookup (Relationship)');
    assert.deepStrictEqual(organization.lookupSettings, { targetModule: 'organizations' });
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { mergeSavedModuleFieldsWithBase } = require('../webformModuleFieldsService');

describe('webformModuleFieldsService.mergeSavedModuleFieldsWithBase', () => {
  it('falls back to base dependencies when saved field has empty dependencies array', () => {
    const baseFields = [
      {
        key: 'status',
        label: 'Status',
        dataType: 'Picklist',
        dependencies: [{
          type: 'visibility',
          fieldKey: 'type',
          operator: 'equals',
          value: 'Lead'
        }]
      },
      {
        key: 'type',
        label: 'Type',
        dataType: 'Picklist',
        dependencies: []
      }
    ];

    const savedFields = [
      { key: 'status', label: 'Status', dataType: 'Picklist', dependencies: [] },
      { key: 'type', label: 'Type', dataType: 'Picklist', dependencies: [] }
    ];

    const merged = mergeSavedModuleFieldsWithBase('deals', baseFields, savedFields);
    const status = merged.find((field) => field.key === 'status');
    assert.ok(status);
    assert.strictEqual(status.dependencies.length, 1);
    assert.strictEqual(status.dependencies[0].fieldKey, 'type');
  });

  it('appends base lookup relationship fields missing from saved config', () => {
    const baseFields = [
      {
        key: 'first_name',
        label: 'First Name',
        dataType: 'Text'
      },
      {
        key: 'organization',
        label: 'Organization',
        dataType: 'Lookup (Relationship)',
        lookupSettings: { targetModule: 'organizations' }
      }
    ];
    const savedFields = [
      { key: 'first_name', label: 'First Name', dataType: 'Text' }
    ];

    const merged = mergeSavedModuleFieldsWithBase('people', baseFields, savedFields);
    const organization = merged.find((field) => field.key === 'organization');
    assert.ok(organization);
    assert.strictEqual(organization.dataType, 'Lookup (Relationship)');
    assert.deepStrictEqual(organization.lookupSettings, { targetModule: 'organizations' });
  });
});

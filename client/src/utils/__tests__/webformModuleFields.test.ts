import { describe, expect, it } from 'vitest';
import {
  buildWebformDependencyContextFields,
  collectDependencyControllerKeys
} from '@/utils/webformModuleFields';
import { serializeModuleFieldsForWebformFill } from '@/utils/webformFormActions';

describe('collectDependencyControllerKeys', () => {
  it('expands transitive controller keys', () => {
    const moduleFields = [
      {
        key: 'status',
        dependencies: [{ fieldKey: 'sales_type', operator: 'equals', value: 'Lead' }]
      },
      { key: 'sales_type', dependencies: [] },
      { key: 'priority', dependencies: [] }
    ];
    const keys = collectDependencyControllerKeys(moduleFields, ['status']);
    expect([...keys].sort()).toEqual(['sales_type', 'status']);
  });
});

describe('buildWebformDependencyContextFields', () => {
  it('includes lookup relationship controllers not on the webform canvas', () => {
    const moduleFields = [
      {
        key: 'lead_status',
        label: 'Lead Status',
        dataType: 'Picklist',
        dependencies: [{
          type: 'visibility',
          fieldKey: 'organization',
          operator: 'exists'
        }],
        options: ['New', 'Qualified']
      },
      {
        key: 'organization',
        label: 'Organization',
        dataType: 'Lookup (Relationship)',
        lookupSettings: { targetModule: 'organizations' },
        dependencies: []
      }
    ];
    const webformFields = [{ fieldId: 'f1', crmFieldKey: 'lead_status', type: 'Picklist' }];
    const context = buildWebformDependencyContextFields(webformFields, moduleFields);
    expect(context.map((field) => field.key).sort()).toEqual(['lead_status', 'organization']);
    expect(context.find((field) => field.key === 'organization')?.lookupSettings).toEqual({
      targetModule: 'organizations'
    });
  });
});

describe('serializeModuleFieldsForWebformFill', () => {
  it('includes dependency controllers with lookup metadata', () => {
    const moduleFields = [
      {
        key: 'status',
        dataType: 'Picklist',
        dependencies: [{ fieldKey: 'organization', operator: 'exists' }],
        options: ['Open']
      },
      {
        key: 'organization',
        dataType: 'Lookup (Relationship)',
        lookupSettings: { targetModule: 'organizations' },
        dependencies: []
      }
    ];
    const webformFields = [{ crmFieldKey: 'status' }];
    const serialized = serializeModuleFieldsForWebformFill(moduleFields, webformFields);
    expect(serialized.map((field) => field.key).sort()).toEqual(['organization', 'status']);
    expect(serialized.find((field) => field.key === 'organization')?.lookupSettings).toEqual({
      targetModule: 'organizations'
    });
  });
});

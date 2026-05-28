/**
 * fieldMerge contract tests.
 * Tests merge invariants: infrastructure, audit, computed, custom fields, duplicate protection.
 */

import { describe, it, expect } from 'vitest';
import type { BaseFieldMetadata } from '../../platform/fields/BaseFieldModel';
import {
  mergeFields,
  filterToVisibleInConfig,
  getFallbackMetadataForVisibleInConfig,
  normalizeModuleFieldsFromMetadata
} from '../../platform/fields/fieldMerge';
import { TASK_FIELD_METADATA } from '../../platform/fields/taskFieldModel';
import { ITEM_FIELD_METADATA } from '../../platform/fields/itemFieldModel';
import { getFieldMetadataFromRegistry } from '../../platform/fields/FieldRegistry';

function meta(overrides: Partial<BaseFieldMetadata> = {}): BaseFieldMetadata {
  const base: BaseFieldMetadata = {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
  };
  return { ...base, ...overrides };
}

const getTaskMetadata = (fieldKey: string) => getFieldMetadataFromRegistry('tasks', fieldKey);

describe('fieldMerge', () => {
  describe('A. Infrastructure Fields (_id)', () => {
    it('_id must NOT appear if isVisibleInConfig: false', () => {
      const backendFields = [{ key: '_id', label: 'ID', dataType: 'Text' }];
      const metadata: Record<string, BaseFieldMetadata> = { _id: meta({ owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isVisibleInConfig: false }) };
      const result = mergeFields(metadata, backendFields, {
        moduleKey: 'tasks',
        getMetadata: (k) => metadata[k] ?? getTaskMetadata(k),
      });
      const keys = result.map((f) => f.key.toLowerCase());
      expect(keys).not.toContain('_id');
    });

    it('infrastructure fields must never duplicate', () => {
      const backendFields = [
        { key: '_id', label: 'ID' },
        { key: '_id', label: 'ID' },
      ];
      const metadata: Record<string, BaseFieldMetadata> = { _id: meta({ owner: 'system', isVisibleInConfig: false }) };
      const result = mergeFields(metadata, backendFields, {
        moduleKey: 'tasks',
        getMetadata: (k) => metadata[k],
      });
      const idCount = result.filter((f) => f.key.toLowerCase() === '_id').length;
      expect(idCount).toBe(0); // filtered out by visibility
    });

    it('infrastructure fields must never become editable', () => {
      const backendFields = [{ key: '_id', label: 'ID', editable: true }];
      const metadata: Record<string, BaseFieldMetadata> = { _id: meta({ owner: 'system', editable: false, isVisibleInConfig: false }) };
      const result = mergeFields(metadata, backendFields, {
        moduleKey: 'tasks',
        getMetadata: (k) => metadata[k],
      });
      expect(result.find((f) => f.key.toLowerCase() === '_id')).toBeUndefined();
    });
  });

  describe('B. Audit Fields (createdAt)', () => {
    it('createdAt must be injected if missing in backend', () => {
      const backendFields = [{ key: 'title', label: 'Title', dataType: 'Text' }];
      const result = mergeFields(TASK_FIELD_METADATA as Record<string, BaseFieldMetadata>, backendFields, {
        moduleKey: 'tasks',
        getMetadata: (k) => getTaskMetadata(k),
      });
      const keys = result.map((f) => f.key.toLowerCase());
      expect(keys).toContain('createdat');
    });

    it('createdAt must be visible', () => {
      const backendFields = [
        { key: 'title', label: 'Title' },
        { key: 'createdAt', label: 'Created At', dataType: 'Date-Time' },
      ];
      const result = mergeFields(TASK_FIELD_METADATA as Record<string, BaseFieldMetadata>, backendFields, {
        moduleKey: 'tasks',
        getMetadata: (k) => getTaskMetadata(k),
      });
      const createdAt = result.find((f) => f.key.toLowerCase() === 'createdat');
      expect(createdAt).toBeDefined();
    });

    it('createdAt must be non-editable', () => {
      const backendFields = [{ key: 'createdAt', label: 'Created At', editable: true }];
      const result = mergeFields(TASK_FIELD_METADATA as Record<string, BaseFieldMetadata>, backendFields, {
        moduleKey: 'tasks',
        getMetadata: (k) => getTaskMetadata(k),
      });
      const createdAt = result.find((f) => f.key.toLowerCase() === 'createdat');
      expect(createdAt?.editable).toBe(false);
    });
  });

  describe('C. Computed Fields (derivedStatus)', () => {
    it('derivedStatus must be visible if metadata says so', () => {
      const backendFields = [{ key: 'name', label: 'Name' }];
      const dealMeta = getFieldMetadataFromRegistry('deal', 'derivedStatus');
      expect(dealMeta?.isVisibleInConfig).toBe(true);
      const metadata: Record<string, BaseFieldMetadata> = {
        derivedStatus: meta({ owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isComputed: true, isVisibleInConfig: true }),
      };
      const result = mergeFields(metadata, backendFields, {
        moduleKey: 'deal',
        getMetadata: (k) => metadata[k] ?? getFieldMetadataFromRegistry('deal', k),
      });
      const keys = result.map((f) => f.key.toLowerCase());
      expect(keys).toContain('derivedstatus');
    });

    it('computed fields must be non-editable', () => {
      const metadata: Record<string, BaseFieldMetadata> = {
        derivedStatus: meta({ owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isComputed: true, isVisibleInConfig: true }),
      };
      const backendFields = [{ key: 'derivedStatus', label: 'Derived Status', editable: true }];
      const result = mergeFields(metadata, backendFields, {
        moduleKey: 'deal',
        getMetadata: (k) => metadata[k],
      });
      const field = result.find((f) => f.key.toLowerCase() === 'derivedstatus');
      expect(field?.editable).toBe(false);
    });

    it('computed fields must not duplicate', () => {
      const metadata: Record<string, BaseFieldMetadata> = {
        derivedStatus: meta({ owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isComputed: true, isVisibleInConfig: true }),
      };
      const backendFields = [
        { key: 'derivedStatus', label: 'Derived Status' },
        { key: 'derivedstatus', label: 'Derived Status' },
      ];
      const result = mergeFields(metadata, backendFields, {
        moduleKey: 'deal',
        getMetadata: (k) => metadata[k],
      });
      const count = result.filter((f) => f.key.toLowerCase() === 'derivedstatus').length;
      expect(count).toBe(1);
    });
  });

  describe('D. Custom Fields', () => {
    it('custom fields must remain editable', () => {
      const backendFields = [
        { key: 'title', label: 'Title' },
        { key: 'custom_field_1', label: 'Custom Field', dataType: 'Text', editable: true },
      ];
      const getMetadata = (k: string) => (k === 'custom_field_1' ? undefined : getTaskMetadata(k));
      const result = mergeFields(TASK_FIELD_METADATA as Record<string, BaseFieldMetadata>, backendFields, {
        moduleKey: 'tasks',
        getMetadata,
      });
      const custom = result.find((f) => f.key === 'custom_field_1');
      expect(custom).toBeDefined();
      expect(custom?.editable).toBe(true);
    });

    it('custom fields must not be overridden by metadata', () => {
      const backendFields = [{ key: 'custom_xyz', label: 'My Custom', order: 5 }];
      const result = mergeFields(TASK_FIELD_METADATA as Record<string, BaseFieldMetadata>, backendFields, {
        moduleKey: 'tasks',
        getMetadata: () => undefined,
      });
      const custom = result.find((f) => f.key === 'custom_xyz');
      expect(custom).toBeDefined();
      expect(custom?.label).toBe('My Custom');
      expect(custom?.order).toBe(5);
    });

    it('custom fields must persist through merge', () => {
      const backendFields = [
        { key: 'title', label: 'Title' },
        { key: 'custom_persist', label: 'Persist', visibility: { list: true, detail: true } },
      ];
      const result = mergeFields(TASK_FIELD_METADATA as Record<string, BaseFieldMetadata>, backendFields, {
        moduleKey: 'tasks',
        getMetadata: (k) => getTaskMetadata(k),
      });
      const custom = result.find((f) => f.key === 'custom_persist');
      expect(custom).toBeDefined();
      expect(custom?.visibility?.list).toBe(true);
    });
  });

  describe('E. Duplicate Protection', () => {
    it('if backend already contains createdAt, merge must NOT create a second one', () => {
      const backendFields = [
        { key: 'title', label: 'Title' },
        { key: 'createdAt', label: 'Created At', dataType: 'Date-Time' },
      ];
      const result = mergeFields(TASK_FIELD_METADATA as Record<string, BaseFieldMetadata>, backendFields, {
        moduleKey: 'tasks',
        getMetadata: (k) => getTaskMetadata(k),
      });
      const createdAtCount = result.filter((f) => f.key.toLowerCase() === 'createdat').length;
      expect(createdAtCount).toBe(1);
    });

    it('case-insensitive deduplication', () => {
      const backendFields = [
        { key: 'createdAt', label: 'Created At' },
        { key: 'createdat', label: 'Created At' },
      ];
      const result = mergeFields(TASK_FIELD_METADATA as Record<string, BaseFieldMetadata>, backendFields, {
        moduleKey: 'tasks',
        getMetadata: (k) => getTaskMetadata(k),
      });
      const createdAtCount = result.filter((f) => f.key.toLowerCase() === 'createdat').length;
      expect(createdAtCount).toBe(1);
    });
  });

  describe('normalizeModuleFieldsFromMetadata', () => {
    it('merges item metadata when backend only has system fields', () => {
      const backendFields = [{ key: 'item_id', label: 'Item ID', dataType: 'Text' }];
      const result = normalizeModuleFieldsFromMetadata('items', backendFields);
      const keys = result.map((f) => f.key.toLowerCase());
      expect(keys).toContain('item_name');
      expect(keys).toContain('item_type');
    });
  });

  describe('Items module sparse backend', () => {
    it('injects core and participation fields when backend only has system fields', () => {
      const backendFields = [
        { key: 'item_id', label: 'Item ID', dataType: 'Text' },
        { key: 'createdBy', label: 'Created By', dataType: 'Lookup (Relationship)' },
        { key: 'createdAt', label: 'Created At', dataType: 'Date-Time' },
        { key: 'modifiedBy', label: 'Modified By', dataType: 'Lookup (Relationship)' },
        { key: 'updatedAt', label: 'Updated At', dataType: 'Date-Time' },
      ];
      const getItemMetadata = (fieldKey: string) => getFieldMetadataFromRegistry('items', fieldKey);
      const result = mergeFields(ITEM_FIELD_METADATA as Record<string, BaseFieldMetadata>, backendFields, {
        moduleKey: 'items',
        getMetadata: getItemMetadata,
      });
      const keys = result.map((f) => f.key.toLowerCase());
      expect(keys).toContain('item_name');
      expect(keys).toContain('item_code');
      expect(keys).toContain('item_type');
      expect(keys).toContain('lifecycle_state');
      expect(keys).toContain('selling_price');
    });
  });

  describe('filterToVisibleInConfig', () => {
    it('filters out infrastructure fields', () => {
      const fields = [
        { key: '_id', label: 'ID' },
        { key: 'title', label: 'Title' },
      ];
      const filtered = filterToVisibleInConfig(fields, (k) => getTaskMetadata(k));
      const keys = filtered.map((f) => f.key);
      expect(keys).not.toContain('_id');
      expect(keys).toContain('title');
    });
  });

  describe('getFallbackMetadataForVisibleInConfig', () => {
    it('returns isVisibleInConfig: false for _id', () => {
      const meta = getFallbackMetadataForVisibleInConfig('_id');
      expect(meta?.isVisibleInConfig).toBe(false);
    });

    it('returns undefined for unknown non-infra keys', () => {
      expect(getFallbackMetadataForVisibleInConfig('customField')).toBeUndefined();
    });
  });
});

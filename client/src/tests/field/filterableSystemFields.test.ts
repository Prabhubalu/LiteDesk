import { describe, expect, it } from 'vitest';
import {
  buildFilterFieldsFromModuleFields,
  isFieldEligibleForModuleFilter,
} from '@/utils/buildListColumnsFromModuleFields';

describe('filterable audit system fields', () => {
  it('rejects non-allowlisted system fields from the filter picker', () => {
    expect(
      isFieldEligibleForModuleFilter('tasks', { key: 'organizationId', isSystem: true })
    ).toBe(false);
  });

  it('allows allowlisted audit keys when config-visible', () => {
    expect(isFieldEligibleForModuleFilter('tasks', { key: 'createdAt', isSystem: true })).toBe(
      true
    );
    expect(isFieldEligibleForModuleFilter('tasks', { key: 'updatedAt', isSystem: true })).toBe(
      true
    );
    expect(isFieldEligibleForModuleFilter('tasks', { key: 'createdBy', isSystem: true })).toBe(
      true
    );
  });

  it('merges Created/Modified/Created By into the filter catalog when omitted from API fields', () => {
    const fields = buildFilterFieldsFromModuleFields(
      [{ key: 'status', dataType: 'Picklist', order: 1 }],
      'tasks'
    );
    const keys = fields.map((f) => f.key);
    expect(keys).toContain('createdAt');
    expect(keys).toContain('updatedAt');
    expect(keys).toContain('createdBy');

    const createdAt = fields.find((f) => f.key === 'createdAt');
    expect(createdAt?.filterType).toBe('date');
    expect(createdAt?.dataType).toBe('datetime');

    const createdBy = fields.find((f) => f.key === 'createdBy');
    expect(createdBy?.filterType).toBe('user');
    expect(createdBy?.dataType).toBe('user');
  });

  it('uses event createdTime/modifiedTime aliases', () => {
    const fields = buildFilterFieldsFromModuleFields(
      [{ key: 'status', dataType: 'Picklist', order: 1 }],
      'events'
    );
    const keys = fields.map((f) => f.key);
    expect(keys).toContain('createdTime');
    expect(keys).toContain('modifiedTime');
    expect(keys).toContain('createdBy');
    expect(keys).not.toContain('createdAt');
  });
});

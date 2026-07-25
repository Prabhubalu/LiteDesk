import { describe, expect, it } from 'vitest';
import {
  inferFilterTypeFromColumn,
  resolveColumnFilterConfig,
} from '@/platform/filters/columnFilterResolver';

describe('columnFilterResolver picklist multi-select', () => {
  it('infers picklist keys as multi-select', () => {
    expect(inferFilterTypeFromColumn({ key: 'status' })).toBe('multi-select');
    expect(inferFilterTypeFromColumn({ key: 'stage' })).toBe('multi-select');
    expect(inferFilterTypeFromColumn({ key: 'priority' })).toBe('multi-select');
    expect(inferFilterTypeFromColumn({ key: 'taskType' })).toBe('multi-select');
  });

  it('infers picklist metadata types as multi-select', () => {
    expect(
      inferFilterTypeFromColumn({ key: 'custom_field', dataType: 'picklist' })
    ).toBe('multi-select');
    expect(
      inferFilterTypeFromColumn({ key: 'custom_field', dataType: 'select' })
    ).toBe('multi-select');
  });

  it('upgrades explicit field-model select to multi-select for column filters', () => {
    const config = resolveColumnFilterConfig({
      key: 'status',
      label: 'Status',
      filterType: 'select',
      options: [
        { value: 'Open', label: 'Open' },
        { value: 'Won', label: 'Won' },
      ],
    });
    expect(config.filterType).toBe('multi-select');
    expect(config.options).toHaveLength(2);
  });

  it('keeps document folder filters as single select', () => {
    expect(
      resolveColumnFilterConfig({ key: 'folderId', filterType: 'select' }).filterType
    ).toBe('select');
    expect(
      resolveColumnFilterConfig({ key: 'folderName', filterType: 'select' }).filterType
    ).toBe('select');
  });

  it('does not alter user or date filters', () => {
    expect(resolveColumnFilterConfig({ key: 'assignedTo' }).filterType).toBe('user');
    expect(resolveColumnFilterConfig({ key: 'dueDate' }).filterType).toBe('date');
  });
});

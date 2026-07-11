import { describe, expect, it } from 'vitest';
import { normalizeFilterSelectOptions } from '@/utils/picklistOptionUtils';

describe('normalizeFilterSelectOptions', () => {
  it('converts string picklist values to filter options', () => {
    expect(normalizeFilterSelectOptions(['Technology', 'Healthcare'])).toEqual([
      { value: 'Technology', label: 'Technology' },
      { value: 'Healthcare', label: 'Healthcare' },
    ]);
  });

  it('drops disabled options and preserves labels', () => {
    expect(
      normalizeFilterSelectOptions([
        { value: 'finance', label: 'Finance', enabled: true },
        { value: 'retail', label: 'Retail', enabled: false },
      ])
    ).toEqual([{ value: 'finance', label: 'Finance' }]);
  });
});

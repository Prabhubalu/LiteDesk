import { describe, expect, it } from 'vitest';
import {
  filterVisibleWebformFields,
  isWebformFieldVisible,
  sanitizeFieldVisibility
} from '@/utils/webformConditionalLogic';

const fields = [
  { fieldId: 'country', label: 'Country', type: 'Picklist', options: ['US', 'CA'] },
  { fieldId: 'state', label: 'State', type: 'Text' },
  { fieldId: 'subscribe', label: 'Subscribe', type: 'Checkbox' }
];

describe('webformConditionalLogic', () => {
  it('shows field when visibility is disabled', () => {
    expect(isWebformFieldVisible(fields[1], fields, { country: 'US' })).toBe(true);
  });

  it('evaluates all-match visibility', () => {
    const field = {
      ...fields[1],
      visibility: sanitizeFieldVisibility({
        enabled: true,
        match: 'all',
        conditions: [{ fieldId: 'country', operator: 'equals', value: 'US' }]
      })
    };
    expect(isWebformFieldVisible(field, [...fields, field], { country: 'US' })).toBe(true);
    expect(isWebformFieldVisible(field, [...fields, field], { country: 'CA' })).toBe(false);
  });

  it('evaluates any-match visibility', () => {
    const field = {
      ...fields[1],
      visibility: sanitizeFieldVisibility({
        enabled: true,
        match: 'any',
        conditions: [
          { fieldId: 'country', operator: 'equals', value: 'US' },
          { fieldId: 'subscribe', operator: 'is_checked', value: '' }
        ]
      })
    };
    const all = [...fields, field];
    expect(isWebformFieldVisible(field, all, { country: 'CA', subscribe: true })).toBe(true);
    expect(isWebformFieldVisible(field, all, { country: 'CA', subscribe: false })).toBe(false);
  });

  it('filters visible fields for render', () => {
    const state = {
      ...fields[1],
      visibility: sanitizeFieldVisibility({
        enabled: true,
        match: 'all',
        conditions: [{ fieldId: 'country', operator: 'equals', value: 'US' }]
      })
    };
    const all = [fields[0], state, fields[2]];
    expect(filterVisibleWebformFields(all, { country: 'US' }).map((f) => f.fieldId)).toEqual([
      'country',
      'state',
      'subscribe'
    ]);
    expect(filterVisibleWebformFields(all, { country: 'CA' }).map((f) => f.fieldId)).toEqual([
      'country',
      'subscribe'
    ]);
  });
});

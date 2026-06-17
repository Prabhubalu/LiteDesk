import { describe, expect, it } from 'vitest';
import {
  applyWebformPrefillFromQuery,
  coerceWebformPrefillValue,
  resolveWebformFieldForPrefillKey,
  buildWebformFieldPrefillIndex
} from '@/utils/webformPrefill';

const fields = [
  { fieldId: 'field_email', label: 'Email', type: 'Email', crmFieldKey: 'email' },
  { fieldId: 'field_name', label: 'Full Name', type: 'Text', crmFieldKey: '' },
  { fieldId: 'field_tags', label: 'Tags', type: 'Multi-Picklist', crmFieldKey: 'tags' },
  { fieldId: 'field_optin', label: 'Subscribe', type: 'Checkbox', crmFieldKey: '' }
];

describe('webformPrefill', () => {
  it('matches crmFieldKey, fieldId, and field_ prefix', () => {
    const index = buildWebformFieldPrefillIndex(fields);
    expect(resolveWebformFieldForPrefillKey('email', index)?.fieldId).toBe('field_email');
    expect(resolveWebformFieldForPrefillKey('field_name', index)?.fieldId).toBe('field_name');
    expect(resolveWebformFieldForPrefillKey('field_field_name', index)?.fieldId).toBe('field_name');
    expect(resolveWebformFieldForPrefillKey('full-name', index)?.fieldId).toBe('field_name');
  });

  it('coerces checkbox and multi-picklist values', () => {
    expect(coerceWebformPrefillValue(fields[3], 'true')).toBe(true);
    expect(coerceWebformPrefillValue(fields[3], 'no')).toBe(false);
    expect(coerceWebformPrefillValue(fields[2], 'a, b')).toEqual(['a', 'b']);
  });

  it('applies query values onto form data', () => {
    const base = {
      field_email: '',
      field_name: '',
      field_tags: [] as string[],
      field_optin: false
    };
    const result = applyWebformPrefillFromQuery(fields, base, {
      email: 'user@example.com',
      'full-name': 'Ada Lovelace',
      tags: 'vip, newsletter',
      field_optin: 'yes',
      webformId: 'ignored'
    });
    expect(result.field_email).toBe('user@example.com');
    expect(result.field_name).toBe('Ada Lovelace');
    expect(result.field_tags).toEqual(['vip', 'newsletter']);
    expect(result.field_optin).toBe(true);
    expect(result.webformId).toBeUndefined();
  });
});

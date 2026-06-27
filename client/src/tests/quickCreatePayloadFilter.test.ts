import { describe, expect, it } from 'vitest';
import {
  getQuickCreateAllowedFieldKeys,
  shouldFilterPayloadByQuickCreate
} from '@/utils/quickCreatePayloadFilter';

describe('getQuickCreateAllowedFieldKeys', () => {
  it('includes quickCreate keys and required module fields', () => {
    const allowed = getQuickCreateAllowedFieldKeys(
      ['name', 'amount'],
      [
        { key: 'name', required: true },
        { key: 'status', required: true },
        { key: 'description', required: false }
      ]
    );
    expect(allowed.has('name')).toBe(true);
    expect(allowed.has('amount')).toBe(true);
    expect(allowed.has('status')).toBe(true);
    expect(allowed.has('description')).toBe(false);
  });

  it('returns required fields when quickCreate is empty', () => {
    const allowed = getQuickCreateAllowedFieldKeys([], [{ key: 'status', required: true }]);
    expect(allowed.has('status')).toBe(true);
    expect(allowed.size).toBe(1);
  });
});

describe('shouldFilterPayloadByQuickCreate', () => {
  it('filters in quick create mode when drawer is not in full mode', () => {
    expect(shouldFilterPayloadByQuickCreate(true, false, ['title', 'status'])).toBe(true);
  });

  it('does not filter in full mode even when quick create is enabled', () => {
    expect(shouldFilterPayloadByQuickCreate(true, true, ['title', 'description'])).toBe(false);
  });

  it('does not filter when quick create mode is disabled', () => {
    expect(shouldFilterPayloadByQuickCreate(false, false, ['title'])).toBe(false);
  });

  it('does not filter when quick create config is empty or invalid', () => {
    expect(shouldFilterPayloadByQuickCreate(true, false, [])).toBe(false);
    expect(shouldFilterPayloadByQuickCreate(true, false, null)).toBe(false);
    expect(shouldFilterPayloadByQuickCreate(true, false, undefined)).toBe(false);
  });
});


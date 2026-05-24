import { describe, expect, it } from 'vitest';
import { flattenCatalog, validateKeyNaming } from '../catalog';

describe('flattenCatalog', () => {
  it('flattens metadata entries with namespace prefix', () => {
    const { messages } = flattenCatalog(
      {
        save: { message: 'Save', description: 'btn' },
      },
      'actions'
    );
    expect(messages['actions.save']).toBe('Save');
  });

  it('rejects keys deeper than 3 segments', () => {
    expect(() => flattenCatalog({ d: { message: 'x' } }, 'a.b.c')).toThrow();
  });
});

describe('validateKeyNaming', () => {
  it('flags generic leaf segments', () => {
    const issues = validateKeyNaming('settings.page.title');
    expect(issues.some((i) => i.includes('title'))).toBe(true);
  });

  it('accepts semantic keys', () => {
    expect(validateKeyNaming('actions.save')).toHaveLength(0);
  });
});

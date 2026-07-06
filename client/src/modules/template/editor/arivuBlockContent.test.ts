import { describe, expect, it } from 'vitest';
import { ARIVU_BLOCK_DEFINITIONS, getArivuCatalogEntries } from './arivuBlockContent';
import { getBlockCatalogForFormat, getBlockCatalogGroups } from './blockCatalog';

describe('arivuBlockContent', () => {
  it('defines unique block ids', () => {
    const ids = ARIVU_BLOCK_DEFINITIONS.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes all core content component types', () => {
    const ids = new Set(ARIVU_BLOCK_DEFINITIONS.map((block) => block.id));
    const required = [
      'heading',
      'paragraph',
      'merge-field',
      'table',
      'line-item',
      'totals',
      'address-block',
      'organization-block',
      'conditional-block',
      'loop',
      'page-break',
      'page-number'
    ];
    for (const blockId of required) {
      expect(ids.has(blockId), `missing block ${blockId}`).toBe(true);
    }
  });

  it('filters print and email catalog entries by format', () => {
    const printIds = new Set(getArivuCatalogEntries('print').map((block) => block.id));
    const emailIds = new Set(getArivuCatalogEntries('email').map((block) => block.id));

    expect(printIds.has('page-break')).toBe(true);
    expect(emailIds.has('page-break')).toBe(false);
    expect(emailIds.has('email-button')).toBe(true);
    expect(printIds.has('email-button')).toBe(false);
    expect(printIds.has('cta-button')).toBe(true);
    expect(emailIds.has('cta-button')).toBe(false);
  });
});

describe('blockCatalog', () => {
  it('returns grouped blocks for pdf templates', () => {
    const groups = getBlockCatalogGroups('pdf');
    expect(groups.length).toBeGreaterThan(0);
    const groupKeys = groups.map(([key]) => key);
    expect(groupKeys).not.toContain('templates.builderGroupText');
    const allIds = groups.flatMap(([, items]) => items.map((item) => item.id));
    expect(allIds).toContain('merge-field');
    expect(allIds).toContain('text-block');
    expect(allIds).not.toContain('text-basic');
  });

  it('returns grouped blocks for email templates', () => {
    const catalog = getBlockCatalogForFormat('email');
    expect(catalog.some((block) => block.id === 'button' && block.source === 'grapes')).toBe(true);
    expect(catalog.some((block) => block.id === 'merge-field' && block.source === 'arivu')).toBe(true);
  });
});

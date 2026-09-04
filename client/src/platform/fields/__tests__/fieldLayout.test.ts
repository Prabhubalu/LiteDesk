import { describe, it, expect } from 'vitest';
import {
  applyFieldLayoutToModuleState,
  moveFieldAcrossLayout,
  moveFieldToSection,
  createCustomSection,
  deleteSectionIfEmpty,
  groupFieldsByLayout
} from '@/platform/fields/fieldLayout';

describe('fieldLayout', () => {
  it('seeds people fields into standard sections without ownership buckets', () => {
    const { layout, fields } = applyFieldLayoutToModuleState('people', [
      { key: 'first_name', order: 0 },
      { key: 'email', order: 1 },
      { key: 'assignedTo', order: 2 },
      { key: 'lead_status', order: 3 },
      { key: 'createdAt', order: 4 }
    ], null);

    expect(layout.sections.map((s) => s.id)).toEqual([
      'basic',
      'contact',
      'assignment',
      'additional'
    ]);
    expect(fields.find((f) => f.key === 'first_name')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'email')?.sectionId).toBe('contact');
    expect(fields.find((f) => f.key === 'assignedTo')?.sectionId).toBe('assignment');
    expect(fields.find((f) => f.key === 'lead_status')?.sectionId).toBe('additional');
    expect(fields.find((f) => f.key === 'createdAt')?.sectionId).toBe('additional');
  });

  it('allows moving core fields across layout sections', () => {
    const { layout, fields } = applyFieldLayoutToModuleState('people', [
      { key: 'first_name', order: 0 },
      { key: 'email', order: 1 }
    ], null);

    const moved = moveFieldToSection(fields, layout, 'first_name', 'contact');
    expect(moved.find((f) => f.key === 'first_name')?.sectionId).toBe('contact');

    const across = moveFieldAcrossLayout(moved, layout, 'first_name', 'email');
    expect(across.find((f) => f.key === 'first_name')?.sectionId).toBe(
      across.find((f) => f.key === 'email')?.sectionId
    );
  });

  it('protects standard sections from delete and allows empty custom delete', () => {
    const { layout, fields } = applyFieldLayoutToModuleState('people', [
      { key: 'first_name', order: 0 }
    ], null);
    const withCustom = createCustomSection(layout, 'My Block');
    const customId = withCustom.sections.find((s) => !s.protected)!.id;

    expect(deleteSectionIfEmpty(withCustom, fields, 'basic')).toEqual({
      ok: false,
      reason: 'protected'
    });
    expect(deleteSectionIfEmpty(withCustom, fields, customId).ok).toBe(true);
  });

  it('groups by layout section ids', () => {
    const { layout, fields } = applyFieldLayoutToModuleState('people', [
      { key: 'first_name', order: 0 },
      { key: 'email', order: 1 }
    ], null);
    const groups = groupFieldsByLayout(fields, layout);
    expect(groups.find((g) => g.section.id === 'basic')?.fieldKeys).toContain('first_name');
    expect(groups.find((g) => g.section.id === 'contact')?.fieldKeys).toContain('email');
  });

  it('seeds quote core fields into Basic Information and repairs collapsed additional dump', () => {
    const { layout, fields } = applyFieldLayoutToModuleState(
      'quotes',
      [
        { key: 'quoteTitle', sectionId: 'additional', order: 0 },
        { key: 'quoteDate', sectionId: 'additional', order: 1 },
        { key: 'status', sectionId: 'additional', order: 2 },
        { key: 'createdAt', sectionId: 'additional', order: 3 },
        { key: 'quoteNumber', sectionId: 'additional', order: 4 }
      ],
      {
        version: 1,
        sections: [
          { id: 'general', labelKey: 'settings.modFieldsSectionGeneral', order: 0, protected: true },
          { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
        ]
      }
    );

    expect(layout.sections.map((s) => s.id)).toEqual(['basic', 'additional']);
    expect(layout.sections[0]?.labelKey).toBe('settings.modFieldsSectionBasic');
    expect(fields.find((f) => f.key === 'quoteTitle')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'quoteDate')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'status')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'createdAt')?.sectionId).toBe('additional');
    expect(fields.find((f) => f.key === 'quoteNumber')?.sectionId).toBe('additional');
  });
});

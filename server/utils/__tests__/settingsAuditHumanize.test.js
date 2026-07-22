'use strict';

const {
  buildChangeList,
  buildHumanSummary,
  buildPresentation,
  getSurfaceLabel
} = require('../../utils/settingsAuditHumanize');

describe('settingsAuditHumanize', () => {
  test('labels surfaces for people', () => {
    expect(getSurfaceLabel('organization')).toBe('Company details');
    expect(getSurfaceLabel('security')).toBe('Security');
  });

  test('diffs only changed fields', () => {
    const changes = buildChangeList(
      { name: 'Old Co', currency: 'USD', timeZone: 'UTC' },
      { name: 'Arivu Systems', currency: 'USD', timeZone: 'Asia/Calcutta' }
    );
    expect(changes).toHaveLength(2);
    expect(changes.map((c) => c.field).sort()).toEqual(['name', 'timeZone']);
    expect(changes.find((c) => c.field === 'name').to).toBe('Arivu Systems');
  });

  test('builds plain-language summary for one change', () => {
    const summary = buildHumanSummary({
      surface: 'organization',
      action: 'update',
      before: { name: 'Old' },
      after: { name: 'New' }
    });
    expect(summary).toMatch(/Company name/i);
    expect(summary).toMatch(/Old/);
    expect(summary).toMatch(/New/);
    expect(summary).not.toMatch(/PUT/);
  });

  test('presentation lists friendly field labels', () => {
    const presentation = buildPresentation({
      surface: 'organization',
      action: 'update',
      before: { primaryColor: '#000000' },
      after: { primaryColor: '#3a1f8a' }
    });
    expect(presentation.changes[0].label).toBe('Brand color');
    expect(presentation.title).toMatch(/Brand color/);
  });
});

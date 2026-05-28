const {
  applyCaseCannedResponseTokens,
  normalizeCannedResponses,
  validateCannedResponses,
  filterCannedResponsesForChannel
} = require('../caseCannedResponseService');

describe('caseCannedResponseService', () => {
  it('applies token placeholders', () => {
    const out = applyCaseCannedResponseTokens('Hi {{contact.firstName}}, case {{case.caseId}}', {
      case: { caseId: 'CASE-1' },
      contact: { firstName: 'Sam' }
    });
    expect(out).toBe('Hi Sam, case CASE-1');
  });

  it('returns defaults when list is missing', () => {
    const list = normalizeCannedResponses(undefined, { useDefaultsWhenMissing: true });
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].id).toBeTruthy();
  });

  it('persists empty list without substituting defaults', () => {
    const list = normalizeCannedResponses([], { useDefaultsWhenMissing: false });
    expect(list).toEqual([]);
  });

  it('filters by channel', () => {
    const list = [
      { id: 'a', name: 'A', channel: 'email', body: 'x' },
      { id: 'b', name: 'B', channel: 'internal', body: 'y' },
      { id: 'c', name: 'C', channel: 'all', body: 'z' }
    ];
    const emailOnly = filterCannedResponsesForChannel(list, 'email');
    expect(emailOnly.map((i) => i.id).sort()).toEqual(['a', 'c']);
  });

  it('validates canned responses', () => {
    expect(validateCannedResponses([{ id: 'x', name: 'N', channel: 'email', body: 'B' }])).toBeNull();
    expect(validateCannedResponses([{ id: 'x', name: '', channel: 'email', body: 'B' }])).toContain('name');
  });
});

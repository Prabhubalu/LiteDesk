'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isAstraCoachEnabled,
  isWeakSummarizeAnswer,
  heuristicCoachSummarize,
  formatMemoryPrefsForPrompt,
} = require('../aiAstraCoachService');

describe('aiAstraCoachService', () => {
  it('defaults coach enabled', () => {
    const prev = process.env.ASTRA_COACH_V1;
    delete process.env.ASTRA_COACH_V1;
    assert.equal(isAstraCoachEnabled(), true);
    process.env.ASTRA_COACH_V1 = 'false';
    assert.equal(isAstraCoachEnabled(), false);
    if (prev === undefined) delete process.env.ASTRA_COACH_V1;
    else process.env.ASTRA_COACH_V1 = prev;
  });

  it('detects weak summarize hijacks', () => {
    assert.equal(isWeakSummarizeAnswer({
      headline: 'Need one or two details to finish',
      bullets: ['Still needed: startDateTime'],
      detail: '',
    }), true);
    assert.equal(isWeakSummarizeAnswer({
      headline: 'Email: Quick refresh on your quote',
      bullets: [],
      detail: 'Hi,',
    }), true);
    assert.equal(isWeakSummarizeAnswer({
      headline: 'Sample Deal: in Negotiation — clear the path to close',
      bullets: ['Deal is in Negotiation', 'Close date needs confirmation', 'Contact engaged'],
      detail: 'Pick one close move this week.',
    }), false);
  });

  it('heuristic coach restores a premium summary from hijacked answer', () => {
    const out = heuristicCoachSummarize({
      headline: 'Need one or two details to finish',
      bullets: [
        'I already pulled the rest from your CRM and defaults.',
        'Still needed: startDateTime',
        'Still needed: endDateTime',
      ],
      detail: '',
      actions: [
        { kind: 'create_record', moduleKey: 'events', label: 'Create events' },
        { kind: 'send_email', label: 'Email about the expired quote', rationale: 'Fresh ask' },
      ],
    }, {
      recordTitle: 'Sample Deal',
      moduleKey: 'deals',
      contextText: 'Stage: Negotiation\nExpired quote attached\nClose date: Jul 3, 2026',
    });

    assert.doesNotMatch(out.headline, /Need one or two|Email:/i);
    assert.match(out.headline, /Negotiation|Sample Deal|expired|matters|close/i);
    assert.ok(out.bullets.length >= 2);
    assert.ok(!out.bullets.some((b) => /still needed/i.test(b)));
    assert.ok(String(out.detail || '').length > 40);
    assert.equal(out.actions.some((a) => /^Create events$/i.test(a.label)), false);
    assert.equal(out.suggestionMode, true);
    assert.equal(out.coached, true);
  });

  it('formats memory prefs for prompt', () => {
    const text = formatMemoryPrefsForPrompt({
      preferCoachingSummary: true,
      preferSummaryNotEmail: true,
      dismissedFingerprints: ['follow_up:deals:abc'],
    });
    assert.match(text, /coaching/i);
    assert.match(text, /email body/i);
    assert.match(text, /follow_up:deals:abc/);
  });
});

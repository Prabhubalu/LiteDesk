'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseDigestBriefJson,
  normalizeDigestWindow,
  normalizeAppKey,
  resolveSinceDate,
  generateDigestBrief,
} = require('../aiDigestBriefService');
const { getPrompt } = require('../prompts/promptRegistry');

describe('aiDigestBriefService', () => {
  it('parseDigestBriefJson extracts compact structured brief', () => {
    const parsed = parseDigestBriefJson(JSON.stringify({
      subject: 'Daily audit brief',
      summary: 'You have new audit work.',
      priorities: ['Review overdue corrective actions'],
      suggestedActions: ['Open Audit queue'],
    }));

    assert.equal(parsed.subject, 'Daily audit brief');
    assert.equal(parsed.priorities.length, 1);
    assert.equal(parsed.suggestedActions[0], 'Open Audit queue');
  });

  it('parseDigestBriefJson returns empty object on garbage', () => {
    const parsed = parseDigestBriefJson('not json');
    assert.equal(parsed.subject, '');
    assert.deepEqual(parsed.priorities, []);
  });

  it('normalizes window and app key to allow-lists', () => {
    assert.equal(normalizeDigestWindow('weekly'), 'weekly');
    assert.equal(normalizeDigestWindow('bad'), 'daily');
    assert.equal(normalizeAppKey('audit'), 'AUDIT');
    assert.equal(normalizeAppKey('unknown'), 'SALES');
  });

  it('resolveSinceDate uses 1 day or 7 day windows', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    assert.equal(resolveSinceDate('daily', now).toISOString(), '2026-07-16T12:00:00.000Z');
    assert.equal(resolveSinceDate('weekly', now).toISOString(), '2026-07-10T12:00:00.000Z');
  });

  it('returns empty preview without invoking LLM when digest has no items', async () => {
    const result = await generateDigestBrief({
      organizationId: 'org1',
      userId: 'user1',
      appKey: 'AUDIT',
      window: 'daily',
      now: new Date('2026-07-17T12:00:00.000Z'),
      aggregateDigestFn: async () => null,
    });

    assert.equal(result.empty, true);
    assert.equal(result.autoSend, false);
    assert.equal(result.confirmRequired, true);
    assert.equal(result.appKey, 'AUDIT');
  });

  it('registers scheduled_digest_system prompt with preview-only guidance', () => {
    const prompt = getPrompt('scheduled_digest_system');
    assert.equal(prompt.version, 'v1');
    assert.match(prompt.text, /Use only provided counts/);
    assert.match(prompt.text, /Preview-only/);
  });
});

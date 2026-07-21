'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isRecordSummarizeAsk,
  isFieldDumpBullet,
  enrichRecordCoachingAnswer,
  ensurePracticalAiAssists,
  hasPracticalAiAssist,
  scrubUserFacingText,
  looksLikeEmailDeliverableAsk,
} = require('../aiTenantAgentService');

describe('record coaching enrich', () => {
  it('detects summarize asks', () => {
    assert.equal(isRecordSummarizeAsk('Summarize this record'), true);
    assert.equal(isRecordSummarizeAsk('what is next best action'), false);
  });

  it('flags field-dump bullets', () => {
    assert.equal(isFieldDumpBullet('Contact email: im.prabhub@gmail.com'), true);
    assert.equal(isFieldDumpBullet('Owner: Arivu Admin is handling this contact'), true);
    assert.equal(isFieldDumpBullet('No do-not-contact flag set'), true);
    assert.equal(isFieldDumpBullet('Expired quote still open — follow-up risk'), false);
  });

  it('scrubs E2E event codes from headlines', () => {
    const out = scrubUserFacingText('Prep for Prabhu Balu — ReportsE2E Event MR54T40F-6');
    assert.match(out, /Prabhu Balu/i);
    assert.doesNotMatch(out, /ReportsE2E|MR54/i);
  });

  it('does not treat coaching/summarize prompts as email-deliverable asks', () => {
    assert.equal(
      looksLikeEmailDeliverableAsk(
        'Coaching summary for Sample Deal. Include next actions (send an email). Do NOT replace the summary with an email body.',
      ),
      false,
    );
    assert.equal(looksLikeEmailDeliverableAsk('Summarize this record'), false);
    assert.equal(looksLikeEmailDeliverableAsk('give me the email'), true);
  });

  it('does not treat summarize this record as write intent', () => {
    const { looksLikeWriteIntent } = require('../aiTenantAgentService');
    assert.equal(looksLikeWriteIntent('Summarize this record'), false);
    assert.equal(looksLikeWriteIntent('Coaching summary for Sample Deal'), false);
    assert.equal(looksLikeWriteIntent('create a meeting tomorrow'), true);
  });

  it('deal summarize keeps summary first, not an email card', () => {
    const out = enrichRecordCoachingAnswer({
      headline: 'Email: Quick refresh on your quote — Sample Deal',
      bullets: [],
      detail: 'Hi,\n\nI noticed the quote...',
      actions: [{ kind: 'create_record', label: 'Create events', moduleKey: 'events' }],
    }, {
      question: 'Summarize this record',
      recordTitle: 'Sample Deal',
      moduleKey: 'deals',
      recordId: '507f1f77bcf86cd799439011',
      contextText: '=== PRIMARY RECORD (deals) ===\nName: Sample Deal\nStage: Negotiation\nAmount: 999\nClose Date: Jul 3, 2026\nLinked people: Prabhu Balu',
    });

    assert.doesNotMatch(out.headline, /^Email:/i);
    assert.match(out.headline, /Negotiation|Sample Deal|matters|close/i);
    assert.ok(out.bullets.length >= 1);
    assert.ok(String(out.detail || '').length > 40);
    assert.doesNotMatch(String(out.detail || ''), /^Hi,/i);
    assert.equal(out.actions.some((a) => /^Create events$/i.test(a.label)), false);
  });

  it('never dumps CHUNK-RESOLVED context into fallback bullets', () => {
    const {
      buildContextFallbackStructured,
      buildRecordNbaFallbackStructured,
      isInternalContextLine,
    } = require('../aiTenantAgentService');

    assert.equal(isInternalContextLine('CHUNK-RESOLVED CRM EVIDENCE (primary kept full)'), true);
    assert.equal(isInternalContextLine('STICKY CHAT RULE: Continue answering'), true);
    assert.equal(isInternalContextLine('Stage: Negotiation'), false);

    const dump = [
      'CHUNK-RESOLVED CRM EVIDENCE (primary kept full; related/activity facts map-reduced for speed).',
      'Treat digests as compressed CRM truth — do not invent beyond them or the primary block.',
      'Conversation focus (sticky chat thread): Mr. Prabhu Balu; Sample Deal',
      'STICKY CHAT RULE: Continue answering about Conversation focus.',
      'RECORD ANALYSIS: Primary fields, recent activities/comments',
      '=== PRIMARY RECORD (deals) ===',
      'Label: Sample Deal',
      'Stage: Negotiation',
      'Amount / expected value: 999',
      'Contact: Mr. Prabhu Balu',
    ].join('\n');

    const fallback = buildContextFallbackStructured('Pipeline Report Specialist', dump, [
      { excerpt: 'Sample Deal' },
    ], { recordTitle: 'Sample Deal' });
    assert.doesNotMatch(fallback.headline, /CHUNK-RESOLVED|Pipeline Report Specialist:/i);
    assert.ok(fallback.bullets.every((b) => !/CHUNK-RESOLVED|STICKY CHAT|Conversation focus|RECORD ANALYSIS/i.test(b)));
    assert.ok(fallback.bullets.some((b) => /Negotiation|999|Prabhu|Stage|Amount|Contact/i.test(b)));

    const nba = buildRecordNbaFallbackStructured({
      recordTitle: 'Sample Deal',
      moduleKey: 'deals',
      contextText: dump + '\nExpired quote attached',
      recordId: '507f1f77bcf86cd799439011',
    });
    assert.match(nba.headline, /Sample Deal|quote|close|Negotiation/i);
    assert.ok(nba.actions.length >= 1);
    assert.ok(!nba.bullets.some((b) => /CHUNK-RESOLVED|STICKY/i.test(b)));
  });

  it('upgrades flat summarize into coaching + actions + chips', () => {
    const out = enrichRecordCoachingAnswer({
      headline: 'Summary',
      bullets: [
        'Contact email: im.prabhub@gmail.com',
        'Owner: Arivu Admin',
        'No do-not-contact flag set',
        'Planned follow-up: Discuss expired Quote with Prabhu Balu',
      ],
      detail: '',
      actions: [],
    }, {
      question: 'Summarize this record',
      recordTitle: 'Mr. Prabhu Balu',
      moduleKey: 'people',
      recordId: '507f1f77bcf86cd799439011',
      contextText: 'Expired Quote. Business Plan Discussion. Following up emails to im.prabhub@gmail.com. Vtiger CRM.',
    });

    assert.match(out.headline, /quote|meeting|matters|Prabhu/i);
    assert.ok(out.bullets.every((b) => !isFieldDumpBullet(b)));
    assert.ok(String(out.detail || '').length > 40);
    assert.ok(Array.isArray(out.actions) && out.actions.length >= 1);
    assert.equal(out.suggestionMode, true);
    assert.ok(out.clarifyingQuestions.length >= 2);
  });

  it('ensurePracticalAiAssists adds teammate play + prep CTA when CRM-only', () => {
    assert.equal(hasPracticalAiAssist({
      detail: 'Contact email is on file.',
      actions: [{ kind: 'review_record', label: 'Review Darshan' }],
    }), false);

    const out = ensurePracticalAiAssists({
      headline: 'Darshan needs a touch',
      bullets: ['Only created 21 days ago'],
      detail: 'Thin CRM activity so far.',
      actions: [{ kind: 'review_record', label: 'Review Darshan', recordId: '507f1f77bcf86cd799439011' }],
    }, {
      recordTitle: 'Darshan',
      moduleKey: 'people',
      contextText: 'Event: sports meeting Planned. Contact email: darshan@sample.com',
      question: 'Summarize this record',
    });

    assert.match(String(out.detail || ''), /How I'd play it/i);
    assert.ok(hasPracticalAiAssist(out));
    assert.ok(out.actions.some((a) => a.kind === 'manual' && /prep|question|talking/i.test(a.label)));
  });
});

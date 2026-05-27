const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizePortalIngestResponse,
  normalizeEmail
} = require('../../platform/mailroom/connectors/portal/portalSafety');

test('mailroom portal safety', async (t) => {
  await t.test('normalizeEmail lowercases and trims', () => {
    assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
  });

  await t.test('sanitizePortalIngestResponse strips policy internals', () => {
    const out = sanitizePortalIngestResponse({
      mailroom: true,
      idempotent: false,
      rawPayloadId: 'abc',
      policyEvaluation: { threading: { matched: true } },
      caseLink: { executed: true, action: 'append', caseId: 'case1', internal: 'secret' },
      conversationResult: {
        conversation: { _id: 'conv1' },
        message: { _id: 'msg1', linkedCaseId: 'case1' }
      }
    });
    assert.equal(out.mailroom, true);
    assert.equal(out.conversationId, 'conv1');
    assert.equal(out.messageId, 'msg1');
    assert.equal(out.linkedCaseId, 'case1');
    assert.equal(out.caseLink.caseId, 'case1');
    assert.equal(out.policyEvaluation, undefined);
    assert.equal(out.caseLink.internal, undefined);
  });
});

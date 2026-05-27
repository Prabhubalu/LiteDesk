const { describe, it } = require('node:test');
const assert = require('node:assert');
const { evaluatePipeline } = require('../../platform/mailroom/policies/policyEngine');
const { getTemplate } = require('../../platform/mailroom/policies/templates/defaultTemplates');
const { buildNormalizedMessage } = require('../../platform/mailroom/domain/normalizedMessage');

describe('mailroom M2 threading with conversation candidates', () => {
  const policies = getTemplate('helpdesk_standard_email').policies;

  it('threads reply via in-reply-to when mailroom message candidate exists', () => {
    const message = buildNormalizedMessage({
      channel: 'email',
      subject: 'Re: Billing',
      inReplyTo: '<parent@example.com>',
      participants: { from: { address: 'customer@example.com' } }
    });
    const result = evaluatePipeline({
      message,
      candidates: {
        messages: [
          {
            externalMessageId: '<parent@example.com>',
            conversationId: 'conv123',
            caseId: 'case456'
          }
        ],
        conversations: [
          {
            _id: 'conv123',
            externalThreadId: 'thread-1',
            lastFromAddress: 'customer@example.com',
            lastSubject: 'Billing',
            primaryCaseId: 'case456'
          }
        ],
        openCases: [{ _id: 'case456', status: 'In Progress' }]
      },
      policies
    });
    assert.equal(result.threading.matched, true);
    assert.equal(result.threading.signal, 'in_reply_to');
    assert.equal(String(result.threading.target.conversationId), 'conv123');
  });

  it('threads by sender+subject when earlier conversation exists', () => {
    const message = buildNormalizedMessage({
      channel: 'email',
      subject: 'Re: Printer jam',
      participants: { from: { address: 'user@example.com' } }
    });
    const result = evaluatePipeline({
      message,
      candidates: {
        messages: [],
        conversations: [
          {
            _id: 'conv789',
            lastFromAddress: 'user@example.com',
            lastSubject: 'Printer jam',
            primaryCaseId: null
          }
        ],
        openCases: []
      },
      policies
    });
    assert.equal(result.threading.matched, true);
    assert.equal(result.threading.signal, 'sender_subject');
  });
});

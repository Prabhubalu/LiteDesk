const { describe, it } = require('node:test');
const assert = require('node:assert');
const { mapParsedMimeToNormalized } = require('../../platform/mailroom/domain/parsedMessageMappers');
const { evaluatePipeline } = require('../../platform/mailroom/policies/policyEngine');
const { getTemplate } = require('../../platform/mailroom/policies/templates/defaultTemplates');

describe('mailroom email pipeline helpers', () => {
  it('maps parsed MIME to normalized message', () => {
    const normalized = mapParsedMimeToNormalized({
      messageId: '<a@b.com>',
      fromAddress: 'user@example.com',
      subject: 'Help',
      text: 'Body',
      references: ['<parent@example.com>'],
      inReplyTo: '<parent@example.com>'
    });
    assert.equal(normalized.channel, 'email');
    assert.equal(normalized.externalMessageId, '<a@b.com>');
    assert.equal(normalized.participants.from.address, 'user@example.com');
  });

  it('pipeline evaluation runs before legacy handoff (fixture)', () => {
    const policies = getTemplate('helpdesk_standard_email').policies;
    const normalized = mapParsedMimeToNormalized({
      messageId: '<child@example.com>',
      inReplyTo: '<parent@example.com>',
      fromAddress: 'c@example.com',
      subject: 'Re: Issue'
    });
    const result = evaluatePipeline({
      message: normalized,
      candidates: {
        messages: [
          {
            externalMessageId: '<parent@example.com>',
            caseId: 'case1'
          }
        ],
        openCases: [{ _id: 'case1', status: 'In Progress' }]
      },
      policies
    });
    assert.equal(result.threading.matched, true);
    assert.equal(result.caseLink.action, 'append');
  });
});

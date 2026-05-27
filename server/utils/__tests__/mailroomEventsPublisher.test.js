const { describe, it } = require('node:test');
const assert = require('node:assert');
const { getTemplate } = require('../../platform/mailroom/policies/templates/defaultTemplates');
const {
  collectProcessingEvents,
  getPublishList
} = require('../../platform/mailroom/events/publisher');
const { buildMailroomEventEnvelope } = require('../../platform/mailroom/events/eventEnvelope');
const { dispatchMailroomEvent } = require('../../platform/mailroom/events/dispatcher');

describe('mailroom events publisher', () => {
  it('collects required events for a new case flow', () => {
    const normalized = {
      channel: 'email',
      subject: 'Help',
      externalMessageId: '<a@b.com>',
      participants: { from: { address: 'c@example.com' } }
    };
    const events = collectProcessingEvents({
      normalizedMessage: normalized,
      policyEvaluation: { dedup: { isDuplicate: false } },
      caseResult: {
        action: 'created_case',
        caseId: 'case123',
        caseRecord: { status: 'New', caseOwnerId: 'owner1' }
      },
      conversationResult: {
        conversation: { _id: 'conv1' },
        message: { _id: 'msg1' },
        conversationCreated: true,
        duplicate: false,
        threadingLog: { resolution: 'new_conversation' }
      }
    });

    const types = events.map((e) => e.eventType);
    assert.ok(types.includes('message.received'));
    assert.ok(types.includes('message.normalized'));
    assert.ok(types.includes('conversation.created'));
    assert.ok(types.includes('case.created'));
  });

  it('includes duplicate.detected when dedup matches', () => {
    const events = collectProcessingEvents({
      normalizedMessage: { channel: 'email', subject: 'Re: Hi' },
      policyEvaluation: {
        dedup: { isDuplicate: true, behavior: 'append_to_existing_open_case' }
      },
      caseResult: { action: 'appended_to_existing_case', caseId: 'case1' },
      conversationResult: {
        conversation: { _id: 'conv1' },
        message: { _id: 'msg1' },
        conversationCreated: false,
        duplicate: false
      }
    });

    assert.ok(events.some((e) => e.eventType === 'duplicate.detected'));
    assert.ok(events.some((e) => e.eventType === 'conversation.updated'));
  });

  it('builds event envelope with stable shape', () => {
    const envelope = buildMailroomEventEnvelope({
      eventType: 'message.received',
      organizationId: 'org1',
      rawPayloadId: 'raw1',
      data: { subject: 'Test' }
    });
    assert.equal(envelope.eventType, 'message.received');
    assert.equal(envelope.organizationId, 'org1');
    assert.ok(envelope.eventId);
    assert.ok(envelope.timestamp);
  });

  it('reads dispatch publish list from template policies', () => {
    const policies = getTemplate('helpdesk_standard_email').policies;
    const list = getPublishList(policies);
    assert.ok(list.includes('case.created'));
    assert.ok(list.includes('message.received'));
  });

  it('skips duplicate domain emit for case.created when adapter already emitted', () => {
    const envelope = buildMailroomEventEnvelope({
      eventType: 'case.created',
      organizationId: 'org1',
      caseId: 'case1',
      data: {}
    });
    const result = dispatchMailroomEvent(envelope, {
      caseResult: { action: 'created_case', caseId: 'case1' }
    });
    assert.equal(result.dispatched, false);
    assert.equal(result.reason, 'domain_event_already_emitted');
  });
});

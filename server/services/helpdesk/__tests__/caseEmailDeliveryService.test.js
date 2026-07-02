'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isHelpdeskModule,
  deliveryFieldsFromEvent
} = require('../caseEmailDeliveryService');
const { mapCommunicationDeliveryFields } = require('../../amds/deliveryFields');

describe('caseEmailDeliveryService', () => {
  it('recognizes helpdesk module keys', () => {
    assert.equal(isHelpdeskModule('helpdesk'), true);
    assert.equal(isHelpdeskModule('cases'), true);
    assert.equal(isHelpdeskModule('people'), false);
  });

  it('maps delivered webhook event fields', () => {
    const fields = deliveryFieldsFromEvent({
      event_type: 'message.delivered',
      message_id: 'msg-1',
      timestamp: '2026-06-30T00:00:00.000Z'
    });
    assert.equal(fields.deliveryStatus, 'delivered');
    assert.equal(fields.amdsMessageId, 'msg-1');
    assert.equal(fields.deliveryError, null);
  });

  it('maps failed webhook event fields', () => {
    const fields = deliveryFieldsFromEvent({
      event_type: 'message.failed',
      message_id: 'msg-2',
      delivery: { error: 'SMTP timeout' }
    });
    assert.equal(fields.deliveryStatus, 'failed');
    assert.equal(fields.deliveryError, 'SMTP timeout');
  });

  it('maps bounced webhook event fields', () => {
    const fields = deliveryFieldsFromEvent({
      event_type: 'message.bounced',
      message_id: 'msg-3',
      bounce: {
        classification: 'hard',
        diagnostic: '550 User unknown',
        recipient: 'bad@example.com'
      }
    });
    assert.equal(fields.deliveryStatus, 'bounced');
    assert.equal(fields.bounceClassification, 'hard');
    assert.equal(fields.bounceDiagnostic, '550 User unknown');
    assert.equal(fields.bounceRecipient, 'bad@example.com');
  });
});

describe('mapCommunicationDeliveryFields', () => {
  it('maps sending to processing deliveryStatus', () => {
    const mapped = mapCommunicationDeliveryFields({ status: 'sending', metadata: {} });
    assert.equal(mapped.deliveryStatus, 'processing');
  });

  it('maps delivered communication status', () => {
    const mapped = mapCommunicationDeliveryFields({
      status: 'delivered',
      metadata: { amdsMessageId: 'abc', deliveryUpdatedAt: new Date('2026-06-30') }
    });
    assert.equal(mapped.deliveryStatus, 'delivered');
    assert.equal(mapped.amdsMessageId, 'abc');
  });

  it('maps bounced communication with diagnostic metadata', () => {
    const mapped = mapCommunicationDeliveryFields({
      status: 'bounced',
      metadata: {
        bounceClassification: 'hard',
        bounceDiagnostic: '550 rejected',
        bounceRecipient: 'x@y.com'
      }
    });
    assert.equal(mapped.deliveryStatus, 'bounced');
    assert.equal(mapped.bounceDiagnostic, '550 rejected');
  });
});

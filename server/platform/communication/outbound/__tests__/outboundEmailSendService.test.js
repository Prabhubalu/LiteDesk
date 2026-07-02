const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildCommunicationUpdateFromSendResult } = require('../outboundEmailSendService');

describe('outboundEmailSendService.buildCommunicationUpdateFromSendResult (R2)', () => {
  it('maps Gmail send ids onto Communication fields', () => {
    const update = buildCommunicationUpdateFromSendResult({
      success: true,
      provider: 'gmail',
      messageId: 'msg123',
      threadId: 'thread456',
      providerMessageKey: 'gmail:msg123'
    });
    assert.equal(update.status, 'sent');
    assert.equal(update.externalMessageId, 'msg123');
    assert.equal(update.providerMessageKey, 'gmail:msg123');
    assert.equal(update.providerThreadId, 'thread456');
    assert.equal(update['metadata.provider'], 'gmail');
  });

  it('maps SMTP message id without provider thread fields', () => {
    const update = buildCommunicationUpdateFromSendResult({
      success: true,
      provider: 'smtp',
      messageId: '<abc@example.com>'
    });
    assert.equal(update.externalMessageId, '<abc@example.com>');
    assert.equal(update.providerMessageKey, undefined);
    assert.equal(update.providerThreadId, undefined);
  });

  it('maps AMDS message id onto Communication fields', () => {
    const update = buildCommunicationUpdateFromSendResult({
      success: true,
      provider: 'amds',
      messageId: '550e8400-e29b-41d4-a716-446655440000'
    });
    assert.equal(update.status, 'sent');
    assert.equal(update.externalMessageId, '550e8400-e29b-41d4-a716-446655440000');
    assert.equal(update.providerMessageKey, 'amds:550e8400-e29b-41d4-a716-446655440000');
    assert.equal(update['metadata.amdsMessageId'], '550e8400-e29b-41d4-a716-446655440000');
    assert.equal(update['metadata.provider'], 'amds');
  });

  it('persists AMDS send error codes on queue/sync failure', () => {
    const update = buildCommunicationUpdateFromSendResult({
      success: false,
      provider: 'amds',
      error: 'Cannot send — recipient is suppressed: bad@example.com',
      code: 'AMDS_SUPPRESSED_RECIPIENT'
    });
    assert.equal(update.status, 'failed');
    assert.equal(update['metadata.sendErrorCode'], 'AMDS_SUPPRESSED_RECIPIENT');
    assert.match(update['metadata.deliveryError'], /suppressed/i);
  });

  it('persists AMDS domain-not-verified metadata', () => {
    const update = buildCommunicationUpdateFromSendResult({
      success: false,
      provider: 'amds',
      error: 'Sending domain not verified: example.com',
      code: 'AMDS_DOMAIN_NOT_VERIFIED',
      domain: 'example.com'
    });
    assert.equal(update['metadata.sendErrorCode'], 'AMDS_DOMAIN_NOT_VERIFIED');
    assert.equal(update['metadata.sendErrorDomain'], 'example.com');
  });
});

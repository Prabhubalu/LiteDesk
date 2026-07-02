const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const amds = require('../amdsEmailDelivery');
const { resetAmdsClientForTests } = require('../../../config/amds');

describe('amdsEmailDelivery', () => {
  const saved = {};

  beforeEach(() => {
    for (const key of ['AMDS_BASE_URL', 'AMDS_API_KEY', 'EMAIL_PROVIDER']) {
      saved[key] = process.env[key];
    }
    resetAmdsClientForTests();
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(saved)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    resetAmdsClientForTests();
  });

  it('detects provider by key', () => {
    assert.equal(amds.isAmdsProvider({ provider: 'amds' }), true);
    assert.equal(amds.isAmdsProvider({ provider: 'resend' }), false);
  });

  it('parses named and plain email addresses', () => {
    assert.deepEqual(amds.parseEmailAddress('"Acme Support" <support@example.com>'), {
      email: 'support@example.com',
      name: 'Acme Support'
    });
    assert.deepEqual(amds.parseEmailAddress('user@example.com'), {
      email: 'user@example.com'
    });
    assert.equal(amds.parseEmailAddress('not-an-email'), null);
  });

  it('builds communication idempotency key', () => {
    assert.equal(
      amds.buildCommunicationIdempotencyKey({
        moduleKey: 'people',
        organizationId: 'org1',
        communicationId: 'comm1'
      }),
      'litedesk-people-org1-comm-comm1'
    );
  });

  it('defaults provider to amds when env is configured', () => {
    process.env.AMDS_BASE_URL = 'http://localhost:8080';
    process.env.AMDS_API_KEY = 'test-key';
    assert.equal(amds.defaultProviderWhenUnset(), 'amds');
  });

  it('returns null default provider when AMDS env missing', () => {
    delete process.env.AMDS_BASE_URL;
    delete process.env.AMDS_API_KEY;
    assert.equal(amds.defaultProviderWhenUnset(), null);
  });

  it('is configured when from email and AMDS env are present', () => {
    process.env.AMDS_BASE_URL = 'http://localhost:8080';
    process.env.AMDS_API_KEY = 'test-key';
    assert.equal(
      amds.isAmdsConfigured({
        provider: 'amds',
        fromEmail: 'hello@example.com'
      }),
      true
    );
    assert.equal(
      amds.isAmdsConfigured({
        provider: 'amds',
        fromEmail: ''
      }),
      false
    );
  });

  it('sendViaAmds fails when AMDS is not configured', async () => {
    delete process.env.AMDS_BASE_URL;
    delete process.env.AMDS_API_KEY;
    const result = await amds.sendViaAmds({
      from: 'hello@example.com',
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
      organizationId: 'org1',
      idempotencyKey: 'key-1'
    });
    assert.equal(result.success, false);
    assert.match(result.error, /not configured/i);
  });
});

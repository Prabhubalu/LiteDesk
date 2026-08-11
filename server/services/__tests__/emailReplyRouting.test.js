'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCrmReplyToAddress,
  getCrmReplyDomain,
  isShortCrmReplyTokenEnabled
} = require('../../constants/emailReplyRouting');

describe('emailReplyRouting', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('builds short reply address', () => {
    process.env.CRM_REPLY_DOMAIN = 'reply.example.com';
    const addr = buildCrmReplyToAddress('t92ab81');
    assert.equal(addr, 'reply+t92ab81@reply.example.com');
  });

  it('rejects invalid tokens', () => {
    assert.throws(() => buildCrmReplyToAddress(''), /Invalid CRM thread token/);
    assert.throws(() => buildCrmReplyToAddress('BAD!'), /Invalid CRM thread token/);
  });

  it('reads domain from EMAIL_INBOUND_ADDRESS when set', () => {
    process.env.EMAIL_INBOUND_ADDRESS = 'inbox@reply.arivusystems.com';
    delete process.env.CRM_REPLY_DOMAIN;
    assert.equal(getCrmReplyDomain(), 'reply.arivusystems.com');
  });

  it('short token disabled by default (inbound parser path)', () => {
    delete process.env.EMAIL_REPLY_USE_SHORT_TOKEN;
    assert.equal(isShortCrmReplyTokenEnabled(), false);
  });

  it('short token can be enabled for rollback', () => {
    process.env.EMAIL_REPLY_USE_SHORT_TOKEN = 'true';
    assert.equal(isShortCrmReplyTokenEnabled(), true);
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveDeliveryMode, DELIVERY_MODES } = require('../outboundIdentityService');

describe('resolveDeliveryMode', () => {
  it('requires SMTP for consumer domains without mailbox', () => {
    assert.equal(
      resolveDeliveryMode('me@gmail.com', { mailboxReady: false, orgConfigured: true }),
      DELIVERY_MODES.NEEDS_SMTP_SETUP
    );
  });

  it('uses mailbox SMTP when ready for consumer', () => {
    assert.equal(
      resolveDeliveryMode('me@gmail.com', { mailboxReady: true, orgConfigured: true }),
      DELIVERY_MODES.MAILBOX_SMTP
    );
  });

  it('uses org provider for custom domain when configured', () => {
    assert.equal(
      resolveDeliveryMode('sales@acme.com', {
        mailboxReady: false,
        orgConfigured: true,
        orgFromDomain: 'acme.com'
      }),
      DELIVERY_MODES.ORG_PROVIDER
    );
  });

  it('needs org domain when not configured', () => {
    assert.equal(
      resolveDeliveryMode('sales@acme.com', { mailboxReady: false, orgConfigured: false }),
      DELIVERY_MODES.NEEDS_ORG_DOMAIN
    );
  });
});

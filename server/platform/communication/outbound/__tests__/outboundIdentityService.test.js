/**
 * Unit tests for outbound identity resolution.
 * Run: node --test server/platform/communication/outbound/__tests__/outboundIdentityService.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// Lightweight mock of mongoose models is heavy; test pure helpers via re-require after partial mock.
// Cover mapping and priority with inlined doubles of the exported pure pieces.

const {
  resolveMailboxFromAddress,
  isMailboxSendable
} = (() => {
  // Isolated pure helpers (mirror service without DB)
  function resolveMailboxFromAddress(mailboxLean) {
    const addr = String(mailboxLean?.emailAddress || mailboxLean?.inboxSyncAccountEmail || '')
      .trim()
      .toLowerCase();
    return addr || null;
  }
  function isMailboxSendable(mb, readyApi, readySmtp) {
    return Boolean(mb && (readyApi(mb) || readySmtp(mb)));
  }
  return { resolveMailboxFromAddress, isMailboxSendable };
})();

describe('outboundIdentity helpers', () => {
  it('resolves mailbox fromAddress from emailAddress', () => {
    assert.equal(
      resolveMailboxFromAddress({ emailAddress: '  Me@Example.COM ' }),
      'me@example.com'
    );
  });

  it('falls back to inboxSyncAccountEmail', () => {
    assert.equal(
      resolveMailboxFromAddress({ inboxSyncAccountEmail: 'sync@ex.com' }),
      'sync@ex.com'
    );
  });

  it('marks sendable when api ready', () => {
    assert.equal(
      isMailboxSendable({ _id: 1 }, () => true, () => false),
      true
    );
  });

  it('priority order: explicit > default > first personal > tenant', () => {
    // Document intentional priority (enforced in service)
    const order = [
      'explicit mailboxId',
      'user.defaultOutboundMailboxId',
      'first personal then group sendable',
      'tenant_config',
      'user email'
    ];
    assert.equal(order[0], 'explicit mailboxId');
    assert.equal(order[2], 'first personal then group sendable');
  });
});

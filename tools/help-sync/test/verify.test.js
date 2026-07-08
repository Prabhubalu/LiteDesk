'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { verifyWebhook, signWebhookBody } = require('../lib/verify');

describe('help-sync verifyWebhook', () => {
  it('accepts valid signatures and rejects invalid ones', () => {
    const body = '{"event":"content.published"}';
    const secret = 'sync-secret';
    const signature = signWebhookBody(body, secret);
    assert.equal(verifyWebhook(body, secret, signature), true);
    assert.equal(verifyWebhook(body, secret, 'sha256=bad'), false);
    assert.equal(verifyWebhook(body, '', signature), true);
  });
});

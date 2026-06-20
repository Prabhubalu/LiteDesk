'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveIdempotencyKey,
  UPLOAD_CAPABILITY
} = require('../documentUploadIdempotency');

describe('documentUploadIdempotency', () => {
  it('resolves idempotency key from header', () => {
    const req = {
      headers: { 'x-idempotency-key': 'upload-123' },
      body: {}
    };
    assert.equal(resolveIdempotencyKey(req), 'upload-123');
  });

  it('prefers header over body', () => {
    const req = {
      headers: { 'x-idempotency-key': 'header-key' },
      body: { idempotencyKey: 'body-key' }
    };
    assert.equal(resolveIdempotencyKey(req), 'header-key');
  });

  it('falls back to body when header missing', () => {
    const req = {
      headers: {},
      body: { idempotencyKey: 'body-key' }
    };
    assert.equal(resolveIdempotencyKey(req), 'body-key');
  });

  it('returns null when no key provided', () => {
    const req = { headers: {}, body: {} };
    assert.equal(resolveIdempotencyKey(req), null);
  });

  it('exports upload capability constant', () => {
    assert.equal(UPLOAD_CAPABILITY, 'documents.upload');
  });
});

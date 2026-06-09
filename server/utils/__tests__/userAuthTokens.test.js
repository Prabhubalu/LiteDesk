'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateRawToken,
  hashToken,
  isTokenExpired,
  buildInviteUrl,
  buildVerifyEmailUrl
} = require('../../utils/userAuthTokens');

test('userAuthTokens generates unique raw tokens', () => {
  const a = generateRawToken();
  const b = generateRawToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 32);
});

test('userAuthTokens hashes tokens deterministically', () => {
  const raw = 'sample-token-value';
  assert.equal(hashToken(raw), hashToken(raw));
  assert.notEqual(hashToken(raw), hashToken('other-token'));
});

test('userAuthTokens detects expiry', () => {
  assert.equal(isTokenExpired(new Date(Date.now() - 1000)), true);
  assert.equal(isTokenExpired(new Date(Date.now() + 60_000)), false);
});

test('userAuthTokens builds client urls', () => {
  const inviteUrl = buildInviteUrl('abc123');
  const verifyUrl = buildVerifyEmailUrl('xyz789');
  assert.match(inviteUrl, /\/accept-invite\?token=abc123$/);
  assert.match(verifyUrl, /\/verify-email\?token=xyz789$/);
});

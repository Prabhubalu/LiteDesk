'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSessionConsentPatch,
  normalizeConsentRequired,
  normalizePolicyUrl,
} = require('../liveChatSessionCompliance');

test('buildSessionConsentPatch requires consent when configured', () => {
  assert.throws(
    () => buildSessionConsentPatch({}, { consentRequired: true }),
    (err) => err.code === 'CONSENT_REQUIRED',
  );
});

test('buildSessionConsentPatch records timestamp when consent given', () => {
  const patch = buildSessionConsentPatch({ consentGiven: true }, { consentRequired: true });
  assert.equal(patch.consentGiven, true);
  assert.ok(patch.consentTimestamp instanceof Date);
});

test('buildSessionConsentPatch allows missing consent when not required', () => {
  const patch = buildSessionConsentPatch({}, { consentRequired: false });
  assert.equal(patch.consentGiven, false);
  assert.equal(patch.consentTimestamp, null);
});

test('normalizePolicyUrl accepts http(s) only', () => {
  assert.equal(normalizePolicyUrl('https://example.com/privacy'), 'https://example.com/privacy');
  assert.equal(normalizePolicyUrl('ftp://example.com'), '');
});

test('normalizeConsentRequired defaults to true', () => {
  assert.equal(normalizeConsentRequired(undefined), true);
  assert.equal(normalizeConsentRequired(false), false);
});

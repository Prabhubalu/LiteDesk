'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPreferenceToken,
  verifyPreferenceToken
} = require('../../../utils/marketingPreferenceToken');
const {
  appendMarketingUnsubscribeFooter
} = require('../marketingSubscriptionService');

test('createPreferenceToken round-trips verification', () => {
  const token = createPreferenceToken({
    organizationId: '507f1f77bcf86cd799439011',
    email: 'User@Example.com',
    personId: '507f1f77bcf86cd799439012',
    campaignId: '507f1f77bcf86cd799439013'
  });

  const claims = verifyPreferenceToken(token);
  assert.equal(claims.organizationId, '507f1f77bcf86cd799439011');
  assert.equal(claims.email, 'user@example.com');
  assert.equal(claims.personId, '507f1f77bcf86cd799439012');
});

test('appendMarketingUnsubscribeFooter adds footer when missing', () => {
  const html = '<html><body><p>Hello</p></body></html>';
  const result = appendMarketingUnsubscribeFooter(html, {
    unsubscribeUrl: 'https://example.com/unsubscribe',
    preferencesUrl: 'https://example.com/preferences',
    organizationName: 'Acme'
  });

  assert.match(result, /Unsubscribe/);
  assert.match(result, /Manage preferences/);
  assert.match(result, /Acme/);
});

test('appendMarketingUnsubscribeFooter skips duplicate footer', () => {
  const html = '<html><body><p>Click <a href="#">unsubscribe</a></p></body></html>';
  const result = appendMarketingUnsubscribeFooter(html, {
    unsubscribeUrl: 'https://example.com/unsubscribe'
  });
  assert.equal(result, html);
});

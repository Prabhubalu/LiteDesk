'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  isArticlesHeadlessPublicKey,
  resolveArticlesHeadlessPublicKey,
  resolveHeadlessContentOrgKey,
} = require('../articlesHeadlessPublicKeyService');

describe('articlesHeadlessPublicKeyService', () => {
  it('detects articles headless public keys', () => {
    assert.equal(isArticlesHeadlessPublicKey('art_pub_abcd1234'), true);
    assert.equal(isArticlesHeadlessPublicKey('acme-corp'), false);
  });

  it('prefers public key over slug for headless content org key', () => {
    const organization = {
      slug: 'acme-corp',
      embed: { articles: { publicKey: 'art_pub_deadbeef' } },
    };
    assert.equal(resolveArticlesHeadlessPublicKey(organization), 'art_pub_deadbeef');
    assert.equal(resolveHeadlessContentOrgKey(organization), 'art_pub_deadbeef');
  });

  it('falls back to slug when public key is missing', () => {
    const organization = { slug: 'Acme-Corp' };
    assert.equal(resolveHeadlessContentOrgKey(organization), 'acme-corp');
  });
});

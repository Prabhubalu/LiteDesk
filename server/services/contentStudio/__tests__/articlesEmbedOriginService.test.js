'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeWebsiteEmbedDomain } = require('../../../utils/normalizeWebsiteEmbedDomain');
const { extractOrgSlugFromPublicContentPath, originMatchesRegistered } = require('../articlesEmbedOriginService');

describe('normalizeWebsiteEmbedDomain', () => {
  it('normalizes bare domains to https apex and www origins', () => {
    const result = normalizeWebsiteEmbedDomain('example.com');
    assert.deepEqual(result.domain, 'example.com');
    assert.deepEqual(new Set(result.origins), new Set(['https://example.com', 'https://www.example.com']));
  });

  it('normalizes www domains to include apex origin', () => {
    const result = normalizeWebsiteEmbedDomain('https://www.example.com');
    assert.deepEqual(new Set(result.origins), new Set(['https://www.example.com', 'https://example.com']));
  });

  it('rejects page paths', () => {
    assert.throws(
      () => normalizeWebsiteEmbedDomain('https://example.com/help'),
      (error) => error.code === 'INVALID_EMBED_WEBSITE_DOMAIN',
    );
  });

  it('allows localhost in development mode', () => {
    const result = normalizeWebsiteEmbedDomain('localhost:5173', { allowLocalhost: true });
    assert.equal(result.domain, 'localhost');
    assert.deepEqual(result.origins, ['http://localhost:5173']);
  });
});

describe('articlesEmbedOriginService helpers', () => {
  it('extracts org slug from public content paths', () => {
    assert.equal(extractOrgSlugFromPublicContentPath('/api/public/v1/content/acme-corp/collections'), 'acme-corp');
    assert.equal(extractOrgSlugFromPublicContentPath('/api/public/content/acme-corp/articles/foo'), 'acme-corp');
    assert.equal(extractOrgSlugFromPublicContentPath('/api/public/v1/content/render-blocks'), '');
  });

  it('matches registered website origins', () => {
    const allowed = originMatchesRegistered('https://www.example.com', ['https://example.com', 'https://www.example.com']);
    assert.equal(allowed, true);
    assert.equal(originMatchesRegistered('https://evil.example.net', ['https://example.com']), false);
  });
});

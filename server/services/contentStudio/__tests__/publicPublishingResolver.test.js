'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveHeadlessApiBase,
  buildArticleApiUrl,
  buildArticlesListApiUrl,
  buildSitemapApiUrl,
} = require('../contentPublishingService');

describe('contentPublishingService headless delivery', () => {
  const originalPublicAppUrl = process.env.PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
  });

  afterEach(() => {
    process.env.PUBLIC_APP_URL = originalPublicAppUrl;
  });

  it('builds headless API base from articles public key', () => {
    const base = resolveHeadlessApiBase({
      slug: 'acme',
      embed: { articles: { publicKey: 'art_pub_testkey1234567890abcdef' } },
    });
    assert.equal(
      base,
      'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef',
    );
  });

  it('builds headless API base from organization slug when public key is missing', () => {
    const base = resolveHeadlessApiBase({ slug: 'acme' });
    assert.equal(base, 'https://app.example.com/api/public/v1/content/acme');
  });

  it('builds article and list API urls', () => {
    const org = {
      slug: 'acme',
      embed: { articles: { publicKey: 'art_pub_testkey1234567890abcdef' } },
    };
    assert.equal(
      buildArticleApiUrl(org, 'getting-started'),
      'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef/articles/getting-started',
    );
    assert.equal(
      buildArticlesListApiUrl(org),
      'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef/articles',
    );
    assert.equal(
      buildSitemapApiUrl(org),
      'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef/sitemap.xml',
    );
  });
});

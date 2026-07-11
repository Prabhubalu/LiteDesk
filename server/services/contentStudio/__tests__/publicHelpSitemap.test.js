'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildPublicHelpSitemapXml } = require('../publicContentService');

describe('public help sitemap', () => {
  const originalPublicAppUrl = process.env.PUBLIC_APP_URL;

  it('builds sitemap xml with headless article API urls', () => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    const xml = buildPublicHelpSitemapXml({
      org: { slug: 'acme' },
      articles: [
        { slug: 'getting-started', updatedAt: new Date('2026-01-15T10:00:00.000Z') },
        { slug: 'billing', updatedAt: new Date('2026-02-01T12:00:00.000Z') },
      ],
    });

    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<loc>https:\/\/app\.example\.com\/api\/public\/v1\/content\/acme\/articles\/getting-started<\/loc>/);
    assert.match(xml, /<loc>https:\/\/app\.example\.com\/api\/public\/v1\/content\/acme\/articles\/billing<\/loc>/);
  });

  it('includes collections and collection-scoped list urls', () => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    const xml = buildPublicHelpSitemapXml({
      org: { slug: 'acme' },
      articles: [],
      collections: [{ slug: 'crm' }, { slug: 'getting-started' }],
    });

    assert.match(xml, /<loc>https:\/\/app\.example\.com\/api\/public\/v1\/content\/acme\/collections<\/loc>/);
    assert.match(xml, /<loc>https:\/\/app\.example\.com\/api\/public\/v1\/content\/acme\/articles\?collection=crm<\/loc>/);
    assert.match(xml, /<loc>https:\/\/app\.example\.com\/api\/public\/v1\/content\/acme\/articles\?collection=getting-started<\/loc>/);
  });
});

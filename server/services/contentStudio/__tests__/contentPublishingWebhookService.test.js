'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildWebhookPayload } = require('../contentPublishingWebhookService');

describe('contentPublishingWebhookService', () => {
  const originalPublicAppUrl = process.env.PUBLIC_APP_URL;

  it('builds publish payload with apiUrl', () => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';

    const payload = buildWebhookPayload({
      event: 'content.published',
      organization: { slug: 'acme' },
      document: {
        _id: '507f1f77bcf86cd799439011',
        addonKey: 'articles',
        contentType: 'knowledge_article',
        slug: 'reset-password',
        title: 'Reset your password',
        publishedAt: '2026-07-01T12:00:00.000Z',
        seo: { canonicalUrl: 'https://help.acme.com/reset-password' },
      },
    });

    assert.equal(payload.event, 'content.published');
    assert.equal(payload.organization.slug, 'acme');
    assert.equal(payload.content.slug, 'reset-password');
    assert.match(payload.content.apiUrl, /\/articles\/reset-password$/);
    assert.equal(payload.content.publicUrl, 'https://help.acme.com/reset-password');
    assert.match(payload.content.exportUrl, /\/articles\/reset-password\/export$/);
    assert.equal(payload.content.exportPath, '/help/reset-password/index.html');
    assert.deepEqual(payload.content.collectionPath, []);

    process.env.PUBLIC_APP_URL = originalPublicAppUrl;
  });

  it('includes static export fields when provided', () => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';

    const payload = buildWebhookPayload({
      event: 'content.published',
      organization: {
        slug: 'acme',
        embed: { articles: { publicKey: 'art_pub_testkey1234567890abcdef' } },
      },
      document: {
        slug: 'create-invoice',
        title: 'Create invoice',
        updatedAt: '2026-07-07T12:00:00.000Z',
      },
      staticExport: {
        updatedAt: '2026-07-07T12:00:00.000Z',
        exportUrl: 'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef/articles/create-invoice/export',
        exportPath: '/help/billing/invoices/create-invoice/index.html',
        collectionPath: ['billing', 'invoices'],
        refreshPages: [{ type: 'home', exportPath: '/help/index.html' }],
      },
    });

    assert.equal(payload.content.updatedAt, '2026-07-07T12:00:00.000Z');
    assert.equal(payload.content.exportPath, '/help/billing/invoices/create-invoice/index.html');
    assert.deepEqual(payload.content.collectionPath, ['billing', 'invoices']);
    assert.equal(payload.content.refreshPages.length, 1);

    process.env.PUBLIC_APP_URL = originalPublicAppUrl;
  });

  it('builds unpublish payload', () => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';

    const payload = buildWebhookPayload({
      event: 'content.unpublished',
      organization: { slug: 'acme' },
      document: {
        _id: '507f1f77bcf86cd799439011',
        addonKey: 'articles',
        slug: 'reset-password',
        title: 'Reset your password',
      },
    });

    assert.equal(payload.event, 'content.unpublished');
    assert.match(payload.content.apiUrl, /\/articles\/reset-password$/);

    process.env.PUBLIC_APP_URL = originalPublicAppUrl;
  });

  it('marks test payloads', () => {
    const payload = buildWebhookPayload({
      event: 'content.published',
      organization: { slug: 'acme' },
      document: {
        slug: 'example-article',
        title: 'Example',
      },
      test: true,
    });

    assert.equal(payload.test, true);
  });

  it('builds blog publish payload with blog apiUrl', () => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';

    const payload = buildWebhookPayload({
      event: 'content.published',
      organization: { slug: 'acme' },
      document: {
        _id: '507f1f77bcf86cd799439012',
        addonKey: 'blog',
        contentType: 'blog_post',
        slug: 'launch-announcement',
        title: 'Launch announcement',
        publishedAt: '2026-07-01T12:00:00.000Z',
        seo: { canonicalUrl: 'https://acme.com/blog/launch-announcement' },
      },
    });

    assert.equal(payload.content.addonKey, 'blog');
    assert.equal(payload.content.contentType, 'blog_post');
    assert.match(payload.content.apiUrl, /\/blog\/launch-announcement$/);
    assert.match(payload.content.exportUrl, /\/blog\/launch-announcement\/export$/);
    assert.equal(payload.content.exportPath, '/blog/launch-announcement/index.html');
    assert.equal(payload.content.refreshPages[0].type, 'home');
    assert.equal(payload.content.refreshPages[0].exportPath, '/blog/index.html');
    assert.equal(payload.content.publicUrl, 'https://acme.com/blog/launch-announcement');

    process.env.PUBLIC_APP_URL = originalPublicAppUrl;
  });
});

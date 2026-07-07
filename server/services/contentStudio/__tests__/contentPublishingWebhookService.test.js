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
});

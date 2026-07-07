'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  shapeHeadlessArticleSummary,
  shapeHeadlessArticleDetail,
  resolveAssetUrlsInBlocks,
} = require('../headlessContentShaper');

describe('headlessContentShaper', () => {
  it('shapes list summaries with id and no presentation fields', () => {
    const summary = shapeHeadlessArticleSummary({
      _id: '507f1f77bcf86cd799439011',
      title: 'Reset password',
      slug: 'reset-password',
      summary: 'How to reset',
      subtitle: 'Quick guide',
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      publishedAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    assert.equal(summary.id, '507f1f77bcf86cd799439011');
    assert.equal(summary.title, 'Reset password');
    assert.equal(summary.slug, 'reset-password');
    assert.equal(summary.summary, 'How to reset');
    assert.equal(summary.bodyHtml, undefined);
    assert.equal(summary.appearance, undefined);
    assert.equal(summary.presentation, undefined);
  });

  it('shapes detail payloads with blocks and without hosted presentation fields', async () => {
    const blocks = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello headless' }],
        },
      ],
    };

    const detail = await shapeHeadlessArticleDetail(
      {
        _id: '507f1f77bcf86cd799439011',
        organizationId: 'org-1',
        title: 'Reset password',
        slug: 'reset-password',
        subtitle: 'Guide',
        summary: 'Summary',
        seo: { metaTitle: 'Reset' },
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
        publishedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        blocks,
        authorName: 'Jane',
        collectionName: 'Account',
      },
    );

    assert.equal(detail.blocks.type, 'doc');
    assert.equal(detail.plainText, 'Hello headless');
    assert.equal(detail.authorName, 'Jane');
    assert.equal(detail.seo.metaTitle, 'Reset');
    assert.equal(detail.coverImage, null);
    assert.equal(detail.bodyHtml, undefined);
    assert.equal(detail.appearance, undefined);
    assert.equal(detail.presentation, undefined);
  });

  it('preserves src urls in blocks without asset lookup', async () => {
    const blocks = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { src: 'https://cdn.example.com/a.png', alt: 'Diagram' },
        },
      ],
    };

    const resolved = await resolveAssetUrlsInBlocks(blocks, 'org-1');
    assert.equal(resolved.content[0].attrs.src, 'https://cdn.example.com/a.png');
    assert.equal(resolved.content[0].attrs.alt, 'Diagram');
    assert.equal(resolved.content[0].attrs.assetId, undefined);
  });
});

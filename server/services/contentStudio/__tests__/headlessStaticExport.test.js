'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildArticleExportPath,
  buildCollectionExportPath,
  buildHomeExportPath,
  buildCustomerHref,
  buildExportPageHtml,
  buildRefreshPages,
  buildCustomerSitemapXml,
  buildSitemapEntriesFromManifest,
  buildManifestPageEntry,
  buildManifestArticleEntry,
  collectAssetIdsFromBlocks,
  collectAssetIdsFromDocument,
  resolveCollectionPathSlugs,
  buildCollectionByIdMap,
  resolveManifestVersion,
  blocksContainAssetId,
} = require('../headlessStaticExportService');
const {
  buildArticleExportUrl,
  buildHomeExportUrl,
  buildCollectionExportUrl,
  buildManifestUrl,
  buildPublicAssetDownloadUrl,
  buildStaticSitemapUrl,
} = require('../contentPublishingService');
const {
  signWebhookBody,
  verifyWebhookSignature,
  buildWebhookPayload,
} = require('../contentPublishingWebhookService');
const { verifyWebhook } = require('../../../../tools/help-sync/lib/verify');

describe('headlessStaticExportService', () => {
  const org = {
    slug: 'acme',
    embed: { articles: { publicKey: 'art_pub_testkey1234567890abcdef' } },
  };

  beforeEach(() => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
  });

  it('builds nested export paths from collection chain and slug', () => {
    assert.equal(
      buildArticleExportPath({
        slug: 'create-invoice',
        collectionPathSlugs: ['billing', 'invoices'],
      }),
      '/help/billing/invoices/create-invoice/index.html',
    );
  });

  it('resolves collection path slugs from parent chain', () => {
    const collectionById = buildCollectionByIdMap([
      { _id: 'crm', slug: 'crm', parentId: null },
      { _id: 'gs', slug: 'getting-started', parentId: 'crm' },
    ]);
    assert.deepEqual(resolveCollectionPathSlugs('gs', collectionById), ['crm', 'getting-started']);
  });

  it('collects asset ids from blocks and document seo/cover fields', () => {
    const blocks = {
      type: 'doc',
      content: [{ type: 'image', attrs: { assetId: 'img-1' } }],
    };
    const doc = { coverAssetId: 'cover-1', seo: { ogImageAssetId: 'og-1' } };
    assert.deepEqual(collectAssetIdsFromDocument(doc, blocks).sort(), ['cover-1', 'img-1', 'og-1']);
    assert.equal(blocksContainAssetId(blocks, 'img-1'), true);
  });

  it('builds export html with seo meta tags', () => {
    const html = buildExportPageHtml({
      article: {
        title: 'Create invoice',
        seo: { metaTitle: 'Create invoice | Help', metaDescription: 'Guide' },
      },
      bodyHtml: '<p>Body</p>',
    });
    assert.match(html, /<title>Create invoice \| Help<\/title>/);
  });

  it('builds manifest article entries with export urls', () => {
    const entry = buildManifestArticleEntry(org, {
      _id: '507f1f77bcf86cd799439011',
      slug: 'create-invoice',
      title: 'Create invoice',
      updatedAt: new Date('2026-07-07T12:00:00.000Z'),
    }, ['billing', 'invoices']);
    assert.equal(entry.exportPath, '/help/billing/invoices/create-invoice/index.html');
    assert.match(entry.exportUrl, /\/export$/);
  });

  it('resolves manifest version from latest article timestamp', () => {
    const version = resolveManifestVersion([
      { updatedAt: '2026-07-01T00:00:00.000Z' },
      { updatedAt: '2026-07-07T12:00:00.000Z' },
    ]);
    assert.equal(version, '2026-07-07T12:00:00.000Z');
  });
});

describe('headlessStaticExportService pages and sitemap', () => {
  const org = {
    slug: 'acme',
    embed: { articles: { publicKey: 'art_pub_testkey1234567890abcdef' } },
  };

  beforeEach(() => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
  });

  it('builds home and collection export paths', () => {
    assert.equal(buildHomeExportPath('/help/'), '/help/index.html');
    assert.equal(
      buildCollectionExportPath({ collectionPathSlugs: ['billing', 'invoices'] }),
      '/help/billing/invoices/index.html',
    );
    assert.equal(buildCustomerHref('/help/billing/index.html'), '/help/billing/');
  });

  it('builds refresh pages for article collection chain', () => {
    const pages = buildRefreshPages(['billing', 'invoices']);
    assert.deepEqual(pages.map((page) => page.type), ['home', 'collection', 'collection']);
    assert.equal(pages[2].slug, 'invoices');
    assert.equal(pages[2].parentSlug, 'billing');
  });

  it('builds manifest page entries with export urls', () => {
    const home = buildManifestPageEntry(org, { type: 'home' });
    assert.equal(home.type, 'home');
    assert.equal(home.exportUrl, buildHomeExportUrl(org));

    const collection = buildManifestPageEntry(org, {
      type: 'collection',
      slug: 'invoices',
      name: 'Invoices',
      collectionPath: ['billing', 'invoices'],
      parentSlug: 'billing',
    });
    assert.equal(collection.exportPath, '/help/billing/invoices/index.html');
    assert.equal(
      collection.exportUrl,
      buildCollectionExportUrl(org, 'invoices', { parentSlug: 'billing' }),
    );
  });

  it('builds customer sitemap xml from manifest entries', () => {
    const xml = buildCustomerSitemapXml({
      siteOrigin: 'https://xyz.com',
      entries: buildSitemapEntriesFromManifest({
        pages: [{ exportPath: '/help/index.html' }],
        articles: [{ exportPath: '/help/billing/invoices/create-invoice/index.html', updatedAt: '2026-07-07T12:00:00.000Z' }],
      }),
    });
    assert.match(xml, /<loc>https:\/\/xyz\.com\/help\/<\/loc>/);
    assert.match(xml, /create-invoice/);
  });
});

describe('contentPublishingService static export urls', () => {
  const originalPublicAppUrl = process.env.PUBLIC_APP_URL;
  const org = {
    slug: 'acme',
    embed: { articles: { publicKey: 'art_pub_testkey1234567890abcdef' } },
  };

  beforeEach(() => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
  });

  afterEach(() => {
    process.env.PUBLIC_APP_URL = originalPublicAppUrl;
  });

  it('builds manifest, export, and asset download urls', () => {
    assert.equal(
      buildManifestUrl(org),
      'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef/manifest.json',
    );
    assert.equal(
      buildArticleExportUrl(org, 'create-invoice'),
      'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef/articles/create-invoice/export',
    );
    assert.equal(
      buildPublicAssetDownloadUrl(org, 'asset-123'),
      'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef/assets/asset-123',
    );
  });
});

describe('contentPublishingService page export urls', () => {
  const org = {
    slug: 'acme',
    embed: { articles: { publicKey: 'art_pub_testkey1234567890abcdef' } },
  };

  beforeEach(() => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
  });

  it('builds home, collection, and static sitemap urls', () => {
    assert.equal(
      buildHomeExportUrl(org),
      'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef/export/home',
    );
    assert.equal(
      buildCollectionExportUrl(org, 'invoices', { parentSlug: 'billing' }),
      'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef/export/collections/invoices?parent=billing',
    );
    assert.equal(
      buildStaticSitemapUrl(org),
      'https://app.example.com/api/public/v1/content/art_pub_testkey1234567890abcdef/export/sitemap.xml',
    );
  });
});

describe('contentPublishingWebhookService signatures', () => {
  it('signs and verifies webhook bodies', () => {
    const body = JSON.stringify({ event: 'content.published' });
    const secret = 'test-secret';
    const signature = signWebhookBody(body, secret);
    assert.match(signature, /^sha256=/);
    assert.equal(verifyWebhookSignature(body, secret, signature), true);
    assert.equal(verifyWebhook(body, secret, signature), true);
    assert.equal(verifyWebhookSignature(body, secret, 'sha256=deadbeef'), false);
  });

  it('includes refreshPages in webhook payload', () => {
    const payload = buildWebhookPayload({
      event: 'content.published',
      organization: { slug: 'acme' },
      document: { slug: 'create-invoice', title: 'Create invoice' },
      staticExport: {
        updatedAt: '2026-07-07T12:00:00.000Z',
        exportUrl: 'https://example.com/export',
        exportPath: '/help/billing/invoices/create-invoice/index.html',
        collectionPath: ['billing', 'invoices'],
        refreshPages: buildRefreshPages(['billing', 'invoices']),
      },
    });
    assert.equal(payload.content.refreshPages.length, 3);
    assert.equal(payload.content.refreshPages[0].type, 'home');
  });
});

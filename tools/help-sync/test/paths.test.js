'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildExportPath,
  resolveDestinationFile,
  resolveAssetDestination,
  rewriteHtmlAssetUrls,
} = require('../lib/paths');

describe('help-sync paths', () => {
  it('builds export and asset destination paths', () => {
    assert.equal(
      buildExportPath({
        slug: 'create-invoice',
        collectionPath: ['billing', 'invoices'],
      }),
      '/help/billing/invoices/create-invoice/index.html',
    );
    assert.equal(
      resolveDestinationFile('/var/www/html', '/help/billing/invoices/create-invoice/index.html'),
      '/var/www/html/help/billing/invoices/create-invoice/index.html',
    );
    assert.equal(
      resolveAssetDestination('/var/www/html', '', 'asset-1.png'),
      '/var/www/html/help/assets/asset-1.png',
    );
  });

  it('rewrites asset urls in html', () => {
    const html = '<img src="https://app.arivu.com/api/public/v1/content/org/assets/a1" />';
    const map = new Map([
      ['https://app.arivu.com/api/public/v1/content/org/assets/a1', '/help/assets/a1.png'],
    ]);
    assert.equal(
      rewriteHtmlAssetUrls(html, map),
      '<img src="/help/assets/a1.png" />',
    );
  });
});

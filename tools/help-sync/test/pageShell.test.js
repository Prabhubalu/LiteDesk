'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildStaticPageHtml } = require('../lib/pageShell');

describe('help-sync page shell', () => {
  it('wraps body html with stylesheet and meta tags', () => {
    const html = buildStaticPageHtml({
      bodyHtml: '<div class="ld-help-home">Topics</div>',
      meta: {
        title: 'Help Center',
        description: 'Browse help topics',
      },
      apiOrigin: 'https://app.arivu.com',
      siteOrigin: 'https://www.example.com',
      canonicalPath: '/help/index.html',
    });

    assert.match(html, /<title>Help Center<\/title>/);
    assert.match(html, /headless-blocks\.css/);
    assert.match(html, /headless-blocks\.js/);
    assert.match(html, /ld-help-embed/);
    assert.match(html, /https:\/\/www\.example\.com\/help\//);
    assert.match(html, /Browse help topics/);
  });
});

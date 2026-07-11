'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeAppearance,
  wrapRenderedArticleHtml,
  defaultPresentationFromAppearance,
} = require('../articlesAppearanceService');

describe('articlesAppearanceService', () => {
  it('normalizes layout preset', () => {
    const appearance = normalizeAppearance({ layoutPreset: 'invalid', primaryColor: '#111111' });
    assert.equal(appearance.layoutPreset, 'classic');
    assert.equal(appearance.primaryColor, '#111111');
  });

  it('wraps rendered html with tenant appearance classes', () => {
    const html = wrapRenderedArticleHtml('<p>Hello</p>', {
      layoutPreset: 'help_center',
      primaryColor: '#123456',
    });
    assert.match(html, /content-studio-article--help_center/);
    assert.match(html, /--cs-primary:#123456/);
    assert.match(html, /<p>Hello<\/p>/);
  });

  it('maps default presentation from appearance', () => {
    const presentation = defaultPresentationFromAppearance({
      defaultCoverPosition: 'above-title',
      defaultSubtitleSize: 'lg',
    });
    assert.deepEqual(presentation, {
      coverPosition: 'above-title',
      subtitleSize: 'lg',
      titleOverlapCover: false,
    });
  });
});

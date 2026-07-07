'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mergePublicAppearance } = require('../articlesAppearanceService');

describe('mergePublicAppearance', () => {
  it('keeps Articles addon colors over Content Publishing brand defaults', () => {
    const appearance = mergePublicAppearance({
      layoutPreset: 'classic',
      primaryColor: '#000000',
      secondaryColor: '#3700ff',
      bodyFont: 'Georgia, serif',
      headingFont: 'Georgia, serif',
      contentWidth: 'wide',
      borderRadius: 'lg',
      defaultCoverPosition: 'below-title',
      defaultSubtitleSize: 'sm',
      showLogoInHeader: true,
      logoUrl: '',
    }, {
      settings: { logoUrl: 'https://cdn.example.com/org-logo.svg' },
      contentPublishing: {
        brandProfile: {
          primaryColor: '#4f46e5',
          secondaryColor: '#6366f1',
          bodyFont: 'Inter, system-ui, sans-serif',
          headingFont: 'Inter, system-ui, sans-serif',
          contentWidth: 'standard',
          borderRadius: 'md',
        },
      },
    });

    assert.equal(appearance.primaryColor, '#000000');
    assert.equal(appearance.secondaryColor, '#3700ff');
    assert.equal(appearance.bodyFont, 'Georgia, serif');
    assert.equal(appearance.contentWidth, 'wide');
    assert.equal(appearance.borderRadius, 'lg');
    assert.equal(appearance.logoUrl, 'https://cdn.example.com/org-logo.svg');
    assert.equal(appearance.showLogoInHeader, true);
  });

  it('uses addon logo when provided', () => {
    const appearance = mergePublicAppearance({
      primaryColor: '#111111',
      secondaryColor: '#222222',
      bodyFont: 'Inter, system-ui, sans-serif',
      headingFont: 'Inter, system-ui, sans-serif',
      contentWidth: 'standard',
      borderRadius: 'md',
      defaultCoverPosition: 'below-title',
      defaultSubtitleSize: 'md',
      showLogoInHeader: true,
      logoUrl: 'https://cdn.example.com/addon-logo.svg',
    }, {
      settings: { logoUrl: 'https://cdn.example.com/org-logo.svg' },
    });

    assert.equal(appearance.logoUrl, 'https://cdn.example.com/addon-logo.svg');
  });
});

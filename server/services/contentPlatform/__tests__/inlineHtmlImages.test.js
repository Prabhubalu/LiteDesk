'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  detectMimeType,
  normalizeManagedImageRef
} = require('../renderers/inlineHtmlImages');

describe('inlineHtmlImages helpers', () => {
  it('detects SVG with XML prolog', () => {
    const buffer = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
    assert.equal(detectMimeType(buffer, 'logo.svg'), 'image/svg+xml');
  });

  it('normalizes absolute API download URLs to managed refs', () => {
    const ref = normalizeManagedImageRef(
      'http://localhost:5173/api/files/download?storagePath=oci%3Auploads%2Forg%2Flogo.svg&token=abc'
    );
    assert.equal(
      ref,
      '/api/files/download?storagePath=oci%3Auploads%2Forg%2Flogo.svg&token=abc'
    );
  });

  it('ignores external CDN URLs for managed ref normalization', () => {
    assert.equal(
      normalizeManagedImageRef('https://cdn.example.com/logo.svg'),
      null
    );
  });
});

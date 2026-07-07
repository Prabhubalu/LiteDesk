'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeEmbedUrl, isEmbeddableUrl } = require('../normalizeEmbedUrl');

describe('normalizeEmbedUrl', () => {
  it('converts YouTube watch URLs to embed URLs', () => {
    assert.equal(
      normalizeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('converts youtu.be URLs to embed URLs', () => {
    assert.equal(
      normalizeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'),
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('preserves existing YouTube embed URLs', () => {
    const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    assert.equal(normalizeEmbedUrl(url), url);
  });

  it('returns empty string for YouTube homepage URLs', () => {
    assert.equal(normalizeEmbedUrl('https://www.youtube.com/'), '');
  });

  it('converts Vimeo page URLs to player URLs', () => {
    assert.equal(normalizeEmbedUrl('https://vimeo.com/123456789'), 'https://player.vimeo.com/video/123456789');
  });

  it('preserves Google Maps embed URLs', () => {
    const url = 'https://www.google.com/maps/embed?pb=abc123';
    assert.equal(normalizeEmbedUrl(url), url);
  });

  it('rejects generic page URLs that cannot be embedded', () => {
    assert.equal(normalizeEmbedUrl('https://example.com/widget'), '');
    assert.equal(normalizeEmbedUrl('https://tiptap.dev/'), '');
    assert.equal(normalizeEmbedUrl('https://tiptap.dev/docs/editor/extensions/nodes/audio'), '');
  });

  it('reports embeddability via isEmbeddableUrl', () => {
    assert.equal(isEmbeddableUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
    assert.equal(isEmbeddableUrl('https://tiptap.dev/'), false);
  });
});

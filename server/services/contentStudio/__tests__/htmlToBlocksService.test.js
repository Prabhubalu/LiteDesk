'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { htmlToBlocks } = require('../htmlToBlocksService');

describe('htmlToBlocksService', () => {
  it('returns empty doc for blank html', () => {
    const blocks = htmlToBlocks('');
    assert.equal(blocks.type, 'doc');
    assert.equal(blocks.content.length, 1);
    assert.equal(blocks.content[0].type, 'paragraph');
  });

  it('converts headings and paragraphs', () => {
    const blocks = htmlToBlocks('<h2>Title</h2><p>Body copy</p>');
    assert.equal(blocks.content[0].type, 'heading');
    assert.equal(blocks.content[0].attrs.level, 2);
    assert.equal(blocks.content[1].type, 'paragraph');
    assert.equal(blocks.content[1].content[0].text, 'Body copy');
  });

  it('converts unordered lists', () => {
    const blocks = htmlToBlocks('<ul><li>One</li><li>Two</li></ul>');
    assert.equal(blocks.content[0].type, 'bulletList');
    assert.equal(blocks.content[0].content.length, 2);
  });

  it('converts images', () => {
    const blocks = htmlToBlocks('<img src="https://cdn.example/a.png" alt="Diagram" />');
    assert.equal(blocks.content[0].type, 'image');
    assert.equal(blocks.content[0].attrs.src, 'https://cdn.example/a.png');
    assert.equal(blocks.content[0].attrs.alt, 'Diagram');
  });

  it('strips script tags', () => {
    const blocks = htmlToBlocks('<script>alert(1)</script><p>Safe</p>');
    assert.equal(blocks.content.length, 1);
    assert.equal(blocks.content[0].content[0].text, 'Safe');
  });
});

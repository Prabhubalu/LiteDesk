'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { renderBlocksToHtml, blocksToPlainText } = require('../contentStudioBlockRenderer');

describe('contentStudioBlockRenderer', () => {
  it('renders title, subtitle, and paragraph content', () => {
    const html = renderBlocksToHtml(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }],
          },
        ],
      },
      { title: 'Guide', subtitle: 'A short intro' },
    );

    assert.match(html, /<h1 class="content-title">Guide<\/h1>/);
    assert.match(html, /<p class="content-subtitle">A short intro<\/p>/);
    assert.match(html, /<p>Hello world<\/p>/);
  });

  it('renders marks, lists, and callouts', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Section' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'One', marks: [{ type: 'bold' }] }],
                },
              ],
            },
          ],
        },
        {
          type: 'callout',
          attrs: { variant: 'warning' },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Be careful' }],
            },
          ],
        },
      ],
    });

    assert.match(html, /<h2>Section<\/h2>/);
    assert.match(html, /<strong>One<\/strong>/);
    assert.match(html, /content-callout--warning/);
    assert.match(html, /Be careful/);
  });

  it('extracts plain text from nested blocks', () => {
    const text = blocksToPlainText({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First line' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second line' }],
        },
      ],
    });

    assert.equal(text, 'First line\nSecond line');
  });

  it('normalizes YouTube watch URLs when rendering embed blocks', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'embed',
          attrs: {
            src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            title: 'Video',
            height: 360,
          },
        },
      ],
    });

    assert.match(html, /src="https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ"/);
  });

  it('renders native audio elements for audio blocks', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'audio',
          attrs: {
            src: 'https://cdn.example.com/clip.mp3',
            controls: true,
          },
        },
      ],
    });

    assert.match(html, /<audio class="content-audio" src="https:\/\/cdn\.example\.com\/clip\.mp3" controls/);
    assert.doesNotMatch(html, /<figure[^>]*data-content-audio/);
  });

  it('renders table cells with styling attrs', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              attrs: { backgroundColor: '#f3f4f6' },
              content: [
                {
                  type: 'tableCell',
                  attrs: {
                    isHeader: true,
                    textColor: '#111827',
                    backgroundColor: '#dbeafe',
                    textAlign: 'center',
                    colWidth: '160px',
                  },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Name' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    assert.match(html, /background-color:#f3f4f6/);
    assert.match(html, /<th class="content-table-cell"/);
    assert.match(html, /color:#111827/);
    assert.match(html, /background-color:#dbeafe/);
    assert.match(html, /text-align:center/);
    assert.match(html, /width:160px/);
    assert.match(html, /Name/);
  });

  it('renders table with explicit width', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'table',
          attrs: { tableWidth: '420px' },
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Compact' }] }],
                },
              ],
            },
          ],
        },
      ],
    });

    assert.match(html, /data-table-width="420px"/);
    assert.match(html, /width:420px/);
    assert.match(html, /<div class="ld-table-scroll">/);
  });

  it('renders table colgroup from first-row column widths', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  attrs: { colwidth: [120] },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }],
                },
                {
                  type: 'tableCell',
                  attrs: { colwidth: [240] },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }],
                },
              ],
            },
          ],
        },
      ],
    });

    assert.match(html, /<colgroup><col style="width:120px" \/><col style="width:240px" \/><\/colgroup>/);
  });

  it('renders tabs with a tab bar and panels', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'tabs',
          content: [
            {
              type: 'tabItem',
              attrs: { label: 'Overview' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First tab' }] }],
            },
            {
              type: 'tabItem',
              attrs: { label: 'Details' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second tab' }] }],
            },
          ],
        },
      ],
    });

    assert.match(html, /class="content-tabs"/);
    assert.match(html, /class="content-tabs__bar"/);
    assert.match(html, /Overview/);
    assert.match(html, /Details/);
    assert.match(html, /First tab/);
    assert.match(html, /Second tab/);
    assert.match(html, /class="content-tabs__input" checked/);
  });

  it('renders gallery layouts with normalized carousel markup', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'gallery',
          attrs: { layout: 'slider' },
          content: [
            { type: 'image', attrs: { src: 'https://example.com/1.jpg', alt: 'One' } },
            { type: 'image', attrs: { src: 'https://example.com/2.jpg', alt: 'Two' } },
          ],
        },
      ],
    }, { bodyOnly: true });

    assert.match(html, /data-content-gallery=""/);
    assert.match(html, /class="content-gallery content-gallery--carousel"/);
    assert.match(html, /data-gallery-layout="carousel"/);
    assert.match(html, /class="content-gallery__viewport"/);
    assert.match(html, /class="content-gallery__controls"/);
  });

  it('renders grid gallery with inline grid layout', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'gallery',
          attrs: { layout: 'grid', padding: 9 },
          content: [
            { type: 'image', attrs: { src: 'https://example.com/1.jpg', alt: 'One' } },
            { type: 'image', attrs: { src: 'https://example.com/2.jpg', alt: 'Two' } },
          ],
        },
      ],
    }, { bodyOnly: true });

    assert.match(html, /class="content-gallery__viewport" style="display:grid/);
    assert.match(html, /style="padding:9px"/);
    assert.doesNotMatch(html, /style="padding:9px"[^>]*style="/);
  });

  it('renders scroll gallery with inline flex layout', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'gallery',
          attrs: { layout: 'scroll' },
          content: [
            { type: 'image', attrs: { src: 'https://example.com/1.jpg', alt: 'One' } },
            { type: 'image', attrs: { src: 'https://example.com/2.jpg', alt: 'Two' } },
          ],
        },
      ],
    }, { bodyOnly: true });

    assert.match(html, /style="display:flex/);
    assert.match(html, /class="content-gallery__viewport"/);
    assert.match(html, /width:min\(100%,320px\)/);
  });

  it('preserves spacing attrs and blank paragraphs without duplicate style attributes', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { marginTop: 32, marginBottom: 8, padding: 12, textAlign: 'center', lineHeight: '1.75' },
          content: [
            { type: 'text', text: 'Spaced' },
            { type: 'hardBreak' },
            { type: 'text', text: 'line' },
          ],
        },
        { type: 'paragraph', content: [] },
        { type: 'spacer', attrs: { height: 64, marginTop: 10, padding: 4 } },
        {
          type: 'image',
          attrs: {
            src: 'https://example.com/a.jpg',
            alt: 'a',
            marginTop: 20,
            padding: 8,
            width: '50%',
            textWrap: 'block',
            imagePosition: 'center',
          },
        },
      ],
    }, { bodyOnly: true });

    assert.match(html, /margin-top:32px/);
    assert.match(html, /margin-bottom:8px/);
    assert.match(html, /padding:12px/);
    assert.match(html, /text-align:center/);
    assert.match(html, /line-height:1\.75/);
    assert.match(html, /Spaced<br \/>line/);
    assert.match(html, /<p><br \/><\/p>/);
    assert.match(html, /class="content-spacer"[^>]*style="[^"]*height:64px/);
    assert.match(html, /height:64px[^"]*margin-top:10px|margin-top:10px[^"]*height:64px/);
    assert.match(html, /content-image-figure"[^>]*style="[^"]*width:50%/);
    assert.match(html, /margin-top:20px/);
    assert.doesNotMatch(html, /style="[^"]*"\s+style="/);
  });
});

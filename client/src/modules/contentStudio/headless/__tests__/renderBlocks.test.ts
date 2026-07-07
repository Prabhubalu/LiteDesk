import { describe, expect, it } from 'vitest';
import { blocksToPlainText, renderBlocksToHtml } from '../renderBlocks';
import { normalizeEmbedUrl } from '../normalizeEmbedUrl';

describe('headless renderBlocks', () => {
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

    expect(html).toContain('<h1>Guide</h1>');
    expect(html).toContain('<p>A short intro</p>');
    expect(html).toContain('<p>Hello world</p>');
  });

  it('renders marks, lists, and callouts without presentation classes', () => {
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

    expect(html).toContain('<h2 id="section">Section</h2>');
    expect(html).toContain('<strong>One</strong>');
    expect(html).toContain('<aside role="note" data-variant="warning">');
    expect(html).not.toContain('content-callout');
    expect(html).toContain('Be careful');
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

    expect(text).toBe('First line\nSecond line');
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

    expect(html).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(normalizeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ');
  });

  it('supports component overrides', () => {
    const html = renderBlocksToHtml(
      {
        type: 'doc',
        content: [
          {
            type: 'callout',
            attrs: { variant: 'info' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Custom' }] }],
          },
        ],
      },
      {
        components: {
          callout: () => '<div data-custom-callout>override</div>',
        },
      },
    );

    expect(html).toContain('data-custom-callout');
    expect(html).not.toContain('<aside');
  });
});

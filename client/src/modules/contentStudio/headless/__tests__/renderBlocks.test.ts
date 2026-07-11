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

  it('renders task lists with checklist classes', () => {
    const html = renderBlocksToHtml({
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Done' }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(html).toContain('class="content-checklist"');
    expect(html).toContain('class="content-checklist-item"');
    expect(html).toContain('checked');
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

  it('preserves editor spacing, typography, hard breaks, and blank paragraphs', () => {
    const html = renderBlocksToHtml(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: {
              marginTop: 24,
              marginBottom: 8,
              padding: 12,
              textAlign: 'center',
              fontSize: '18px',
              lineHeight: '1.75',
            },
            content: [
              { type: 'text', text: 'Line one' },
              { type: 'hardBreak' },
              { type: 'text', text: 'Line two' },
            ],
          },
          { type: 'paragraph', attrs: {}, content: [] },
          {
            type: 'spacer',
            attrs: { height: 64, marginTop: 10, padding: 4 },
          },
        ],
      },
      { bodyOnly: true },
    );

    expect(html).toContain('margin-top:24px');
    expect(html).toContain('margin-bottom:8px');
    expect(html).toContain('padding:12px');
    expect(html).toContain('text-align:center');
    expect(html).toContain('font-size:18px');
    expect(html).toContain('line-height:1.75');
    expect(html).toContain('Line one<br />Line two');
    expect(html).toContain('<p><br /></p>');
    expect(html).toContain('height:64px');
    expect(html).toContain('margin-top:10px');
    expect(html).not.toMatch(/style="[^"]*"\s+style="/);
  });
});

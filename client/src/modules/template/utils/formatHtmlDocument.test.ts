import { describe, expect, it } from 'vitest';
import { formatHtmlDocument, stripGrapesDocumentWrapper } from './formatHtmlDocument';

describe('stripGrapesDocumentWrapper', () => {
  it('unwraps nested body tags', () => {
    const input = '<body><body><div class="page">Hello</div></body></body>';
    expect(stripGrapesDocumentWrapper(input)).toBe('<div class="page">Hello</div>');
  });

  it('returns fragment html unchanged', () => {
    const input = '<div><p>Line item</p></div>';
    expect(stripGrapesDocumentWrapper(input)).toBe(input);
  });
});

describe('formatHtmlDocument', () => {
  it('indents nested html structure', () => {
    const input = `<!DOCTYPE html><html><head><style>.a{color:red}</style></head><body><div><p>Hi</p></div></body></html>`;
    const output = formatHtmlDocument(input);

    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toMatch(/\n\s+<div>/);
    expect(output).toMatch(/\n\s+<p>Hi<\/p>/);
    expect(output).not.toMatch(/<body><body>/);
  });
});

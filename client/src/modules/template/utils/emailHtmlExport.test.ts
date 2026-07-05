import { describe, expect, it } from 'vitest';
import {
  filterImportedDocumentCss,
  parseTemplateHtmlDocumentForCanvas
} from './emailHtmlExport';

describe('parseTemplateHtmlDocumentForCanvas', () => {
  it('extracts nested body html from a full document', () => {
    const input = `<!DOCTYPE html><html><head><style>.card { color: red; }</style></head><body><body><div class="card">Hi</div></body></body></html>`;
    const parsed = parseTemplateHtmlDocumentForCanvas(input, { isEmail: false });

    expect(parsed.html).toBe('<div class="card">Hi</div>');
  });
});

describe('filterImportedDocumentCss', () => {
  it('scopes document wrapper rules onto the print area', () => {
    const css = '@page { size: A4; } html, body { margin: 0; color: #111; } .title { font-size: 14px; }';
    expect(filterImportedDocumentCss(css)).toBe(
      '[data-print-area="true"] { margin: 0; color: #111; } .title { font-size: 14px; }'
    );
  });

  it('removes exported layout grid rules', () => {
    const css = '.title { font-size: 14px; }\n/* arivu-layout-grid */ .gjs-row { display: flex; }';
    expect(filterImportedDocumentCss(css)).toBe('.title { font-size: 14px; }');
  });
});

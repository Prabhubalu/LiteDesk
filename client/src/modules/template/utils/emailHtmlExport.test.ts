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
      '[data-print-area="true"] { color: #111; } .title { font-size: 14px; }'
    );
  });

  it('removes exported layout grid rules', () => {
    const css = '.title { font-size: 14px; }\n/* arivu-layout-grid */ .gjs-row { display: flex; }';
    expect(filterImportedDocumentCss(css)).toBe('.title { font-size: 14px; }');
  });

  it('rewrites A4 mm page boxes to fill the print area', () => {
    const css = '.a4-page { width: 210mm; height: 297mm; box-shadow: 0 0 10px #000; }';
    const filtered = filterImportedDocumentCss(css);
    expect(filtered).toContain('width: 100%');
    expect(filtered).toContain('height: auto');
    expect(filtered).toContain('box-shadow: none');
    expect(filtered).not.toContain('210mm');
    expect(filtered).not.toContain('297mm');
  });
});

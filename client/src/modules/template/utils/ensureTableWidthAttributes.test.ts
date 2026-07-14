import { describe, expect, it } from 'vitest';
import {
  ensureEmailTableCentering,
  ensureEmailCssCentersMaxWidthCards,
  ensureTableWidthAttributes,
  prepareEmailTableAttributes,
  wrapEmailContentInCenteringTable
} from './ensureTableWidthAttributes';

describe('ensureTableWidthAttributes', () => {
  it('adds width from style when attribute is missing', () => {
    const html = '<table style="width: 100%; border:0"><tr><td>x</td></tr></table>';
    expect(ensureTableWidthAttributes(html)).toContain('<table width="100%"');
  });

  it('defaults to 100% when neither attribute nor style width exist', () => {
    const html = '<table class="x"><tr><td>x</td></tr></table>';
    expect(ensureTableWidthAttributes(html)).toContain('<table width="100%"');
  });

  it('leaves existing width attributes alone', () => {
    const html = '<table width="600" style="width:600px"><tr><td>x</td></tr></table>';
    expect(ensureTableWidthAttributes(html)).toBe(html);
  });

  it('fixes multiple tables', () => {
    const html = '<table><tr><td>a</td></tr></table><table style="width:600px"><tr><td>b</td></tr></table>';
    const out = ensureTableWidthAttributes(html);
    expect(out.match(/<table width="/g)?.length).toBe(2);
    expect(out).toContain('width="600"');
  });
});

describe('ensureEmailTableCentering', () => {
  it('centers fixed-width card tables', () => {
    const html = '<table width="600"><tr><td>Hi</td></tr></table>';
    const out = ensureEmailTableCentering(html);
    expect(out).toContain('align="center"');
    expect(out).toContain('margin:0 auto');
  });

  it('does not force-center fluid 100% tables', () => {
    const html = '<table width="100%"><tr><td>Hi</td></tr></table>';
    expect(ensureEmailTableCentering(html)).toBe(html);
  });

  it('adds margin:auto even when align is already set', () => {
    const html = '<table align="center" width="600"><tr><td>Hi</td></tr></table>';
    const out = ensureEmailTableCentering(html);
    expect(out).toContain('align="center"');
    expect(out).toContain('margin:0 auto');
  });

  it('adds margin:auto for width=100% + max-width card', () => {
    const html =
      '<table align="center" width="100%" style="max-width:600px;width:100%"><tr><td>Hi</td></tr></table>';
    expect(ensureEmailTableCentering(html)).toContain('margin:0 auto');
  });
});

describe('ensureEmailCssCentersMaxWidthCards', () => {
  it('injects margin:auto into max-width card rules', () => {
    const css = '#iu32{max-width:600px;width:100%;background-color:#ffffff;}';
    expect(ensureEmailCssCentersMaxWidthCards(css)).toBe(
      '#iu32{margin:0 auto;max-width:600px;width:100%;background-color:#ffffff;}'
    );
  });

  it('leaves max-width:100% rules alone', () => {
    const css = 'img{max-width:100%;}';
    expect(ensureEmailCssCentersMaxWidthCards(css)).toBe(css);
  });
});

describe('prepareEmailTableAttributes', () => {
  it('adds width and centers fixed cards, then wraps in a Gmail centering shell', () => {
    const html = '<table style="width:600px"><tr><td>Hi</td></tr></table>';
    const out = prepareEmailTableAttributes(html);
    expect(out).toContain('width="600"');
    expect(out).toContain('align="center"');
    expect(out).toContain('data-arivu-email-center="true"');
    expect(out).toContain('<td align="center"');
  });

  it('centers parent td of a fixed card inside a fluid outer table', () => {
    const html =
      '<table width="100%"><tr><td style="padding:20px 0;"><table width="600"><tr><td align="center">Happy Birthday!</td></tr></table></td></tr></table>';
    const out = prepareEmailTableAttributes(html);
    expect(out).toMatch(/<td align="center"[^>]*style="text-align:center;padding:20px 0;"/i);
    expect(out).toContain('width="600"');
    // Must not skip just because an inner header cell is align=center
    expect(out.match(/<td align="center"/gi)?.length).toBeGreaterThanOrEqual(2);
  });

  it('centers parent td when a div or comment sits between the cell and card', () => {
    const withDiv =
      '<table width="100%"><tr><td style="padding:20px"><div><table width="600"><tr><td>Hi</td></tr></table></div></td></tr></table>';
    const withComment =
      '<table width="100%"><tr><td><!--x--><table width="600"><tr><td>Hi</td></tr></table></td></tr></table>';
    expect(prepareEmailTableAttributes(withDiv)).toMatch(/<td align="center"[^>]*padding:20px/i);
    expect(prepareEmailTableAttributes(withComment)).toMatch(/<td align="center"/i);
  });

  it('does not double-wrap an existing root centering shell', () => {
    const html =
      '<table width="100%"><tr><td align="center"><table width="600"><tr><td>Hi</td></tr></table></td></tr></table>';
    const out = prepareEmailTableAttributes(html);
    expect(out.match(/data-arivu-email-center/g)).toBeNull();
    expect(out).toContain('width="600"');
  });
});

describe('wrapEmailContentInCenteringTable', () => {
  it('wraps a left-aligned fixed card for Gmail', () => {
    const html = '<table width="600" align="center" style="margin:0 auto"><tr><td>Card</td></tr></table>';
    const out = wrapEmailContentInCenteringTable(html);
    expect(out).toContain('data-arivu-email-center="true"');
    expect(out).toContain('width="100%"');
    expect(out).toContain('<td align="center"');
    expect(out).toContain(html);
  });
});

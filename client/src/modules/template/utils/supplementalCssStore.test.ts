import { describe, expect, it } from 'vitest';
import {
  cssRulesNotIn,
  dedupeCssRules,
  mergeExportedCss,
  resolveSupplementalCssForProjectLoad
} from '../editor/supplementalCssStore';

describe('dedupeCssRules', () => {
  it('removes repeated minified rule blocks', () => {
    const chunk = '*{box-sizing:border-box;}body{margin:0;}';
    const bloated = chunk.repeat(5);
    expect(dedupeCssRules(bloated)).toBe(chunk);
  });

  it('preserves distinct rules', () => {
    const css = '.a { color: red; } .b { color: blue; }';
    expect(dedupeCssRules(css)).toBe('.a { color: red; }.b { color: blue; }');
  });

  it('preserves nested @media blocks as single units', () => {
    const css = '@media print { .page { width: 100%; } } .page { width: 50%; }';
    expect(dedupeCssRules(`${css}${css}`)).toBe(
      '@media print { .page { width: 100%; } }.page { width: 50%; }'
    );
  });
});

describe('cssRulesNotIn', () => {
  it('returns rules missing from the exclude stylesheet', () => {
    const grapes = '.a { color: red; }';
    const stored = '.a { color: red; } .imported { padding: 8px; }';
    expect(cssRulesNotIn(stored, grapes)).toBe('.imported { padding: 8px; }');
  });
});

describe('resolveSupplementalCssForProjectLoad', () => {
  it('returns empty css when stored export matches grapes styles', () => {
    const css = '.quote { color: navy; }';
    expect(resolveSupplementalCssForProjectLoad(css, css)).toBe('');
  });

  it('dedupes bloated stored css before diffing against grapes styles', () => {
    const chunk = '*{box-sizing:border-box;}body{margin:0;}';
    const grapes = `${chunk}.quote { color: navy; }`;
    const stored = `${chunk.repeat(4)}${grapes}`;
    expect(resolveSupplementalCssForProjectLoad(stored, grapes)).toBe('');
  });
});

describe('mergeExportedCss', () => {
  it('prefers the richer stylesheet when one contains the other', () => {
    const extra = '.table td { padding: 12px; }';
    const base = `${extra}#id123 { color: red; }`;
    expect(mergeExportedCss(base, extra)).toBe(base);
  });

  it('combines unrelated css blocks', () => {
    expect(mergeExportedCss('.a { color: red; }', '.b { color: blue; }')).toBe(
      '.a { color: red; }.b { color: blue; }'
    );
  });

  it('dedupes when supplemental repeats grapes css', () => {
    const chunk = '*{box-sizing:border-box;}body{margin:0;}';
    const grapes = `${chunk}.quote { color: navy; }`;
    const supplemental = `${chunk.repeat(3)}.quote { color: navy; }`;
    expect(mergeExportedCss(grapes, supplemental)).toBe(grapes);
  });
});

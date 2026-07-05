import type { Editor } from 'grapesjs';
import { stripLayoutGridExportCss } from './layoutGridCss';

const SUPPLEMENTAL_STYLE_ID = 'arivu-supplemental-css';

const supplementalCssByEditor = new WeakMap<Editor, string>();

export function setSupplementalCss(editor: Editor, css: string): void {
  const value = String(css || '').trim();
  if (value) {
    supplementalCssByEditor.set(editor, value);
    return;
  }
  supplementalCssByEditor.delete(editor);
}

export function getSupplementalCss(editor: Editor): string {
  return supplementalCssByEditor.get(editor) || '';
}

export function clearSupplementalCss(editor: Editor): void {
  supplementalCssByEditor.delete(editor);
  injectSupplementalCanvasCss(editor, '');
}

export function injectSupplementalCanvasCss(editor: Editor, css: string): void {
  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (!doc) return;

  let styleEl = doc.getElementById(SUPPLEMENTAL_STYLE_ID);
  const nextCss = String(css || '').trim();

  if (!nextCss) {
    styleEl?.remove();
    return;
  }

  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = SUPPLEMENTAL_STYLE_ID;
    doc.head.appendChild(styleEl);
  }

  styleEl.textContent = nextCss;
}

function findMatchingBrace(source: string, openIndex: number): number {
  if (source[openIndex] !== '{') return openIndex;
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return source.length - 1;
}

/** Split CSS into top-level rule blocks, preserving nested @media/@page blocks. */
export function tokenizeCssRules(css: string): string[] {
  const source = String(css || '').trim();
  if (!source) return [];

  const rules: string[] = [];
  let index = 0;

  while (index < source.length) {
    while (index < source.length && /\s/.test(source.charAt(index))) index += 1;
    if (index >= source.length) break;

    const braceIndex = source.indexOf('{', index);
    if (braceIndex === -1) break;

    const endIndex = findMatchingBrace(source, braceIndex);
    rules.push(source.slice(index, endIndex + 1).trim());
    index = endIndex + 1;
  }

  return rules;
}

function normalizeCssRuleKey(rule: string): string {
  return rule.replace(/\s+/g, '').toLowerCase();
}

/** Collapse repeated rule blocks produced by save/load CSS re-merge cycles. */
export function dedupeCssRules(css: string): string {
  const rules = tokenizeCssRules(css);
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const rule of rules) {
    const key = normalizeCssRuleKey(rule);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(rule);
  }

  return unique.join('');
}

/** Return rules present in sourceCss but not in excludeCss. */
export function cssRulesNotIn(sourceCss: string, excludeCss: string): string {
  const excludeKeys = new Set(
    tokenizeCssRules(excludeCss).map(normalizeCssRuleKey)
  );

  return tokenizeCssRules(sourceCss)
    .filter((rule) => {
      const key = normalizeCssRuleKey(rule);
      return key && !excludeKeys.has(key);
    })
    .join('');
}

/**
 * After loading Grapes project data, reinject only CSS that is not already
 * represented in editor.getCss() (e.g. HTML-imported rules).
 */
export function resolveSupplementalCssForProjectLoad(
  storedCss: string,
  grapesCss: string
): string {
  const stored = dedupeCssRules(stripLayoutGridExportCss(storedCss));
  const grapes = dedupeCssRules(String(grapesCss || '').trim());
  if (!stored) return '';
  if (!grapes) return stored;
  return cssRulesNotIn(stored, grapes);
}

export function mergeExportedCss(grapesCss: string, supplementalCss: string): string {
  const base = dedupeCssRules(String(grapesCss || '').trim());
  const extra = dedupeCssRules(String(supplementalCss || '').trim());
  if (!extra) return base;
  if (!base) return extra;
  if (base.includes(extra)) return base;
  if (extra.includes(base)) return extra;
  return dedupeCssRules(`${base}\n${extra}`.trim());
}

export function bindSupplementalCss(editor: Editor): void {
  const reinject = () => {
    const css = getSupplementalCss(editor);
    if (css) {
      injectSupplementalCanvasCss(editor, css);
    }
  };

  editor.on('canvas:frame:load', reinject);
  editor.on('load', reinject);
}

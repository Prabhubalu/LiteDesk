import { describe, expect, it } from 'vitest';
import { mergeWebformBranding, sanitizeHexColor, webformBrandingCssVars } from '@/utils/webformBranding';

describe('webformBranding', () => {
  it('sanitizes hex colors', () => {
    expect(sanitizeHexColor('#abc')).toBe('#aabbcc');
    expect(sanitizeHexColor('invalid', '#2563eb')).toBe('#2563eb');
  });

  it('merges branding defaults', () => {
    const merged = mergeWebformBranding({ themeColor: '#ff0000', fontFamily: 'serif', logoPosition: 'left', logoSize: 'lg' });
    expect(merged.themeColor).toBe('#ff0000');
    expect(merged.fontFamily).toBe('serif');
    expect(merged.logoUrl).toBe('');
    expect(merged.logoPosition).toBe('left');
    expect(merged.logoSize).toBe('lg');
  });

  it('exposes css vars for accent and font', () => {
    const vars = webformBrandingCssVars({ themeColor: '#112233', fontFamily: 'mono' });
    expect(vars['--wf-accent']).toBe('#112233');
    expect(String(vars['--wf-font-family'])).toContain('monospace');
  });
});

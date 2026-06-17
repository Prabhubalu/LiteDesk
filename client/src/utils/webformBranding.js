export const WEBFORM_FONT_FAMILIES = ['system', 'serif', 'mono'];
export const DEFAULT_WEBFORM_THEME_COLOR = '#2563eb';

const FONT_STACKS = Object.freeze({
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
});

function expandShortHex(hex) {
  const value = String(hex || '').trim().toLowerCase();
  if (!/^#[0-9a-f]{3}$/.test(value)) return value;
  return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
}

export function sanitizeHexColor(value, fallback = '') {
  const normalized = expandShortHex(value);
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
  return fallback;
}

export function defaultWebformBranding() {
  return {
    logoUrl: '',
    themeColor: DEFAULT_WEBFORM_THEME_COLOR,
    backgroundColor: '',
    fontFamily: 'system'
  };
}

export function mergeWebformBranding(raw) {
  const defaults = defaultWebformBranding();
  const source = raw && typeof raw === 'object' ? raw : {};
  const themeColor = sanitizeHexColor(source.themeColor, defaults.themeColor);
  const backgroundColor = sanitizeHexColor(source.backgroundColor, '');
  return {
    logoUrl: String(source.logoUrl || '').trim(),
    themeColor,
    backgroundColor,
    fontFamily: WEBFORM_FONT_FAMILIES.includes(source.fontFamily)
      ? source.fontFamily
      : defaults.fontFamily
  };
}

export function webformFontFamilyCss(fontFamily) {
  return FONT_STACKS[fontFamily] || FONT_STACKS.system;
}

export function webformBrandingCssVars(branding) {
  const merged = mergeWebformBranding(branding);
  return {
    '--wf-accent': merged.themeColor,
    '--wf-font-family': webformFontFamilyCss(merged.fontFamily)
  };
}

export function webformSurfaceStyle(branding, { embed = false } = {}) {
  const merged = mergeWebformBranding(branding);
  const style = {
    ...webformBrandingCssVars(merged),
    fontFamily: 'var(--wf-font-family)'
  };
  if (merged.backgroundColor) {
    style.backgroundColor = merged.backgroundColor;
  } else if (!embed) {
    style.backgroundColor = '';
  }
  return style;
}

export function webformFormCardStyle(branding) {
  const merged = mergeWebformBranding(branding);
  if (!merged.backgroundColor) return {};
  return {
    backgroundColor: '#ffffff'
  };
}

export function webformFieldFocusClass() {
  return 'border-gray-300 focus:border-[var(--wf-accent)] focus:ring-[var(--wf-accent)] dark:border-gray-600';
}

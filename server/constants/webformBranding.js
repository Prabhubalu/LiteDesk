'use strict';

const WEBFORM_FONT_FAMILIES = ['system', 'serif', 'mono'];
const DEFAULT_WEBFORM_THEME_COLOR = '#2563eb';

function expandShortHex(hex) {
  const value = String(hex || '').trim().toLowerCase();
  if (!/^#[0-9a-f]{3}$/.test(value)) return value;
  return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
}

function sanitizeHexColor(value, fallback = '') {
  const normalized = expandShortHex(value);
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
  return fallback;
}

function sanitizeWebformBranding(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const themeColor = sanitizeHexColor(source.themeColor, DEFAULT_WEBFORM_THEME_COLOR);
  const backgroundColor = sanitizeHexColor(source.backgroundColor, '');
  return {
    logoUrl: String(source.logoUrl || '').trim(),
    themeColor,
    backgroundColor,
    fontFamily: WEBFORM_FONT_FAMILIES.includes(source.fontFamily)
      ? source.fontFamily
      : 'system'
  };
}

module.exports = {
  WEBFORM_FONT_FAMILIES,
  DEFAULT_WEBFORM_THEME_COLOR,
  sanitizeHexColor,
  sanitizeWebformBranding
};

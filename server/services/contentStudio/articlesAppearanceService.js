'use strict';

const { ADDON_KEYS } = require('../../constants/addonKeys');
const { ADDON_DEFAULT_SETTINGS } = require('../../constants/contentStudioConstants');

const LAYOUT_PRESETS = ['classic', 'help_center', 'minimal'];
const CONTENT_WIDTHS = ['narrow', 'standard', 'wide'];
const BORDER_RADIUS = ['none', 'sm', 'md', 'lg'];
const COVER_POSITIONS = ['above-title', 'below-title'];
const SUBTITLE_SIZES = ['sm', 'md', 'lg', 'xl'];

const CONTENT_WIDTH_PX = {
  narrow: '680px',
  standard: '768px',
  wide: '960px',
};

const BORDER_RADIUS_PX = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '16px',
};

function normalizeAppearance(raw = {}) {
  const defaults = ADDON_DEFAULT_SETTINGS[ADDON_KEYS.ARTICLES]?.appearance || {};
  const merged = { ...defaults, ...(raw || {}) };
  return {
    layoutPreset: LAYOUT_PRESETS.includes(merged.layoutPreset) ? merged.layoutPreset : defaults.layoutPreset,
    primaryColor: String(merged.primaryColor || defaults.primaryColor || '#4f46e5').trim(),
    secondaryColor: String(merged.secondaryColor || defaults.secondaryColor || '#6366f1').trim(),
    bodyFont: String(merged.bodyFont || defaults.bodyFont || 'Inter, system-ui, sans-serif').trim(),
    headingFont: String(merged.headingFont || defaults.headingFont || 'Inter, system-ui, sans-serif').trim(),
    contentWidth: CONTENT_WIDTHS.includes(merged.contentWidth) ? merged.contentWidth : defaults.contentWidth,
    borderRadius: BORDER_RADIUS.includes(merged.borderRadius) ? merged.borderRadius : defaults.borderRadius,
    defaultCoverPosition: COVER_POSITIONS.includes(merged.defaultCoverPosition)
      ? merged.defaultCoverPosition
      : defaults.defaultCoverPosition,
    defaultSubtitleSize: SUBTITLE_SIZES.includes(merged.defaultSubtitleSize)
      ? merged.defaultSubtitleSize
      : defaults.defaultSubtitleSize,
    showLogoInHeader: merged.showLogoInHeader === true,
    logoUrl: String(merged.logoUrl || '').trim(),
  };
}

function buildAppearanceAttributes(appearance) {
  const normalized = normalizeAppearance(appearance);
  const className = [
    'content-studio-article',
    `content-studio-article--${normalized.layoutPreset}`,
    normalized.showLogoInHeader ? 'content-studio-article--with-logo' : '',
  ].filter(Boolean).join(' ');

  const style = [
    `--cs-primary:${normalized.primaryColor}`,
    `--cs-secondary:${normalized.secondaryColor}`,
    `--cs-body-font:${normalized.bodyFont}`,
    `--cs-heading-font:${normalized.headingFont}`,
    `--cs-content-max-width:${CONTENT_WIDTH_PX[normalized.contentWidth] || CONTENT_WIDTH_PX.standard}`,
    `--cs-border-radius:${BORDER_RADIUS_PX[normalized.borderRadius] || BORDER_RADIUS_PX.md}`,
  ].join(';');

  return { className, style, appearance: normalized };
}

function wrapRenderedArticleHtml(html, appearance) {
  const safeHtml = String(html || '').trim();
  if (!safeHtml) return safeHtml;

  const { className, style, appearance: normalized } = buildAppearanceAttributes(appearance);
  const logoHtml = normalized.showLogoInHeader && normalized.logoUrl
    ? `<div class="content-studio-article__brand"><img src="${normalized.logoUrl.replace(/"/g, '&quot;')}" alt="" class="content-studio-article__logo" /></div>`
    : '';

  return `<div class="${className}" style="${style}">${logoHtml}<div class="content-studio-article__body"><div class="content-studio-tiptap">${safeHtml}</div></div></div>`;
}

function mergePublicAppearance(addonAppearance, organization = {}) {
  const logoUrl = String(addonAppearance?.logoUrl || '').trim()
    || String(organization?.settings?.logoUrl || '').trim();

  return normalizeAppearance({
    ...addonAppearance,
    logoUrl,
    showLogoInHeader: addonAppearance?.showLogoInHeader || Boolean(logoUrl),
  });
}

function defaultPresentationFromAppearance(appearance) {
  const normalized = normalizeAppearance(appearance);
  return {
    coverPosition: normalized.defaultCoverPosition,
    subtitleSize: normalized.defaultSubtitleSize,
    titleOverlapCover: false,
  };
}

module.exports = {
  LAYOUT_PRESETS,
  CONTENT_WIDTHS,
  BORDER_RADIUS,
  normalizeAppearance,
  buildAppearanceAttributes,
  wrapRenderedArticleHtml,
  mergePublicAppearance,
  defaultPresentationFromAppearance,
};

import {
  normalizeContentStudioContentWidth,
  type ContentStudioContentWidth,
} from '../editor/articlePresentation';

export interface ContentStudioArticleAppearance {
  layoutPreset: 'classic' | 'help_center' | 'minimal';
  primaryColor: string;
  secondaryColor: string;
  bodyFont: string;
  headingFont: string;
  contentWidth: ContentStudioContentWidth;
  borderRadius: 'none' | 'sm' | 'md' | 'lg';
  defaultCoverPosition: 'above-title' | 'below-title';
  defaultSubtitleSize: 'sm' | 'md' | 'lg' | 'xl';
  showLogoInHeader: boolean;
  logoUrl: string;
}

const LAYOUT_PRESETS = ['classic', 'help_center', 'minimal'] as const;
const BORDER_RADIUS = ['none', 'sm', 'md', 'lg'] as const;

const CONTENT_WIDTH_PX: Record<ContentStudioContentWidth, string> = {
  narrow: '680px',
  standard: '768px',
  wide: '960px',
};

const BORDER_RADIUS_PX: Record<ContentStudioArticleAppearance['borderRadius'], string> = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '16px',
};

const DEFAULT_APPEARANCE: ContentStudioArticleAppearance = {
  layoutPreset: 'classic',
  primaryColor: '#4f46e5',
  secondaryColor: '#6366f1',
  bodyFont: 'Inter, system-ui, sans-serif',
  headingFont: 'Inter, system-ui, sans-serif',
  contentWidth: 'standard',
  borderRadius: 'md',
  defaultCoverPosition: 'below-title',
  defaultSubtitleSize: 'md',
  showLogoInHeader: false,
  logoUrl: '',
};

export function normalizeArticleAppearance(raw: Partial<ContentStudioArticleAppearance> | null | undefined): ContentStudioArticleAppearance {
  const merged = { ...DEFAULT_APPEARANCE, ...(raw || {}) };
  return {
    layoutPreset: LAYOUT_PRESETS.includes(merged.layoutPreset as typeof LAYOUT_PRESETS[number])
      ? merged.layoutPreset
      : DEFAULT_APPEARANCE.layoutPreset,
    primaryColor: String(merged.primaryColor || DEFAULT_APPEARANCE.primaryColor).trim(),
    secondaryColor: String(merged.secondaryColor || DEFAULT_APPEARANCE.secondaryColor).trim(),
    bodyFont: String(merged.bodyFont || DEFAULT_APPEARANCE.bodyFont).trim(),
    headingFont: String(merged.headingFont || DEFAULT_APPEARANCE.headingFont).trim(),
    contentWidth: normalizeContentStudioContentWidth(merged.contentWidth),
    borderRadius: BORDER_RADIUS.includes(merged.borderRadius as typeof BORDER_RADIUS[number])
      ? merged.borderRadius
      : DEFAULT_APPEARANCE.borderRadius,
    defaultCoverPosition: merged.defaultCoverPosition === 'above-title' ? 'above-title' : 'below-title',
    defaultSubtitleSize: ['sm', 'md', 'lg', 'xl'].includes(merged.defaultSubtitleSize)
      ? merged.defaultSubtitleSize
      : DEFAULT_APPEARANCE.defaultSubtitleSize,
    showLogoInHeader: merged.showLogoInHeader === true,
    logoUrl: String(merged.logoUrl || '').trim(),
  };
}

export function buildArticleAppearanceShell(appearance: Partial<ContentStudioArticleAppearance> | null | undefined) {
  const normalized = normalizeArticleAppearance(appearance);
  const className = [
    'content-studio-article',
    `content-studio-article--${normalized.layoutPreset}`,
    normalized.showLogoInHeader ? 'content-studio-article--with-logo' : '',
  ].filter(Boolean).join(' ');

  const style = {
    '--cs-primary': normalized.primaryColor,
    '--cs-secondary': normalized.secondaryColor,
    '--cs-body-font': normalized.bodyFont,
    '--cs-heading-font': normalized.headingFont,
    '--cs-content-max-width': CONTENT_WIDTH_PX[normalized.contentWidth],
    '--cs-border-radius': BORDER_RADIUS_PX[normalized.borderRadius],
    fontFamily: normalized.bodyFont,
  } as Record<string, string>;

  return {
    appearance: normalized,
    className,
    style,
    canvasStyle: { maxWidth: CONTENT_WIDTH_PX[normalized.contentWidth] },
  };
}

import { getApiUrlForFetch } from '@/config/apiBase';

export function resolvePublicAssetUrl(url: string): string {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return getApiUrlForFetch(value);
  return value;
}

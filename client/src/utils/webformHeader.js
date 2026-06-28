import { resolveWebformImageUrl } from '@/utils/webformFormatters';
import { mergeWebformBranding, sanitizeHexColor } from '@/utils/webformBranding';

export const WEBFORM_LOGO_POSITIONS = ['center', 'left', 'right'];
export const WEBFORM_LOGO_SIZES = ['sm', 'md', 'lg', 'xl'];

const LOGO_SIZE_CLASSES = Object.freeze({
  sm: 'max-h-8',
  md: 'max-h-12',
  lg: 'max-h-16',
  xl: 'max-h-20'
});

const POSITION_ALIGN_CLASSES = Object.freeze({
  center: 'items-center text-center',
  left: 'items-start text-left',
  right: 'items-end text-right'
});

export function webformLogoSizeClass(logoSize) {
  return LOGO_SIZE_CLASSES[logoSize] || LOGO_SIZE_CLASSES.md;
}

export function webformHeaderContentAlignClass(logoPosition) {
  return POSITION_ALIGN_CLASSES[logoPosition] || POSITION_ALIGN_CLASSES.center;
}

export function webformHeaderHasBackground(webform) {
  const image = String(webform?.headerImageUrl || '').trim();
  const color = sanitizeHexColor(webform?.headerBackgroundColor, '');
  return Boolean(image || color);
}

export function webformHeaderBackgroundStyle(webform) {
  const image = String(webform?.headerImageUrl || '').trim();
  const color = sanitizeHexColor(webform?.headerBackgroundColor, '');

  if (image) {
    const url = resolveWebformImageUrl(image);
    if (url) {
      return {
        backgroundImage: `url("${url.replace(/"/g, '%22')}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
  }

  if (color) {
    return { backgroundColor: color };
  }

  return {};
}

export function webformHeadingColorStyle(branding, { hasBackground = false } = {}) {
  const merged = mergeWebformBranding(branding);
  if (merged.headingColor) {
    return { color: merged.headingColor };
  }
  if (hasBackground) {
    return { color: '#ffffff' };
  }
  return {};
}

export function webformHeadingDefaultClass(branding, { hasBackground = false } = {}) {
  const merged = mergeWebformBranding(branding);
  if (merged.headingColor || hasBackground) return '';
  return 'text-gray-900 dark:text-white';
}

export function webformDescriptionColorClass(branding, { hasBackground = false } = {}) {
  const merged = mergeWebformBranding(branding);
  if (merged.headingColor || hasBackground) {
    return 'text-white/80';
  }
  return 'text-gray-600 dark:text-gray-400';
}

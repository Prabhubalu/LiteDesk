import { resolveAssetDownloadUrl } from '../composables/useCompanyLogoAsset';

const IMG_TAG_PATTERN = /<img\b([^>]*?)>/gi;
const SRC_ATTR_PATTERN = /\ssrc=(["'])([^"']+)\1/i;

function isLogoMergeToken(src: string): boolean {
  return /\{\{[^}]+\}\}/.test(src) && /logourl/i.test(src);
}

function resolvePreviewImageSrc(src: string, fallbackLogoUrl: string): string {
  const trimmed = String(src || '').trim();
  if (!trimmed || trimmed.startsWith('data:')) return trimmed;

  if (isLogoMergeToken(trimmed)) {
    if (fallbackLogoUrl) {
      return resolveAssetDownloadUrl(fallbackLogoUrl);
    }
    return trimmed;
  }

  if (/\{\{[^}]+\}\}/.test(trimmed)) {
    return trimmed;
  }

  return resolveAssetDownloadUrl(trimmed);
}

/** Rewrite img src values so sandboxed preview iframes can load authenticated assets. */
export function resolvePreviewHtmlImageUrls(
  html: string,
  fallbackLogoUrl = ''
): string {
  return String(html || '').replace(IMG_TAG_PATTERN, (full, attrs) => {
    const srcMatch = attrs.match(SRC_ATTR_PATTERN);
    if (!srcMatch) return full;

    const quote = srcMatch[1];
    const src = srcMatch[2];
    const resolved = resolvePreviewImageSrc(src, fallbackLogoUrl);
    if (resolved === src) return full;

    const nextAttrs = attrs.replace(SRC_ATTR_PATTERN, ` src=${quote}${resolved}${quote}`);
    return `<img${nextAttrs}>`;
  });
}

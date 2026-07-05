import type { Component, Editor } from 'grapesjs';
import { formatMergeToken } from './mergeTokens';
import { applyImageSrcToComponent, refreshCanvasImageSources } from './canvasImageSrc';
import {
  resolveAssetDownloadUrl,
  stripAuthTokenFromDownloadUrl
} from '../composables/useCompanyLogoAsset';

const LOGO_MERGE_PATH = 'CurrentOrganization.logoUrl';

const LOGO_MERGE_PATH_ALIASES = new Set([
  'currentorganization.logourl',
  'currentorganization.settings.logourl',
  'organization.logourl',
  'organization.settings.logourl'
]);

function normalizeMergePath(path: string): string {
  return String(path || '').replace(/^\{\{|\}\}$/g, '').trim();
}

function isLogoMergePath(path: string): boolean {
  const normalized = normalizeMergePath(path).toLowerCase();
  if (LOGO_MERGE_PATH_ALIASES.has(normalized)) return true;
  return normalized.endsWith('.logourl') || normalized.endsWith('.settings.logourl');
}

function isMergeTokenSrc(src: string): boolean {
  const trimmed = String(src || '').trim();
  if (!trimmed.includes('{{')) return false;
  return isLogoMergePath(trimmed);
}

function isLogoComponent(component: Component): boolean {
  const attrs = component.getAttributes?.() as Record<string, string> | undefined;
  if (attrs?.['data-logo'] === 'true') return true;
  const src = String(attrs?.src || component.get('src') || '').trim();
  return isMergeTokenSrc(src);
}

function readLogoSrc(component: Component): string {
  const attrs = component.getAttributes?.() as Record<string, string> | undefined;
  return String(attrs?.src || component.get('src') || '').trim();
}

export function buildDefaultLogoAttributes(options: {
  assetUrl?: string;
  alt?: string;
} = {}): Record<string, string> {
  const mergeSrc = formatMergeToken(LOGO_MERGE_PATH);
  const previewUrl = String(options.assetUrl || '').trim();
  const storedSrc = previewUrl
    ? stripAuthTokenFromDownloadUrl(previewUrl)
    : mergeSrc;
  return {
    'data-logo': 'true',
    'data-company-logo': 'true',
    'data-custom-image': 'false',
    'data-merge-src': mergeSrc,
    src: storedSrc,
    alt: String(options.alt || '').trim() || formatMergeToken('CurrentOrganization.name')
  };
}

function isDirectImageSrc(src: string): boolean {
  const trimmed = String(src || '').trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('http://')
    || trimmed.startsWith('https://')
    || trimmed.startsWith('/api/')
    || trimmed.startsWith('/files/')
    || trimmed.startsWith('data:')
  );
}

function shouldHydrateCompanyLogo(component: Component, currentSrc: string): boolean {
  const attrs = component.getAttributes?.() as Record<string, string> | undefined;

  if (attrs?.['data-custom-image'] === 'true' || attrs?.['data-company-logo'] === 'false') {
    return false;
  }

  if (!currentSrc) return true;
  if (isMergeTokenSrc(currentSrc)) return true;
  if (currentSrc.includes('{{') && !isDirectImageSrc(currentSrc)) return true;
  if (isDirectImageSrc(currentSrc)) return false;

  return attrs?.['data-company-logo'] === 'true';
}

export function applyCompanyLogoToEditor(
  editor: Editor | null | undefined,
  options: { assetUrl?: string; alt?: string } = {}
): void {
  if (!editor) return;
  const wrapper = editor.getWrapper();
  if (!wrapper) return;

  const previewUrl = String(options.assetUrl || '').trim();
  if (!previewUrl) return;

  const attrs = buildDefaultLogoAttributes({ assetUrl: previewUrl, alt: options.alt });
  const visit = (component: Component) => {
    if (isLogoComponent(component)) {
      const currentSrc = readLogoSrc(component);
      if (!shouldHydrateCompanyLogo(component, currentSrc)) {
        component.components().forEach(visit);
        return;
      }

      component.addAttributes(attrs);
      applyImageSrcToComponent(component, previewUrl, editor);
    }
    component.components().forEach(visit);
  };

  visit(wrapper);
}

export function stripAuthTokensFromHtml(html: string): string {
  return String(html || '').replace(
    /(<img\b[^>]*\ssrc=)(["'])([^"']+)\2/gi,
    (full, prefix, quote, src) => {
      if (!String(src).includes('/files/download')) return full;
      return `${prefix}${quote}${stripAuthTokenFromDownloadUrl(src)}${quote}`;
    }
  );
}

function stripImageTokensFromProjectNode(node: unknown): void {
  if (!node || typeof node !== 'object') return;

  const component = node as {
    tagName?: string;
    attributes?: Record<string, string>;
    components?: unknown[];
  };

  if (String(component.tagName || '').toLowerCase() === 'img') {
    const attrs = component.attributes || {};
    if (attrs.src?.includes('/files/download')) {
      attrs.src = stripAuthTokenFromDownloadUrl(attrs.src);
    }
  }

  for (const child of component.components || []) {
    stripImageTokensFromProjectNode(child);
  }
}

export function stripAuthTokensFromProjectImages(project: Record<string, unknown> | null | undefined): void {
  if (!project || typeof project !== 'object') return;

  const pages = (project as { pages?: unknown[] }).pages;
  if (!Array.isArray(pages)) return;

  for (const page of pages) {
    const frames = (page as { frames?: unknown[] }).frames;
    if (!Array.isArray(frames)) continue;
    for (const frame of frames) {
      stripImageTokensFromProjectNode((frame as { component?: unknown }).component);
    }
  }
}

export function restoreLogoMergeSources(html: string): string {
  return String(html || '').replace(
    /<img\b([^>]*?)\sdata-merge-src=(["'])([^"']+)\2([^>]*)>/gi,
    (_full, before, quote, mergeSrc, after) => {
      const tail = String(after).replace(/\ssrc=(["'])[^"']*\1/i, '').replace(/\s\/?\s*$/, '');
      return `<img${before} data-merge-src=${quote}${mergeSrc}${quote}${tail} src=${quote}${mergeSrc}${quote}>`;
    }
  );
}

export function resolveLogoPreviewUrl(
  assetUrl?: string | null,
  organizationLogoUrl?: string | null
): string {
  const fromAsset = resolveAssetDownloadUrl(assetUrl || undefined);
  if (fromAsset) return fromAsset;
  return resolveAssetDownloadUrl(organizationLogoUrl || undefined);
}

type LogoHydrationHandler = () => void | Promise<void>;
let logoHydrationHandler: LogoHydrationHandler | null = null;

export function setLogoHydrationHandler(handler: LogoHydrationHandler | null): void {
  logoHydrationHandler = handler;
}

export function runLogoHydrationHandler(): void {
  if (logoHydrationHandler) {
    void logoHydrationHandler();
  }
}

export function hydrateCanvasImages(editor: Editor | null | undefined): void {
  refreshCanvasImageSources(editor);
  runLogoHydrationHandler();
}

export { refreshCanvasImageSources } from './canvasImageSrc';

import type { Component, Editor } from 'grapesjs';
import {
  resolveAssetDownloadUrl,
  stripAuthTokenFromDownloadUrl
} from '../composables/useCompanyLogoAsset';
import { isImageComponent, patchComponentAttributes } from './selection';

/** Authenticated absolute URL for Grapes canvas iframe img elements. */
export function resolveCanvasMediaUrl(downloadUrl?: string | null): string {
  const authenticated = resolveAssetDownloadUrl(downloadUrl);
  if (!authenticated) return '';

  if (
    authenticated.startsWith('http://')
    || authenticated.startsWith('https://')
    || authenticated.startsWith('data:')
    || authenticated.startsWith('blob:')
  ) {
    return authenticated;
  }

  if (typeof window !== 'undefined') {
    return new URL(authenticated, window.location.origin).href;
  }

  return authenticated;
}

function readImageSrc(component: Component): string {
  const attrs = component.getAttributes?.() as Record<string, string> | undefined;
  return String(attrs?.src || component.get('src') || '').trim();
}

function syncImageDomSrc(component: Component, displaySrc: string): void {
  const view = component.getView?.();
  const el = (view?.el ?? component.getEl?.()) as HTMLImageElement | null;
  if (el instanceof HTMLImageElement && displaySrc && el.src !== displaySrc) {
    el.src = displaySrc;
  }
}

function managedDownloadUrlNeedsAuthRefresh(src: string): boolean {
  const trimmed = String(src || '').trim();
  return trimmed.includes('/files/download') && !/[?&]token=/.test(trimmed);
}

/** Persist token-free src on the model; render authenticated absolute src in the canvas DOM. */
export function applyImageSrcToComponent(
  component: Component,
  src: string,
  editor?: Editor | null
): void {
  const canonical = stripAuthTokenFromDownloadUrl(String(src || '').trim());
  if (!canonical) return;

  patchComponentAttributes(component, { src: canonical });

  const displaySrc = resolveCanvasMediaUrl(canonical);
  if (!displaySrc) return;

  syncImageDomSrc(component, displaySrc);

  void editor;
}

export function resyncImageComponent(component: Component, editor?: Editor | null): void {
  if (!isImageComponent(component)) return;

  const currentSrc = readImageSrc(component);
  if (!currentSrc) return;

  const displaySrc = resolveCanvasMediaUrl(currentSrc);
  if (!displaySrc) return;

  if (managedDownloadUrlNeedsAuthRefresh(currentSrc) || displaySrc !== currentSrc) {
    patchComponentAttributes(component, { src: stripAuthTokenFromDownloadUrl(currentSrc) });
  }

  syncImageDomSrc(component, displaySrc);
  void editor;
}

export function refreshCanvasImageSources(editor: Editor | null | undefined): void {
  if (!editor) return;
  const wrapper = editor.getWrapper();
  if (!wrapper) return;

  const visit = (component: Component) => {
    if (isImageComponent(component)) {
      resyncImageComponent(component, editor);
    }
    component.components().forEach(visit);
  };

  visit(wrapper);
}

export function bindCanvasImageRefresh(editor: Editor): void {
  const resyncAll = () => refreshCanvasImageSources(editor);

  editor.on('canvas:frame:load', resyncAll);
  editor.on('load', resyncAll);
  editor.on('component:add', (component: Component) => {
    queueMicrotask(() => resyncImageComponent(component, editor));
  });
  editor.on('component:update:attributes', (component: Component) => {
    if (isImageComponent(component)) {
      queueMicrotask(() => resyncImageComponent(component, editor));
    }
  });
}

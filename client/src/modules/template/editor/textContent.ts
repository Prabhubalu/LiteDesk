import type { Component } from 'grapesjs';
import {
  applyMergeChipsInPlace,
  contentHasHtmlMarkup,
  elementToMergeTokens,
  mergeTokensToChipHtml,
  serializeElementHtmlWithMergeTokens
} from '@/utils/builderMergeTagHtml';

function isCorruptedTextValue(value: string): boolean {
  return value === '[object Object]' || value === '[object Array]' || value.startsWith('[object ');
}

function isComponentCollection(
  value: unknown
): value is { models: Array<{ get?: (key: string) => unknown }> } {
  return Boolean(
    value
    && typeof value === 'object'
    && 'models' in value
    && Array.isArray((value as { models: unknown }).models)
  );
}

function isComponentModel(value: unknown): value is Component {
  return Boolean(
    value
    && typeof value === 'object'
    && 'get' in value
    && 'getId' in value
    && typeof (value as Component).getId === 'function'
  );
}

function hasTextChildComponents(component: Component): boolean {
  const children = component.components?.();
  if (!children?.length) return false;
  for (const child of children) {
    const type = String(child.get('type') || '').toLowerCase();
    if (type === 'textnode' || type === 'text') return true;
  }
  return false;
}

/** Only literal corrupted string values — never treat Grapes child collections as corruption. */
export function isCorruptedComponentContent(component: Component): boolean {
  const raw = component.get('content');
  if (typeof raw === 'string') {
    return isCorruptedTextValue(raw);
  }
  if (raw == null || hasTextChildComponents(component) || isComponentCollection(raw)) {
    return false;
  }
  if (Array.isArray(raw) || isComponentModel(raw)) {
    return false;
  }
  return false;
}

function resolveTextHostElement(component: Component): HTMLElement | null {
  let current: Component | null = component;
  while (current) {
    const el = current.view?.el;
    if (el instanceof HTMLElement) {
      return el;
    }
    current = current.parent?.() ?? null;
  }
  return null;
}

function readChildComponentsText(component: Component): string {
  const children = component.components?.();
  if (!children?.length) return '';

  const parts: string[] = [];
  for (const child of children) {
    const nested = child.components?.();
    if (nested?.length) {
      const deep = readChildComponentsText(child);
      if (deep) parts.push(deep);
      continue;
    }
    const part = normalizeStoredText(child.get?.('content'), child.view?.el as HTMLElement | undefined);
    if (part) parts.push(part);
  }
  return parts.join('');
}

function normalizeStoredText(content: unknown, element?: HTMLElement): string {
  if (typeof content === 'string') {
    return isCorruptedTextValue(content) ? (element?.textContent || '') : content;
  }
  if (content == null) {
    return element?.textContent || '';
  }
  if (Array.isArray(content)) {
    return content.map((part) => normalizeStoredText(part, element)).join('');
  }
  if (isComponentCollection(content)) {
    return content.models
      .map((model) => normalizeStoredText(model.get?.('content'), element))
      .join('');
  }
  if (isComponentModel(content)) {
    return normalizeStoredText(content.get('content'), element);
  }
  if (typeof content === 'object') {
    const record = content as {
      content?: unknown;
      attributes?: { content?: unknown };
    };
    if (record.content != null) {
      return normalizeStoredText(record.content, element);
    }
    if (record.attributes?.content != null) {
      return normalizeStoredText(record.attributes.content, element);
    }
    return element?.textContent || '';
  }
  const coerced = String(content);
  return isCorruptedTextValue(coerced) ? (element?.textContent || '') : coerced;
}

function readLiveTextFromElement(element: HTMLElement): string {
  const raw = element.isContentEditable
    ? elementToMergeTokens(element)
    : element.textContent || '';
  const text = String(raw ?? '');
  return isCorruptedTextValue(text) ? (element.textContent || '') : text;
}

function applyRichTextHtmlToElement(element: HTMLElement, value: string): void {
  const text = String(value ?? '');
  if (!text) {
    element.innerHTML = '';
    return;
  }
  if (text.includes('{{')) {
    element.innerHTML = text.replace(/\u200B/g, '');
    applyMergeChipsInPlace(element);
    return;
  }
  element.innerHTML = text;
}

function applyTextToElement(element: HTMLElement, value: string): void {
  const text = String(value ?? '');
  if (text.includes('{{')) {
    if (contentHasHtmlMarkup(text)) {
      element.innerHTML = text.replace(/\u200B/g, '');
      applyMergeChipsInPlace(element);
      return;
    }
    element.innerHTML = mergeTokensToChipHtml(text);
    return;
  }
  if (contentHasHtmlMarkup(text)) {
    element.innerHTML = text;
    return;
  }
  element.textContent = text;
}

function replaceComponentTextModel(component: Component, value: string): void {
  component.set('content', String(value ?? ''), { silent: true });
}

function isActiveElementInComponentTree(element: HTMLElement, active: HTMLElement): boolean {
  if (element === active || element.contains(active)) return true;
  let node: HTMLElement | null = active;
  while (node) {
    if (node === element) return true;
    node = node.parentElement;
  }
  return false;
}

export function isComponentDomFocused(component: Component | null): boolean {
  if (!component) return false;
  const el = resolveTextHostElement(component);
  if (!el) return false;

  const doc = el.ownerDocument;
  const active = doc.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (!isActiveElementInComponentTree(el, active)) return false;

  if (active.isContentEditable || el.isContentEditable) return true;

  let node: HTMLElement | null = active;
  while (node && node !== el.parentElement) {
    if (node.isContentEditable) return true;
    node = node.parentElement;
  }
  return false;
}

export function syncTextContentFromDom(component: Component): void {
  if (!isCorruptedComponentContent(component)) return;

  const el = resolveTextHostElement(component);
  if (!el || isComponentDomFocused(component)) return;

  const fromDom = readLiveTextFromElement(el);
  if (fromDom === '' && !el.textContent) return;

  const children = component.components?.();
  if (children?.length) component.components([]);

  replaceComponentTextModel(component, fromDom);
  applyTextToElement(el, fromDom);
}

/** Read-only — never mutates the Grapes model (mutating during read resets canvas RTE). */
export function readTextContent(component: Component | null | undefined): string {
  if (!component) return '';

  const el = resolveTextHostElement(component);
  if (el) {
    return readLiveTextFromElement(el);
  }

  const fromModel = normalizeStoredText(component.get('content'));
  if (fromModel && !isCorruptedTextValue(fromModel)) {
    return fromModel;
  }

  const fromChildren = readChildComponentsText(component);
  if (fromChildren && !isCorruptedTextValue(fromChildren)) {
    return fromChildren;
  }

  return '';
}

/** Read rich-text HTML from the live canvas host (preserves inline markup and line breaks). */
export function readRichTextHtml(component: Component | null | undefined): string {
  if (!component) return '';

  const el = resolveTextHostElement(component);
  if (el) {
    return serializeElementHtmlWithMergeTokens(el);
  }

  const fromChildren = readChildComponentsText(component);
  if (fromChildren && contentHasHtmlMarkup(fromChildren)) {
    return fromChildren;
  }

  const fromModel = normalizeStoredText(component.get('content'));
  if (fromModel && contentHasHtmlMarkup(fromModel)) {
    return fromModel;
  }
  if (fromModel.includes('\n')) {
    return fromModel.replace(/\n/g, '<br>');
  }

  return fromModel;
}

function clearComponentChildren(component: Component): void {
  const children = component.components?.();
  if (!children?.length) return;
  if (typeof children.reset === 'function') {
    children.reset(undefined, { silent: true });
    return;
  }
  while (children.length > 0) {
    children.at(0)?.remove();
  }
}

export function writeRichTextHtml(
  component: Component,
  html: string,
  options: { silent?: boolean; force?: boolean } = {}
): void {
  const value = String(html ?? '');
  if (!options.force && isComponentDomFocused(component)) return;

  // Grapes clears host innerHTML whenever child components exist — keep line breaks
  // as HTML on the host (see ComponentView.updateContent in grapesjs).
  clearComponentChildren(component);
  replaceComponentTextModel(component, value);

  const el = resolveTextHostElement(component);
  if (el && !isComponentDomFocused(component)) {
    applyRichTextHtmlToElement(el, value);
  }
}

export function writeTextContent(
  component: Component,
  text: string,
  options: { silent?: boolean; force?: boolean } = {}
): void {
  const value = String(text ?? '');
  if (isCorruptedTextValue(value)) return;
  if (!options.force && isComponentDomFocused(component)) return;

  replaceComponentTextModel(component, value);

  const el = resolveTextHostElement(component);
  if (el && !isComponentDomFocused(component)) {
    applyTextToElement(el, value);
  }
}

export function normalizeDisplayText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return '';
  const text = String(value);
  return isCorruptedTextValue(text) ? '' : text;
}

export function isEditableTextComponent(component: Component | null | undefined): boolean {
  if (!component) return false;
  const type = String(component.get('type') || '');
  if (
    [
      'text',
      'arivu-text-block',
      'arivu-paragraph',
      'arivu-heading',
      'arivu-rich-text',
      'arivu-list',
      'arivu-address',
      'arivu-organization',
      'arivu-contact-card',
      'arivu-button',
      'arivu-watermark',
      'arivu-html'
    ].includes(type)
  ) {
    return true;
  }
  const tag = String(component.get('tagName') || '').toLowerCase();
  return ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'li'].includes(tag);
}

export function repairAllTextComponents(root: Component): void {
  const visit = (component: Component) => {
    if (isEditableTextComponent(component) && isCorruptedComponentContent(component)) {
      syncTextContentFromDom(component);
    }
    component.components().forEach(visit);
  };
  visit(root);
}

/** Legacy text blocks were inline spans — upgrade so Enter/newlines survive export. */
function upgradeInlineTextBlockTags(component: Component): void {
  const attrs = component.getAttributes?.() as Record<string, string> | undefined;
  if (attrs?.['data-text-block'] !== 'true') return;
  if (String(component.get('tagName') || '').toLowerCase() !== 'span') return;
  component.set('tagName', 'div');
}

/** Paint merge chips and sync models after raw HTML is loaded into the canvas. */
export function hydrateEditableTextComponents(root: Component): void {
  const visit = (component: Component) => {
    upgradeInlineTextBlockTags(component);
    if (isEditableTextComponent(component)) {
      const text = readTextContent(component);
      if (text.includes('{{')) {
        writeTextContent(component, text, { force: true, silent: true });
      }
    }
    component.components().forEach(visit);
  };
  visit(root);
}

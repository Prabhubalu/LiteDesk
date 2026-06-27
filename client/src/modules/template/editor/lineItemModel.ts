import type { Component } from 'grapesjs';
import type { LineItemBindings } from '@/constants/lineItemDefaults';
import { encodeLineItemBindings, parseLineItemBindings } from './lineItemHtml';

export const LINE_ITEM_TYPE = 'arivu-line-item';

export function isLineItemComponent(component: Component | null | undefined): boolean {
  if (!component) return false;
  if (String(component.get('type') || '') === LINE_ITEM_TYPE) return true;
  const attrs = component.getAttributes?.() || {};
  return attrs['data-line-item'] === 'true' || attrs['data-line-item'] === true;
}

export function isLineItemInnerTable(component: Component | null | undefined): boolean {
  if (!component) return false;
  const tag = String(component.get('tagName') || '').toLowerCase();
  if (tag !== 'table') return false;
  const attrs = component.getAttributes?.() || {};
  if (attrs['data-line-item-table'] === 'true') return true;
  return Boolean(findLineItemRoot(component));
}

export function findLineItemInnerTableComponent(lineItemRoot: Component | null | undefined): Component | null {
  if (!lineItemRoot || !isLineItemComponent(lineItemRoot)) return null;
  return (
    lineItemRoot.components().find((child: Component) => isLineItemInnerTable(child)) ?? null
  );
}

export function findLineItemRoot(component: Component | null | undefined): Component | null {
  let current = component;
  while (current) {
    if (isLineItemComponent(current)) return current;
    current = current.parent?.() || null;
  }
  return null;
}

export function isLineItemDataRow(component: Component | null | undefined): boolean {
  let current = component;
  while (current) {
    const tag = String(current.get('tagName') || '').toLowerCase();
    if (tag === 'tr') {
      const attrs = current.getAttributes?.() || {};
      return attrs['data-line-item-row'] === 'line';
    }
    current = current.parent?.() || null;
  }
  return false;
}

/** Use line.* merge paths inside repeating line-item rows. */
export function normalizeLineScopeMergePath(path: string): string {
  const trimmed = path.replace(/^\{\{|\}\}$/g, '').trim();
  if (!trimmed.toLowerCase().startsWith('lines.')) return trimmed;
  return `line.${trimmed.slice('lines.'.length)}`;
}

export function readLineItemBindings(
  component: Component,
  moduleScope = ''
): LineItemBindings {
  const attrs = component.getAttributes?.() || {};
  return parseLineItemBindings(attrs['data-line-item-bindings'], moduleScope);
}

export function writeLineItemBindings(
  component: Component,
  bindings: LineItemBindings
): void {
  component.addAttributes({
    'data-line-item': 'true',
    'data-line-item-bindings': encodeLineItemBindings(bindings)
  });
}

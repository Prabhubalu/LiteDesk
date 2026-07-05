import type { Component, Editor } from 'grapesjs';
import { elementToMergeTokens } from '@/utils/builderMergeTagHtml';
import { isLineItemComponent } from './lineItemModel';
import { PRINT_AREA_ATTR, PRINT_AREA_TYPE } from './printArea';
import {
  isEditableTextComponent,
  isTextComponent
} from './selection';
import { isTableCellComponent } from './tableModel';

const STRUCTURAL_TAGS = new Set([
  'table',
  'tbody',
  'thead',
  'tfoot',
  'tr',
  'colgroup',
  'col',
  'ul',
  'ol',
  'img',
  'hr'
]);

function resolveHostElement(component: Component): HTMLElement | null {
  const el = component.view?.el;
  return el instanceof HTMLElement ? el : null;
}

function isStructuralContainer(component: Component): boolean {
  const attrs = component.getAttributes?.() || {};
  const type = String(component.get('type') || '');
  const tag = String(component.get('tagName') || '').toLowerCase();

  if (isLineItemComponent(component)) return true;
  if (type === PRINT_AREA_TYPE || attrs[PRINT_AREA_ATTR] === 'true') return true;
  if (attrs['data-line-item-table'] === 'true') return true;
  if (STRUCTURAL_TAGS.has(tag)) return true;

  for (const child of component.components()) {
    const childTag = String(child.get('tagName') || '').toLowerCase();
    if (STRUCTURAL_TAGS.has(childTag)) return true;
    if (['div', 'section', 'table'].includes(childTag)) return true;
  }

  return false;
}

function isLeafTextHost(component: Component): boolean {
  if (isTableCellComponent(component)) return false;
  if (isStructuralContainer(component)) return false;
  return isEditableTextComponent(component) || isTextComponent(component);
}

function flattenTextHostContent(component: Component, tokenText: string): void {
  const children = component.components?.();
  if (children?.length) {
    if (typeof children.reset === 'function') {
      children.reset();
    } else {
      while (children.length > 0) {
        children.at(0)?.remove();
      }
    }
  }
  component.set('content', tokenText, { silent: true });
}

/** Sync leaf text hosts from DOM into Grapes models before export/preview only. */
export function syncTextComponentsForSerialize(editor: Editor): void {
  const wrapper = editor.getWrapper?.();
  if (!wrapper) return;

  const visit = (component: Component) => {
    if (!isLeafTextHost(component)) {
      component.components().forEach(visit);
      return;
    }

    const el = resolveHostElement(component);
    if (!el) {
      component.components().forEach(visit);
      return;
    }

    const fromDom = elementToMergeTokens(el);
    const childCount = component.components()?.length ?? 0;
    const modelText = String(component.get('content') ?? '');

    if (childCount > 0 || fromDom !== modelText) {
      flattenTextHostContent(component, fromDom);
    }

    component.components().forEach(visit);
  };

  visit(wrapper);
}

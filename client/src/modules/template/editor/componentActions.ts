import type { Component, Editor } from 'grapesjs';
import { PRINT_AREA_ATTR, PRINT_AREA_TYPE } from './printArea';
import { isTableCellComponent } from './tableModel';

export const CANVAS_COMPONENT_TOOLBAR = [
  { attributes: { class: 'fa fa-arrows', title: 'Move' }, command: 'tlb-move' },
  { attributes: { class: 'fa fa-arrow-up', title: 'Select parent' }, command: 'core:component-exit' },
  { attributes: { class: 'fa fa-clone', title: 'Duplicate' }, command: 'tlb-clone' },
  { attributes: { class: 'fa fa-trash-o', title: 'Delete' }, command: 'tlb-delete' }
] as const;

function shouldUseCanvasToolbar(component: Component): boolean {
  const type = String(component.get('type') || '');
  const attrs = component.getAttributes?.() || {};
  if (type === 'wrapper' || type === PRINT_AREA_TYPE) return false;
  if (attrs[PRINT_AREA_ATTR] === 'true') return false;
  if (component.get('badgable') === false) return false;
  if (component.get('selectable') === false) return false;
  if (isTableCellComponent(component)) return false;
  const tag = String(component.get('tagName') || '').toLowerCase();
  return tag !== 'colgroup' && tag !== 'col';
}

export function selectParentComponent(editor: Editor | null | undefined): void {
  if (!editor) return;
  editor.runCommand('core:component-exit');
}

export function duplicateComponent(editor: Editor | null | undefined, component: Component | null | undefined): void {
  if (!editor || !component) return;
  editor.select(component);
  editor.runCommand('tlb-clone');
}

export function deleteComponent(editor: Editor | null | undefined, component: Component | null | undefined): void {
  if (!editor || !component) return;
  editor.select(component);
  editor.runCommand('tlb-delete');
}

export function canSelectParent(component: Component | null | undefined): boolean {
  if (!component) return false;
  const parent = component.parent?.();
  if (!parent) return false;
  const type = String(parent.get?.('type') || '');
  return type !== 'wrapper';
}

export function configureComponentToolbar(editor: Editor): void {
  editor.on('load', () => {
    editor.DomComponents.addType('image', {
      extend: 'image',
      model: {
        defaults: {
          traits: [],
          badgable: true,
          toolbar: [...CANVAS_COMPONENT_TOOLBAR]
        }
      }
    });

    const defaultType = editor.DomComponents.getType('default');
    const defaults = defaultType?.model?.prototype?.defaults;
    if (defaults && typeof defaults === 'object') {
      Object.assign(defaults, {
        badgable: true,
        toolbar: [...CANVAS_COMPONENT_TOOLBAR]
      });
    }
  });

  editor.on('component:selected', (component: Component) => {
    if (shouldUseCanvasToolbar(component)) {
      component.set(
        { badgable: true, toolbar: [...CANVAS_COMPONENT_TOOLBAR] },
        { silent: true }
      );
      return;
    }
    const toolbar = component.get('toolbar');
    if (Array.isArray(toolbar) && toolbar.length === 0) return;
    component.set('toolbar', [], { silent: true });
  });
}

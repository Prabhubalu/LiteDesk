import type { Component, Editor } from 'grapesjs';
import { isTableCellComponent, paintTableCellContent } from './tableModel';

const CELL_TYPE = 'arivu-cell';

export function registerTableCellComponents(editor: Editor): void {
  if (!editor.DomComponents.getType(CELL_TYPE)) {
    editor.DomComponents.addType(CELL_TYPE, {
      model: {
        defaults: {
          tagName: 'td',
          editable: false,
          draggable: false,
          copyable: false,
          stylable: true,
          highlightable: true,
          selectable: true,
          hoverable: true,
          badgable: false,
          layerable: true,
          traits: [],
          toolbar: []
        },
        init() {
          this.on('change:content', () => {
            paintTableCellContent(this);
          });
        }
      },
      view: {
        onRender({ model }) {
          paintTableCellContent(model);
        }
      }
    });
  }

  const normalizeCell = (component: Component) => {
    const tag = String(component.get('tagName') || '').toLowerCase();
    if (tag !== 'td' && tag !== 'th') return;
    component.set({
      type: CELL_TYPE,
      editable: false,
      draggable: false,
      toolbar: []
    });
  };

  const walk = (component: Component) => {
    normalizeCell(component);
    component.components().forEach(walk);
  };

  editor.on('load', () => {
    const wrapper = editor.getWrapper();
    if (wrapper) walk(wrapper);
  });

  editor.on('component:add', (component: Component) => {
    normalizeCell(component);
    component.components().forEach(normalizeCell);
  });
}

export function asTableCell(component: Component | null | undefined): Component | null {
  if (!component) return null;
  if (isTableCellComponent(component)) return component;
  return null;
}

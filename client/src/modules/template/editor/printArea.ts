import type { Component, Editor } from 'grapesjs';
import { componentElementMatches } from './componentCanMove';
import {
  resolveContentAreaPx,
  resolvePageMarginsPx,
  type PageMarginsMm,
  type PageMarginsPx
} from '@/constants/contentPageSettings';
import type { PageDimensionsPx } from './pageDimensions';
import {
  injectLayoutGridFrameCss,
  isEmbeddedLayoutGridStyle,
  stripEmbeddedLayoutGridStyleTags
} from './layoutGridCss';
import { getSupplementalCss, injectSupplementalCanvasCss } from './supplementalCssStore';

export const PRINT_AREA_ATTR = 'data-print-area';
export const PRINT_AREA_TYPE = 'print-area';
const PRINT_AREA_STYLE_ID = 'arivu-print-area-layout';

export function registerPrintAreaComponent(editor: Editor): void {
  editor.DomComponents.addType(PRINT_AREA_TYPE, {
    isComponent: (el) => el instanceof HTMLElement && el.getAttribute(PRINT_AREA_ATTR) === 'true',
    model: {
      defaults: {
        tagName: 'div',
        attributes: { [PRINT_AREA_ATTR]: 'true' },
        name: 'Print Area',
        droppable: true,
        badgable: false,
        removable: false,
        copyable: false,
        draggable: false,
        selectable: false,
        hoverable: false,
        highlightable: false,
        layerable: false,
        stylable: false,
        toolbar: []
      }
    }
  });
}

export function getPrintAreaComponent(root: Component | null | undefined): Component | null {
  if (!root) return null;

  for (const child of root.components()) {
    const attrs = child.getAttributes?.() || {};
    if (attrs[PRINT_AREA_ATTR] === 'true' || child.get('type') === PRINT_AREA_TYPE) {
      return child;
    }
  }

  return null;
}

export function getContentDropTarget(editor: Editor | null | undefined): Component | null {
  if (!editor) return null;
  const wrapper = editor.getWrapper();
  if (!wrapper) return null;
  return ensurePrintArea(editor) || getPrintAreaComponent(wrapper) || wrapper;
}

export function canAppendToComponent(component: Component | null | undefined): boolean {
  if (!component) return false;
  const droppable = component.get('droppable');
  if (droppable === false) return false;
  // Rows only accept drops into cells (selector string), not arbitrary content.
  if (typeof droppable === 'string') return false;
  return true;
}

export function resolveInsertTarget(editor: Editor | null | undefined): Component | null {
  if (!editor) return null;
  const selected = editor.getSelected();
  if (canAppendToComponent(selected)) {
    return selected ?? null;
  }
  return getContentDropTarget(editor);
}

const LAYOUT_ROW_CLASS = 'gjs-row';
const LAYOUT_CELL_CLASS = 'gjs-cell';

export function isLayoutGridRow(component: Component | null | undefined): boolean {
  return component?.getClasses?.().includes(LAYOUT_ROW_CLASS) ?? false;
}

export function isLayoutGridCell(component: Component | null | undefined): boolean {
  return component?.getClasses?.().includes(LAYOUT_CELL_CLASS) ?? false;
}

export function registerLayoutGridComponents(editor: Editor): void {
  if (!editor.DomComponents.getType('layout-grid-row')) {
    editor.DomComponents.addType('layout-grid-row', {
      isComponent: (el) => el instanceof HTMLElement && el.classList.contains(LAYOUT_ROW_CLASS),
      model: {
        defaults: {
          tagName: 'div',
          name: 'Row',
          droppable: (src: Component) => componentElementMatches(src, `.${LAYOUT_CELL_CLASS}`),
          draggable: true,
          style: {
            display: 'flex',
            'flex-direction': 'row',
            'flex-wrap': 'nowrap',
            'align-items': 'stretch',
            'min-height': '95px'
          }
        }
      }
    });
  }

  if (!editor.DomComponents.getType('layout-grid-cell')) {
    editor.DomComponents.addType('layout-grid-cell', {
      isComponent: (el) => el instanceof HTMLElement && el.classList.contains(LAYOUT_CELL_CLASS),
      model: {
        defaults: {
          tagName: 'div',
          name: 'Cell',
          droppable: true,
          draggable: (_src: Component, target: Component) =>
            componentElementMatches(target, `.${LAYOUT_ROW_CLASS}`),
          style: {
            display: 'flex',
            'flex-direction': 'column',
            'justify-content': 'flex-start',
            'align-items': 'flex-start',
            'min-height': '75px'
          }
        }
      }
    });
  }
}

export function ensurePrintArea(editor: Editor): Component | null {
  const wrapper = editor.getWrapper();
  if (!wrapper) return null;

  let printArea = getPrintAreaComponent(wrapper);
  if (!printArea) {
    const existingChildren = wrapper.components().filter((child: Component) => {
      const attrs = child.getAttributes?.() || {};
      return attrs[PRINT_AREA_ATTR] !== 'true' && child.get('type') !== PRINT_AREA_TYPE;
    });

    wrapper.append({ type: PRINT_AREA_TYPE });
    printArea = getPrintAreaComponent(wrapper);
    if (!printArea) return null;

    for (const child of existingChildren) {
      printArea.append(child);
    }
  }

  wrapper.set({
    droppable: false,
    badgable: false,
    selectable: false,
    hoverable: false,
    highlightable: false,
    removable: false,
    copyable: false,
    layerable: false
  });

  return printArea;
}

export function resolveMarginsPx(marginsMm?: Partial<PageMarginsMm>): PageMarginsPx {
  return resolvePageMarginsPx(marginsMm);
}

function injectPrintAreaLayoutCss(
  editor: Editor,
  dimensions: PageDimensionsPx,
  margins: PageMarginsPx,
  contentArea: { width: number; height: number }
): void {
  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (!doc) return;

  let styleEl = doc.getElementById(PRINT_AREA_STYLE_ID);
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = PRINT_AREA_STYLE_ID;
    doc.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    :root {
      --arivu-page-width: ${dimensions.width}px;
      --arivu-page-height: ${dimensions.height}px;
      --arivu-margin-top: ${margins.top}px;
      --arivu-margin-right: ${margins.right}px;
      --arivu-margin-bottom: ${margins.bottom}px;
      --arivu-margin-left: ${margins.left}px;
      --arivu-content-width: ${contentArea.width}px;
      --arivu-content-height: ${contentArea.height}px;
    }

    [data-gjs-type="wrapper"] {
      position: relative !important;
      width: var(--arivu-page-width) !important;
      min-width: var(--arivu-page-width) !important;
      max-width: var(--arivu-page-width) !important;
      min-height: var(--arivu-page-height) !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    [${PRINT_AREA_ATTR}="true"],
    [data-gjs-type="${PRINT_AREA_TYPE}"] {
      position: absolute !important;
      top: var(--arivu-margin-top) !important;
      left: var(--arivu-margin-left) !important;
      width: var(--arivu-content-width) !important;
      height: auto !important;
      min-height: var(--arivu-content-height) !important;
      max-width: var(--arivu-content-width) !important;
      box-sizing: border-box !important;
      overflow-x: hidden !important;
      overflow-y: visible !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    [${PRINT_AREA_ATTR}="true"] .gjs-row,
    [data-gjs-type="${PRINT_AREA_TYPE}"] .gjs-row,
    [${PRINT_AREA_ATTR}="true"] table,
    [data-gjs-type="${PRINT_AREA_TYPE}"] table {
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
  `;
}

function clearPersistedLayoutStyles(wrapper: Component, printArea: Component): void {
  wrapper.setStyle(
    {
      position: '',
      width: '',
      'min-height': '',
      'box-sizing': '',
      overflow: '',
      padding: '',
      margin: '',
      'padding-top': '',
      'padding-right': '',
      'padding-bottom': '',
      'padding-left': ''
    },
    { silent: true }
  );

  printArea.setStyle(
    {
      position: '',
      top: '',
      left: '',
      right: '',
      bottom: '',
      width: '',
      height: '',
      'min-height': '',
      'max-width': '',
      'box-sizing': '',
      overflow: '',
      margin: '',
      padding: ''
    },
    { silent: true }
  );
}

export function applyPrintAreaLayout(
  editor: Editor,
  dimensions: PageDimensionsPx,
  marginsMm?: Partial<PageMarginsMm>
): void {
  const { width, height } = dimensions;
  if (!width || !height) return;

  const margins = resolveMarginsPx(marginsMm);
  const contentArea = resolveContentAreaPx(width, height, margins);
  const wrapper = editor.getWrapper();
  const printArea = ensurePrintArea(editor);
  if (!wrapper || !printArea) return;

  clearPersistedLayoutStyles(wrapper, printArea);
  injectPrintAreaLayoutCss(editor, dimensions, margins, contentArea);
  injectLayoutGridFrameCss(editor);
  const supplementalCss = getSupplementalCss(editor);
  if (supplementalCss) {
    injectSupplementalCanvasCss(editor, supplementalCss);
  }

  const frame = editor.Canvas.getFrameEl();
  frame?.contentWindow?.dispatchEvent(new Event('resize'));
  editor.refresh();
}

function normalizeLayoutGridRow(component: Component): void {
  if (!isLayoutGridRow(component)) return;

  const style = { ...(component.getStyle?.() || {}) };
  let changed = false;

  if (!style.display || style.display === 'table' || style.display === 'block') {
    style.display = 'flex';
    changed = true;
  }

  const flexDirection = style['flex-direction'] || style.flexDirection;
  if (!flexDirection || flexDirection === 'table') {
    style['flex-direction'] = 'row';
    changed = true;
  }

  const resolvedDirection = style['flex-direction'] || style.flexDirection || 'row';
  if (resolvedDirection === 'column') {
    if (style['flex-wrap'] !== 'wrap') {
      style['flex-wrap'] = 'wrap';
      changed = true;
    }
  } else if (style['flex-wrap'] === 'wrap') {
    style['flex-wrap'] = 'nowrap';
    changed = true;
  } else if (!style['flex-wrap'] && !style.flexWrap) {
    style['flex-wrap'] = 'nowrap';
    changed = true;
  }

  const minHeight = style['min-height'] || style.minHeight;
  if (minHeight && parseInt(String(minHeight), 10) < 75) {
    delete style['min-height'];
    delete style.minHeight;
    changed = true;
  }

  if (!style['min-height'] && !style.minHeight) {
    style['min-height'] = '95px';
    changed = true;
  }

  if (changed) {
    component.setStyle(style, { silent: true });
  }
}

function normalizeLayoutGridCell(component: Component): void {
  if (!isLayoutGridCell(component)) return;

  const style = { ...(component.getStyle?.() || {}) };
  let changed = false;

  if (style.height === '100%' || style.height === '100') {
    delete style.height;
    changed = true;
  }

  if (style.display === 'table-cell' || style.display === 'table') {
    delete style.display;
    changed = true;
  }

  const minHeight = style['min-height'] || style.minHeight;
  if (minHeight && parseInt(String(minHeight), 10) < 75) {
    delete style['min-height'];
    delete style.minHeight;
    changed = true;
  }

  if (!style['min-height'] && !style.minHeight) {
    style['min-height'] = '75px';
    changed = true;
  }

  if (changed) {
    component.setStyle(style, { silent: true });
  }

  component.components().forEach(normalizeLayoutGridCellChild);
}

function normalizeLayoutGridCellChild(component: Component): void {
  const style = { ...(component.getStyle?.() || {}) };
  let changed = false;

  if (style.height === '100%' || style.height === '100') {
    delete style.height;
    changed = true;
  }

  if (style['margin-top'] === 'auto') {
    delete style['margin-top'];
    changed = true;
  }

  if (style['align-self'] === 'flex-end' || style['align-self'] === 'end') {
    delete style['align-self'];
    changed = true;
  }

  if (changed) {
    component.setStyle(style, { silent: true });
  }
}

function walkLayoutGridCells(root: Component, visit: (component: Component) => void): void {
  visit(root);
  root.components().forEach((child: Component) => walkLayoutGridCells(child, visit));
}

export function bindLayoutGridGuards(editor: Editor): void {
  const normalizeTree = () => {
    const wrapper = editor.getWrapper();
    if (!wrapper) return;
    stripEmbeddedLayoutGridStyleTags(wrapper);
    injectLayoutGridFrameCss(editor);
    walkLayoutGridCells(wrapper, (component) => {
      normalizeLayoutGridRow(component);
      normalizeLayoutGridCell(component);
    });
  };

  editor.on('load', normalizeTree);
  editor.on('canvas:frame:load', () => {
    injectLayoutGridFrameCss(editor);
  });
  editor.on('project:load', () => {
    queueMicrotask(normalizeTree);
  });

  editor.on('component:add', (component: Component) => {
    if (isEmbeddedLayoutGridStyle(component)) {
      component.remove();
      return;
    }

    normalizeLayoutGridRow(component);
    normalizeLayoutGridCell(component);
    component.components().forEach((child: Component) => {
      normalizeLayoutGridRow(child);
      normalizeLayoutGridCell(child);
    });

    const parent = component.parent?.();
    if (parent && isLayoutGridCell(parent)) {
      normalizeLayoutGridCell(parent);
      normalizeLayoutGridCellChild(component);
    }
  });
}

export function bindPrintAreaGuards(editor: Editor): void {
  editor.on('component:add', (component: Component) => {
    const wrapper = editor.getWrapper();
    const parent = component.parent?.();
    if (!wrapper || !parent || parent !== wrapper) return;

    const printArea = ensurePrintArea(editor);
    if (!printArea || component === printArea) return;

    printArea.append(component);
  });

  editor.on('component:selected', (component: Component) => {
    const type = String(component.get('type') || '');
    const attrs = component.getAttributes?.() || {};
    if (type === 'wrapper' || attrs[PRINT_AREA_ATTR] === 'true' || type === PRINT_AREA_TYPE) {
      editor.select(undefined);
    }
  });

  editor.on('load', () => {
    const wrapper = editor.getWrapper();
    const printArea = wrapper ? getPrintAreaComponent(wrapper) : null;
    if (printArea) {
      clearPersistedLayoutStyles(wrapper!, printArea);
    }
  });
}

export function stripPrintAreaLayoutFromProject(project: Record<string, unknown> | null): void {
  if (!project || typeof project !== 'object') return;

  const pages = project.pages as Array<{ frames?: Array<{ component?: unknown }> }> | undefined;
  if (!Array.isArray(pages)) return;

  for (const page of pages) {
    const frames = page.frames;
    if (!Array.isArray(frames)) continue;

    for (const frame of frames) {
      stripPrintAreaNode(frame.component);
    }
  }
}

function stripPrintAreaNode(node: unknown): void {
  if (!node || typeof node !== 'object') return;

  const component = node as {
    type?: string;
    attributes?: Record<string, unknown>;
    style?: Record<string, unknown>;
    components?: unknown[];
  };

  const attrs = component.attributes || {};
  if (attrs[PRINT_AREA_ATTR] === 'true' || component.type === PRINT_AREA_TYPE) {
    if (component.style && typeof component.style === 'object') {
      for (const key of [
        'position',
        'top',
        'left',
        'right',
        'bottom',
        'width',
        'min-height',
        'max-width',
        'padding',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        'margin'
      ]) {
        delete component.style[key];
      }
    }
  }

  if (component.type === 'wrapper' && component.style && typeof component.style === 'object') {
    for (const key of [
      'padding',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
      'min-height',
      'position',
      'overflow'
    ]) {
      delete component.style[key];
    }
  }

  if (Array.isArray(component.components)) {
    for (const child of component.components) {
      stripPrintAreaNode(child);
    }
  }
}

import type { Editor } from 'grapesjs';
import { ensurePrintArea, stripPrintAreaLayoutFromProject } from './printArea';
import { appendLayoutGridCss } from './layoutGridCss';
import { flushTableSheetEdits } from './tableSheetEditor';
import { syncTableCellsForSerialize } from './tableModel';

export const GRAPES_ENGINE = 'grapesjs' as const;
export const GRAPES_DEFINITION_VERSION = 1;

export interface GrapesTemplateDefinition {
  engine: typeof GRAPES_ENGINE;
  version: number;
  project: Record<string, unknown> | null;
  html: string;
  css: string;
}

export function createBlankGrapesDefinition(): GrapesTemplateDefinition {
  return {
    engine: GRAPES_ENGINE,
    version: GRAPES_DEFINITION_VERSION,
    project: null,
    html: '',
    css: ''
  };
}

export function isGrapesDefinition(value: unknown): value is GrapesTemplateDefinition {
  return (
    value != null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as GrapesTemplateDefinition).engine === GRAPES_ENGINE
  );
}

function countProjectComponents(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  const component = node as { components?: unknown[] };
  const children = Array.isArray(component.components) ? component.components : [];
  let count = children.length;
  for (const child of children) {
    count += countProjectComponents(child);
  }
  return count;
}

export function hasGrapesProjectContent(project: Record<string, unknown> | null | undefined): boolean {
  if (!project || typeof project !== 'object') return false;
  const pages = (project as { pages?: unknown[] }).pages;
  if (!Array.isArray(pages) || pages.length === 0) return false;

  for (const page of pages) {
    const frames = (page as { frames?: unknown[] }).frames;
    if (!Array.isArray(frames)) continue;
    for (const frame of frames) {
      if (countProjectComponents((frame as { component?: unknown }).component) > 0) {
        return true;
      }
    }
  }
  return false;
}

export function hasGrapesDefinitionContent(definition: GrapesTemplateDefinition | null | undefined): boolean {
  if (!definition) return false;
  if (String(definition.html || '').trim()) return true;
  return hasGrapesProjectContent(definition.project);
}

export function isEmptyGrapesDefinition(definition: GrapesTemplateDefinition | null | undefined): boolean {
  return !hasGrapesDefinitionContent(definition);
}

export function serializeEditor(editor: Editor): GrapesTemplateDefinition {
  flushTableSheetEdits(editor);
  syncTableCellsForSerialize(editor);

  const project = editor.getProjectData() as Record<string, unknown>;
  stripPrintAreaLayoutFromProject(project);

  return {
    engine: GRAPES_ENGINE,
    version: GRAPES_DEFINITION_VERSION,
    project,
    html: editor.getHtml() || '',
    css: appendLayoutGridCss(editor.getCss() || '')
  };
}

export function loadDefinition(editor: Editor, definition: GrapesTemplateDefinition | null | undefined): void {
  const html = String(definition?.html || '').trim();
  const css = String(definition?.css || '').trim();
  const project = definition?.project;

  if (project && hasGrapesProjectContent(project)) {
    const cloned = structuredClone(project) as Record<string, unknown>;
    stripPrintAreaLayoutFromProject(cloned);
    editor.loadProjectData(cloned);
    if (css) editor.setStyle(css);
    queueMicrotask(() => {
      ensurePrintArea(editor);
    });
    return;
  }

  if (html) {
    editor.setComponents(html);
    editor.setStyle(css);
    queueMicrotask(() => {
      ensurePrintArea(editor);
    });
    return;
  }

  editor.setComponents('');
  editor.setStyle('');
}

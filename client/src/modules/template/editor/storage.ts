import type { Editor } from 'grapesjs';
import { ensurePrintArea, stripPrintAreaLayoutFromProject } from './printArea';
import { injectLayoutGridFrameCss } from './layoutGridCss';
import { flushTableSheetEdits, refreshCanvasTablesAfterHtmlApply, syncActiveSheetEditForSerialize, getActiveTableSheetCell } from './tableSheetEditor';
import { hydrateTableCellsFromDom, syncTableCellsForSerialize } from './tableModel';
import { hydrateEditableTextComponents } from './textContent';
import { hydrateCanvasImages, stripAuthTokensFromHtml, stripAuthTokensFromProjectImages } from './logoContent';
import { extractRenderedOutput, exportBodyHtmlFromCanvasFrame } from './renderer';
import {
  encodeMsoConditionals,
  isFullHtmlDocument,
  parseTemplateHtmlDocumentForCanvas
} from '../utils/emailHtmlExport';
import { stripGrapesDocumentWrapper } from '../utils/formatHtmlDocument';
import { preserveEmailCss } from '../utils/emailImportSnapshot';
import { setEditorMsoChunks, clearEditorMsoChunks } from './msoChunksStore';
import { applyHtmlToEditorCanvas } from './canvasHtmlApply';
import {
  clearSupplementalCss,
  injectSupplementalCanvasCss,
  resolveSupplementalCssForProjectLoad,
  setSupplementalCss
} from './supplementalCssStore';
import {
  captureBuilderUiFocus,
  restoreBuilderUiFocus,
  runEditorSerialize
} from './editorSerializeGuard';
import { runWithPreservedCanvasEditing } from './canvasInsertion';

export const GRAPES_ENGINE = 'grapesjs' as const;
export const GRAPES_DEFINITION_VERSION = 1;

export interface GrapesTemplateDefinition {
  engine: typeof GRAPES_ENGINE;
  version: number;
  project: Record<string, unknown> | null;
  html: string;
  css: string;
}

export interface LoadDefinitionOptions {
  isEmail?: boolean;
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
  if (hasGrapesProjectContent(definition.project)) return true;
  const snapshot = (definition as { importSnapshot?: { html?: string } }).importSnapshot;
  return Boolean(String(snapshot?.html || '').trim());
}

export function isEmptyGrapesDefinition(definition: GrapesTemplateDefinition | null | undefined): boolean {
  return !hasGrapesDefinitionContent(definition);
}

export interface SerializeEditorOptions {
  isEmail?: boolean;
  /** When true (default), keep canvas/sidebar focus and in-progress cell edits during serialize. */
  preserveEditing?: boolean;
}

function runWhenEditorCanvasReady(editor: Editor, fn: () => void): void {
  if (editor.getWrapper()) {
    fn();
    return;
  }
  editor.once('load', fn);
}

function applyCanvasHtml(
  editor: Editor,
  html: string,
  css: string,
  msoChunks: string[],
  isEmail: boolean
): void {
  runWhenEditorCanvasReady(editor, () => {
    applyHtmlToEditorCanvas(editor, html, css, { isEmail });
    if (isEmail && msoChunks.length) {
      setEditorMsoChunks(editor, msoChunks);
    } else {
      clearEditorMsoChunks(editor);
    }
  });
}

export function serializeEditor(
  editor: Editor,
  options: SerializeEditorOptions = {}
): GrapesTemplateDefinition {
  const preserveEditing = options.preserveEditing !== false;
  const uiFocus = captureBuilderUiFocus();

  return runEditorSerialize(() =>
    runWithPreservedCanvasEditing(editor, () => {
      if (!options.isEmail) {
        if (preserveEditing) {
          syncActiveSheetEditForSerialize(editor);
        } else {
          flushTableSheetEdits(editor);
        }
        syncTableCellsForSerialize(editor, {
          skipComponent: preserveEditing ? getActiveTableSheetCell() : null
        });
      }

      const project = editor.getProjectData() as Record<string, unknown>;
      if (!options.isEmail) {
        stripPrintAreaLayoutFromProject(project);
        stripAuthTokensFromProjectImages(project);
      }

      const rendered = extractRenderedOutput(editor, {
        appendLayoutGrid: !options.isEmail
      });

      const definition = {
        engine: GRAPES_ENGINE,
        version: GRAPES_DEFINITION_VERSION,
        // Email uses html/css as source of truth. Persisting Grapes project data
        // can flatten layout tables into a single text node on reopen.
        project: options.isEmail ? null : project,
        html: stripAuthTokensFromHtml(exportBodyHtmlFromCanvasFrame(editor)),
        css: rendered.css
      };

      if (options.isEmail && !String(definition.html || '').trim()) {
        definition.html = stripAuthTokensFromHtml(
          stripGrapesDocumentWrapper(editor.getHtml() || '')
        );
      }

      restoreBuilderUiFocus(uiFocus);
      return definition;
    })
  );
}

export function loadDefinition(
  editor: Editor,
  definition: GrapesTemplateDefinition | null | undefined,
  options: LoadDefinitionOptions = {}
): void {
  const isEmail = Boolean(options.isEmail);
  let html = String(definition?.html || '').trim();
  let css = String(definition?.css || '').trim();
  const project = definition?.project;

  if (isEmail && html && isFullHtmlDocument(html)) {
    const parsed = parseTemplateHtmlDocumentForCanvas(html, { isEmail: true });
    html = String(parsed.html || '').trim();
    css = preserveEmailCss(css, parsed.css);
  }

  // Email templates use html/css as source of truth — never reload Grapes project
  // (project round-trips flatten nested email tables into plain text).
  if (isEmail) {
    if (html) {
      let canvasHtml = html;
      let msoChunks: string[] = [];
      const encoded = encodeMsoConditionals(canvasHtml);
      canvasHtml = encoded.html;
      msoChunks = encoded.chunks;
      applyCanvasHtml(editor, canvasHtml, css, msoChunks, true);
      return;
    }

    runWhenEditorCanvasReady(editor, () => {
      editor.setComponents('');
      editor.setStyle('');
      clearEditorMsoChunks(editor);
      clearSupplementalCss(editor);
    });
    return;
  }

  if (project && hasGrapesProjectContent(project)) {
    const cloned = structuredClone(project) as Record<string, unknown>;
    stripPrintAreaLayoutFromProject(cloned);
    runWhenEditorCanvasReady(editor, () => {
      clearSupplementalCss(editor);
      editor.loadProjectData(cloned);
      clearEditorMsoChunks(editor);
      queueMicrotask(() => {
        const supplemental = resolveSupplementalCssForProjectLoad(css, editor.getCss() || '');
        if (supplemental) {
          setSupplementalCss(editor, supplemental);
          injectSupplementalCanvasCss(editor, supplemental);
        }
        if (!isEmail) {
          ensurePrintArea(editor);
          injectLayoutGridFrameCss(editor);
        }
        const wrapper = editor.getWrapper();
        if (wrapper) {
          hydrateEditableTextComponents(wrapper);
        }
        hydrateTableCellsFromDom(editor);
        refreshCanvasTablesAfterHtmlApply(editor);
        hydrateCanvasImages(editor);
        editor.refresh();
      });
    });
    return;
  }

  if (html) {
    let canvasHtml = html;
    let msoChunks: string[] = [];

    if (isEmail) {
      const encoded = encodeMsoConditionals(canvasHtml);
      canvasHtml = encoded.html;
      msoChunks = encoded.chunks;
    }

    applyCanvasHtml(editor, canvasHtml, css, msoChunks, isEmail);
    return;
  }

  runWhenEditorCanvasReady(editor, () => {
    editor.setComponents('');
    editor.setStyle('');
    clearEditorMsoChunks(editor);
  });
}

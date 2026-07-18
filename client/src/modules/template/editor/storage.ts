import type { Editor } from 'grapesjs';
import { applyPrintAreaLayout, ensurePrintArea, stripPrintAreaLayoutFromProject } from './printArea';
import { injectLayoutGridFrameCss } from './layoutGridCss';
import type { PageLayoutOptions } from './pageDimensions';
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
  /** Required for PDF so print-area fit CSS + width rewrite run after project load. */
  pageLayout?: PageLayoutOptions;
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

export function countGrapesProjectComponents(
  project: Record<string, unknown> | null | undefined
): number {
  if (!project || typeof project !== 'object') return 0;
  const pages = (project as { pages?: unknown[] }).pages;
  if (!Array.isArray(pages) || pages.length === 0) return 0;

  let total = 0;
  for (const page of pages) {
    const frames = (page as { frames?: unknown[] }).frames;
    if (!Array.isArray(frames)) continue;
    for (const frame of frames) {
      total += countProjectComponents((frame as { component?: unknown }).component);
    }
  }
  return total;
}

/** True when HTML still has layout structure (tables / multiple blocks), not a flat text blob. */
export function grapesHtmlLooksStructured(html: string): boolean {
  const source = String(html || '');
  if (/<table\b/i.test(source)) return true;
  if (/<(td|th|tr)\b/i.test(source)) return true;
  const blocks = source.match(/<(div|section|article|header|footer|p|h[1-6]|ul|ol)\b/gi);
  return Boolean(blocks && blocks.length >= 2);
}

/**
 * True when `next` would discard a richer definition (empty, flattened tables, or severe shrink).
 * PDF source of truth is Grapes `project` — do not treat HTML-only export quirks as degradation.
 */
export function isGrapesDefinitionDegraded(
  next: GrapesTemplateDefinition | null | undefined,
  previous: GrapesTemplateDefinition | null | undefined
): boolean {
  if (!previous) return false;

  const prevHtml = String(previous.html || '').trim();
  const nextHtml = String(next?.html || '').trim();
  const prevProjectCount = countGrapesProjectComponents(previous.project);
  const nextProjectCount = countGrapesProjectComponents(next?.project);
  const prevHadContent = Boolean(prevHtml) || prevProjectCount > 0;
  const nextHasContent = Boolean(nextHtml) || nextProjectCount > 0;

  if (prevHadContent && !nextHasContent) return true;

  // Severe project shrink (PDF canvas structure).
  if (prevProjectCount > 15 && nextProjectCount < Math.floor(prevProjectCount * 0.4)) {
    return true;
  }

  // HTML structure loss only when project is also empty/tiny.
  if (
    nextProjectCount < 5
    && grapesHtmlLooksStructured(prevHtml)
    && !grapesHtmlLooksStructured(nextHtml)
  ) {
    return true;
  }

  // Severe HTML shrink only when project also collapsed.
  if (
    nextProjectCount < Math.floor(Math.max(prevProjectCount, 1) * 0.4)
    && prevHtml.length > 800
    && nextHtml.length < Math.floor(prevHtml.length * 0.4)
  ) {
    return true;
  }

  return false;
}

export function hasGrapesProjectContent(project: Record<string, unknown> | null | undefined): boolean {
  return countGrapesProjectComponents(project) > 0;
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
  isEmail: boolean,
  pageLayout?: PageLayoutOptions
): void {
  runWhenEditorCanvasReady(editor, () => {
    applyHtmlToEditorCanvas(editor, html, css, {
      isEmail,
      pageLayout: isEmail ? undefined : pageLayout
    });
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
          const layout = options.pageLayout;
          if (layout?.dimensions?.width && layout.dimensions.height) {
            applyPrintAreaLayout(editor, layout.dimensions, layout.marginsMm);
          }
        }
        const wrapper = editor.getWrapper();
        if (wrapper) {
          hydrateEditableTextComponents(wrapper);
        }
        hydrateTableCellsFromDom(editor);
        refreshCanvasTablesAfterHtmlApply(editor);
        hydrateCanvasImages(editor);
        // Re-apply after hydrate/repaint — those can restore fixed widths from DOM.
        if (!isEmail) {
          const layout = options.pageLayout;
          if (layout?.dimensions?.width && layout.dimensions.height) {
            applyPrintAreaLayout(editor, layout.dimensions, layout.marginsMm);
          }
        }
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

    applyCanvasHtml(editor, canvasHtml, css, msoChunks, isEmail, options.pageLayout);
    return;
  }

  runWhenEditorCanvasReady(editor, () => {
    editor.setComponents('');
    editor.setStyle('');
    clearEditorMsoChunks(editor);
  });
}

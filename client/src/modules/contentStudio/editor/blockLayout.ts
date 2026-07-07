import type { Editor } from '@tiptap/core';

export type TextAlignValue = 'left' | 'center' | 'right' | 'justify';
export type BlockWidthValue = 'content' | 'wide' | 'full';

export const TEXT_ALIGN_OPTIONS: TextAlignValue[] = ['left', 'center', 'right', 'justify'];
export const BLOCK_WIDTH_OPTIONS: BlockWidthValue[] = ['content', 'wide', 'full'];

export function normalizeBlockLayoutAttrs(partial: Record<string, unknown>): Record<string, unknown> {
  const next = { ...partial };
  if (next.textAlign === 'left') next.textAlign = null;
  if (next.blockWidth === 'content') next.blockWidth = null;
  if (next.fontSize === '') next.fontSize = null;
  if (next.textColor === '') next.textColor = null;
  if (next.lineHeight === '') next.lineHeight = null;
  if (next.marginTop === 0) next.marginTop = null;
  if (next.marginBottom === 0) next.marginBottom = null;
  if (next.padding === 0) next.padding = null;
  return next;
}

function mergeNodeAttrs(
  current: Record<string, unknown>,
  partial: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...current, ...partial };
  for (const [key, value] of Object.entries(partial)) {
    if (value === null || value === undefined) delete next[key];
  }
  return next;
}

export function applyBlockLayoutAttributes(
  editor: Editor | null | undefined,
  nodeType: string,
  partial: Record<string, unknown>,
  selectionSnapshot?: { from: number; to: number } | null,
): boolean {
  if (!editor) return false;
  const normalized = normalizeBlockLayoutAttrs(partial);

  let chain = editor.chain();
  if (selectionSnapshot) {
    chain = chain.setTextSelection(selectionSnapshot);
  }

  const applied = chain
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name !== nodeType) continue;
        const pos = $from.before(depth);
        tr.setNodeMarkup(pos, undefined, mergeNodeAttrs(node.attrs, normalized));
        if (dispatch) dispatch(tr);
        return true;
      }
      return false;
    })
    .run();

  if (applied) return true;

  return runInspectorEditorCommand(editor, selectionSnapshot, (chain) =>
    chain.updateAttributes(nodeType, normalized).run(),
  );
}

export function runInspectorEditorCommand(
  editor: Editor | null | undefined,
  selectionSnapshot: { from: number; to: number } | null | undefined,
  run: (chain: ReturnType<Editor['chain']>) => boolean,
): boolean {
  if (!editor) return false;
  let chain = editor.chain();
  if (selectionSnapshot) {
    chain = chain.setTextSelection(selectionSnapshot);
  }
  return run(chain);
}

export function updateInspectorNodeAttributes(
  editor: Editor | null | undefined,
  nodeType: string,
  partial: Record<string, unknown>,
  selectionSnapshot?: { from: number; to: number } | null,
): boolean {
  return runInspectorEditorCommand(editor, selectionSnapshot, (chain) =>
    chain.updateAttributes(nodeType, partial).run(),
  );
}

export function renderLayoutAttrs(attrs: Record<string, unknown> = {}) {
  const parts: string[] = [];
  const classes: string[] = [];

  const textAlign = attrs.textAlign ? String(attrs.textAlign) : '';
  if (textAlign) parts.push(`text-align:${textAlign}`);

  const fontSize = attrs.fontSize ? String(attrs.fontSize) : '';
  if (fontSize) parts.push(`font-size:${fontSize}`);

  const textColor = attrs.textColor ? String(attrs.textColor) : '';
  if (textColor) parts.push(`color:${textColor}`);

  const lineHeight = attrs.lineHeight ? String(attrs.lineHeight) : '';
  if (lineHeight) parts.push(`line-height:${lineHeight}`);

  if (attrs.marginTop != null && Number(attrs.marginTop) > 0) {
    parts.push(`margin-top:${Number(attrs.marginTop)}px`);
  }
  if (attrs.marginBottom != null && Number(attrs.marginBottom) > 0) {
    parts.push(`margin-bottom:${Number(attrs.marginBottom)}px`);
  }
  if (attrs.padding != null && Number(attrs.padding) > 0) {
    parts.push(`padding:${Number(attrs.padding)}px`);
  }

  const blockWidth = attrs.blockWidth ? String(attrs.blockWidth) : '';
  if (blockWidth && blockWidth !== 'content') {
    classes.push(`content-block-width-${blockWidth}`);
  }

  const style = parts.length ? parts.join(';') : '';
  return { style, className: classes.join(' ') };
}

export function mergeLayoutIntoElement(
  baseAttrs: Record<string, string>,
  layoutAttrs: Record<string, unknown>,
): Record<string, string> {
  const { style, className } = renderLayoutAttrs(layoutAttrs);
  const merged = { ...baseAttrs };
  if (style) {
    merged.style = merged.style ? `${merged.style};${style}` : style;
  }
  if (className) {
    merged.class = merged.class ? `${merged.class} ${className}` : className;
  }
  return merged;
}

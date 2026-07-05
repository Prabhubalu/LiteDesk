import type { Editor } from 'grapesjs';
import { buildLineItemBlockHtml } from './lineItemHtml';
import { getLineItemTemplateModuleScope } from './lineItemComponent';
import { ARIVU_BLOCK_DEFINITIONS, getArivuBlockDefinition } from './arivuBlockContent';
import { resolveInsertTarget } from './printArea';

const LINE_ITEM_PLACEHOLDER = '__LINE_ITEM__';

export type BlockContent = string | Record<string, unknown> | Array<Record<string, unknown>>;

export function resolveArivuBlockContent(blockId: string): string | null {
  const definition = getArivuBlockDefinition(blockId);
  if (!definition) return null;
  if (definition.content === LINE_ITEM_PLACEHOLDER) {
    return buildLineItemBlockHtml(getLineItemTemplateModuleScope());
  }
  return definition.content;
}

export function isArivuBlockId(blockId: string): boolean {
  return Boolean(getArivuBlockDefinition(blockId));
}

function readBlockManagerContent(editor: Editor, blockId: string): BlockContent | null {
  const block = editor.BlockManager.get(blockId);
  if (!block) return null;

  const getContent = block.getContent as (() => BlockContent) | undefined;
  if (typeof getContent === 'function') {
    const resolved = getContent.call(block);
    if (resolved != null) return resolved;
  }

  const raw = block.get('content') as BlockContent | (() => BlockContent) | null | undefined;
  if (raw == null) return null;
  if (typeof raw === 'function') {
    const resolved = raw();
    return resolved ?? null;
  }
  return raw;
}

/** Resolve canvas content for a catalog block id (HTML string or Grapes component definition). */
export function resolveBlockContent(editor: Editor, blockId: string): BlockContent | null {
  const arivuContent = resolveArivuBlockContent(blockId);
  if (arivuContent) return arivuContent;
  return readBlockManagerContent(editor, blockId);
}

/** Arivu-specific blocks layered on official GrapesJS plugins. */
export function registerArivuBlocks(editor: Editor, outputFormat = 'pdf'): void {
  const format = outputFormat === 'email' ? 'email' : 'print';
  const bm = editor.BlockManager;
  const category = 'Arivu';

  for (const block of ARIVU_BLOCK_DEFINITIONS) {
    if (!block.formats.includes('all') && !block.formats.includes(format)) continue;

    bm.add(block.id, {
      label: block.label,
      category,
      content: block.content === LINE_ITEM_PLACEHOLDER ? buildLineItemBlockHtml() : block.content,
      activate: true,
      select: true
    });
  }
}

export function addBlockToCanvas(editor: Editor, blockId: string): void {
  const content = resolveBlockContent(editor, blockId);
  if (content == null) return;

  const dropTarget = resolveInsertTarget(editor);
  if (!dropTarget) return;

  dropTarget.append(content);
}

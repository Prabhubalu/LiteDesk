import type { Editor } from 'grapesjs';
import { buildLineItemBlockHtml } from './lineItemHtml';
import { getLineItemTemplateModuleScope } from './lineItemComponent';

export const GRAPES_BLOCK_DRAG_MIME = 'application/x-arivu-grapes-block';

type BlockManagerWithDrag = Editor['BlockManager'] & {
  __drag?: (event: DragEvent) => void;
};

export function startLibraryBlockDrag(editor: Editor, blockId: string, event: DragEvent): boolean {
  const block = editor.BlockManager.get(blockId);
  if (!block) return false;

  editor.refresh();
  editor.BlockManager.startDrag(block, event);

  if (event.dataTransfer) {
    event.dataTransfer.setData(GRAPES_BLOCK_DRAG_MIME, blockId);
    event.dataTransfer.setData('text/plain', blockId);
    event.dataTransfer.effectAllowed = 'copy';
    if (event.currentTarget instanceof HTMLElement) {
      event.dataTransfer.setDragImage(event.currentTarget, 40, 24);
    }
  }

  return true;
}

export function moveLibraryBlockDrag(editor: Editor, event: DragEvent): void {
  const manager = editor.BlockManager as BlockManagerWithDrag;
  manager.__drag?.(event);
}

export function endLibraryBlockDrag(editor: Editor, cancelled = false): void {
  editor.BlockManager.endDrag(cancelled);
}

export function setupExternalBlockDrop(editor: Editor): void {
  editor.on('canvas:dragdata', (dataTransfer: DataTransfer, result: { content: unknown; setContent: (c: unknown) => void }) => {
    const types = dataTransfer?.types || [];
    if (!types.includes(GRAPES_BLOCK_DRAG_MIME) && !types.includes('text/plain')) return;

    const blockId = dataTransfer.getData(GRAPES_BLOCK_DRAG_MIME) || dataTransfer.getData('text/plain');
    if (!blockId) return;

    const block = editor.BlockManager.get(blockId);
    let content = block?.get('content');
    if (blockId === 'line-item') {
      content = buildLineItemBlockHtml(getLineItemTemplateModuleScope());
    }
    if (content) {
      result.setContent(content);
    }
  });
}

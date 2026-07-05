import type { CanvasDragDataResult, Component, Editor } from 'grapesjs';
import { isArivuBlockId, resolveArivuBlockContent, resolveBlockContent } from './blocks';

export const GRAPES_BLOCK_DRAG_MIME = 'application/x-arivu-grapes-block';

type BlockManagerWithDrag = Editor['BlockManager'] & {
  __drag?: (event: DragEvent) => void;
};

let activeDragBlockId: string | null = null;
let dragDropCommitted = false;

function resetDragFlags(): void {
  activeDragBlockId = null;
  dragDropCommitted = false;
}

function ensureDragBlock(editor: Editor, blockId: string) {
  const existing = editor.BlockManager.get(blockId);
  if (existing) return existing;

  const content = resolveBlockContent(editor, blockId);
  if (content == null) return null;

  return editor.BlockManager.add(blockId, {
    label: blockId,
    category: 'Arivu',
    content,
    activate: true,
    select: true
  });
}

export function startLibraryBlockDrag(editor: Editor, blockId: string, event: DragEvent): boolean {
  const block = ensureDragBlock(editor, blockId);
  if (!block) return false;

  activeDragBlockId = blockId;
  dragDropCommitted = false;
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
  if (cancelled || !dragDropCommitted) {
    resetDragFlags();
  }
}

function selectDroppedComponent(editor: Editor, model: Component | Component[] | null | undefined): void {
  if (!model) return;
  const target = Array.isArray(model) ? model[0] : model;
  if (target) {
    editor.select(target);
  }
}

export function setupExternalBlockDrop(editor: Editor): void {
  editor.on('canvas:dragdata', (dataTransfer: DataTransfer | null | undefined, result: CanvasDragDataResult) => {
    const types = dataTransfer?.types || [];
    if (!dataTransfer) return;
    if (!types.includes(GRAPES_BLOCK_DRAG_MIME) && !types.includes('text/plain')) return;

    const blockId =
      activeDragBlockId
      || dataTransfer.getData(GRAPES_BLOCK_DRAG_MIME)
      || dataTransfer.getData('text/plain');
    if (!blockId) return;

    // Only override Grapes drop parsing for Arivu blocks (HTML + dynamic line items).
    // Official Grapes blocks use component-definition objects; stringifying them yields "[object Object]".
    if (!isArivuBlockId(blockId)) return;

    const content = resolveArivuBlockContent(blockId) ?? resolveBlockContent(editor, blockId);
    if (content != null) {
      result.setContent(content);
    }
  });

  editor.on('canvas:drop', (_dataTransfer, model) => {
    dragDropCommitted = true;
    selectDroppedComponent(editor, model);
    resetDragFlags();
  });

  editor.on('canvas:dragend', () => {
    if (!dragDropCommitted) {
      editor.BlockManager.endDrag(true);
      resetDragFlags();
    }
  });

  const onWindowDragEnd = () => {
    if (!dragDropCommitted) {
      editor.BlockManager.endDrag(true);
      resetDragFlags();
    }
  };
  window.addEventListener('dragend', onWindowDragEnd);

  editor.on('destroy', () => {
    window.removeEventListener('dragend', onWindowDragEnd);
  });
}

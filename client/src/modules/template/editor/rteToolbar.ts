import type { Component, Editor } from 'grapesjs';

function getToolbarEl(editor: Editor): HTMLElement | null {
  const toolbar = editor.RichTextEditor?.getToolbarEl?.();
  return toolbar instanceof HTMLElement ? toolbar : null;
}

export function hideRteToolbar(editor: Editor): void {
  editor.RichTextEditor?.hideToolbar?.();
  const toolbar = getToolbarEl(editor);
  if (!toolbar) return;
  toolbar.style.display = 'none';
  toolbar.dataset.arivuRteVisible = 'false';
}

function showRteToolbar(editor: Editor): void {
  const toolbar = getToolbarEl(editor);
  if (!toolbar) return;
  toolbar.style.display = '';
  toolbar.dataset.arivuRteVisible = 'true';
  editor.RichTextEditor?.updatePosition?.();
}

function hasHighlightedText(doc: Document): boolean {
  const sel = doc.getSelection();
  return Boolean(sel && !sel.isCollapsed && sel.toString().length > 0);
}

function bindToolbarToTextSelection(editor: Editor, hostEl: HTMLElement): void {
  const doc = hostEl.ownerDocument;

  const sync = () => {
    if (!editor.getEditing?.()) {
      hideRteToolbar(editor);
      return;
    }
    if (hasHighlightedText(doc)) {
      showRteToolbar(editor);
    } else {
      hideRteToolbar(editor);
    }
  };

  doc.addEventListener('mouseup', sync);
  doc.addEventListener('keyup', sync);

  editor.once('rte:disable', () => {
    doc.removeEventListener('mouseup', sync);
    doc.removeEventListener('keyup', sync);
  });

  hideRteToolbar(editor);
}

/** Exit Grapes inline text edit mode and hide the formatting toolbar. */
export function dismissCanvasInlineEditing(editor: Editor): void {
  const editing = editor.getEditing?.() as Component | undefined;
  if (editing) {
    const view = editing.view as { onDisable?: () => void } | undefined;
    if (view?.onDisable) {
      view.onDisable();
    } else {
      editing.trigger?.('disable');
    }
  }
  hideRteToolbar(editor);
}

/** Formatting toolbar appears only when the user highlights text during inline edit. */
export function configureRteToolbarVisibility(editor: Editor): void {
  hideRteToolbar(editor);

  editor.on('load', () => hideRteToolbar(editor));
  editor.on('rte:enable', (view: { el?: HTMLElement; model?: Component }) => {
    const host = view?.el ?? view?.model?.view?.el;
    if (host instanceof HTMLElement) {
      bindToolbarToTextSelection(editor, host);
    } else {
      hideRteToolbar(editor);
    }
  });
  editor.on('rte:disable', () => hideRteToolbar(editor));
  editor.on('component:selected', () => {
    if (!editor.getEditing?.()) hideRteToolbar(editor);
  });
  editor.on('component:deselected', () => hideRteToolbar(editor));
}

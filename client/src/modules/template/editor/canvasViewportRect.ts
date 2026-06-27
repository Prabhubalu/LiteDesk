import type { Editor } from 'grapesjs';

function frameClientRect(editor: Editor): { left: number; top: number } {
  const frame = editor.Canvas.getFrameEl?.();
  const rect = frame?.getBoundingClientRect?.();
  return {
    left: rect?.left ?? 0,
    top: rect?.top ?? 0
  };
}

/** Map an element inside the GrapesJS canvas iframe to parent-window viewport coordinates. */
export function canvasElementViewportRect(
  editor: Editor,
  element: HTMLElement | null | undefined
): DOMRect | null {
  if (!element) return null;

  const inner = element.getBoundingClientRect();
  const frame = frameClientRect(editor);

  return new DOMRect(
    frame.left + inner.left,
    frame.top + inner.top,
    inner.width,
    inner.height
  );
}

/** Map a pointer event raised inside the canvas iframe to parent-window viewport coordinates. */
export function canvasPointerViewportPoint(
  editor: Editor,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const frame = frameClientRect(editor);
  return {
    x: frame.left + clientX,
    y: frame.top + clientY
  };
}

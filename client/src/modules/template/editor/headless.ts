import type { Editor } from 'grapesjs';

const HEADLESS_COMMANDS = [
  'open-sm',
  'open-tm',
  'open-layers',
  'open-blocks',
  'sw-visibility',
  'core:component-outline',
  'preview',
  'fullscreen',
  'export-template',
  'gjs-open-import-webpage',
  'canvas-clear'
] as const;

/** Remove GrapesJS chrome — Vue owns toolbar, library, and properties. */
export function stripDefaultPanels(editor: Editor): void {
  HEADLESS_COMMANDS.forEach((id) => {
    if (editor.Commands.isActive(id)) {
      editor.stopCommand(id);
    }
  });

  editor.Panels.getPanels().reset([]);

  const root = editor.getContainer();
  if (!root) return;

  root.querySelectorAll('.gjs-pn-panels, .gjs-pn-panel, #views-container').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.display = 'none';
    }
  });

  // Preset plugins enable component outlines (dashed borders) — keep canvas clean.
  editor.Canvas.getFrames().forEach((frame) => {
    frame.view?.getBody()?.classList.remove('gjs-dashed');
  });
}

export function applyHeadlessEditor(editor: Editor): void {
  const strip = () => stripDefaultPanels(editor);
  editor.on('load', strip);
  queueMicrotask(strip);
}

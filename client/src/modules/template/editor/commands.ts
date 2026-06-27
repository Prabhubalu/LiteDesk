import type { Editor } from 'grapesjs';

export function registerCommands(editor: Editor): void {
  editor.Commands.add('template:clear-canvas', {
    run(ed) {
      ed.setComponents('');
      ed.setStyle('');
    }
  });
}

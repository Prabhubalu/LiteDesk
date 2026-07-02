import type { Editor } from 'grapesjs';

const msoChunksByEditor = new WeakMap<Editor, string[]>();

export function setEditorMsoChunks(editor: Editor, chunks: string[]): void {
  msoChunksByEditor.set(editor, chunks);
}

export function getEditorMsoChunks(editor: Editor): string[] {
  return msoChunksByEditor.get(editor) || [];
}

export function clearEditorMsoChunks(editor: Editor): void {
  msoChunksByEditor.delete(editor);
}

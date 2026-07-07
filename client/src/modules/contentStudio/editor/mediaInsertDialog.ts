import type { Editor } from '@tiptap/core';

export type MediaInsertBlockType = 'audio' | 'file' | 'embed';

export interface MediaInsertValues {
  title: string;
  url: string;
  info: string;
}

export type MediaInsertRequestHandler = (type: MediaInsertBlockType) => Promise<MediaInsertValues | null>;

const mediaInsertHandlers = new WeakMap<Editor, MediaInsertRequestHandler>();

export function registerContentStudioMediaInsertHandler(editor: Editor, handler: MediaInsertRequestHandler) {
  mediaInsertHandlers.set(editor, handler);
}

export function unregisterContentStudioMediaInsertHandler(editor: Editor) {
  mediaInsertHandlers.delete(editor);
}

export function requestMediaInsert(editor: Editor, type: MediaInsertBlockType): Promise<MediaInsertValues | null> {
  const handler = mediaInsertHandlers.get(editor);
  if (!handler) return Promise.resolve(null);
  return handler(type);
}

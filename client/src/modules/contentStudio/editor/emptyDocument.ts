import type { ProseMirrorJson } from '../types/contentStudio';

export function createEmptyContentDocument(): ProseMirrorJson {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [],
      },
    ],
  };
}

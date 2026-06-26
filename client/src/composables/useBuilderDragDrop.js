/**
 * Shared HTML5 drag-and-drop handlers for builder panels.
 */
import { computed, inject, ref } from 'vue';
import {
  BUILDER_DRAG_TYPES,
  readBuilderDragPayload
} from '@/constants/builderDragTypes';
import { BUILDER_DROP_KEY } from '@/constants/builderInjectKeys';

export function parseBuilderDropPayload(event) {
  const types = [
    BUILDER_DRAG_TYPES.COMPONENT,
    BUILDER_DRAG_TYPES.MERGE_TAG,
    'text/plain'
  ];

  for (const mimeType of types) {
    const raw = readBuilderDragPayload(event, mimeType);
    if (!raw) continue;

    if (typeof raw === 'string') {
      if (mimeType === BUILDER_DRAG_TYPES.MERGE_TAG) {
        return { kind: 'merge-tag', path: raw };
      }
      return { kind: 'component', type: raw };
    }

    if (raw.kind === 'merge-tag' && raw.path) {
      return { kind: 'merge-tag', path: raw.path };
    }
    if (raw.kind === 'component' && raw.type) {
      return { kind: 'component', type: raw.type };
    }
    if (raw.type && !raw.kind) {
      return { kind: 'component', type: raw.type };
    }
  }

  return null;
}

export function useBuilderDropZone(onDropCallback) {
  const isDragOver = ref(false);

  function onDragOver(event) {
    event.preventDefault();
    isDragOver.value = true;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function onDragLeave() {
    isDragOver.value = false;
  }

  function onDrop(event) {
    event.preventDefault();
    isDragOver.value = false;
    const payload = parseBuilderDropPayload(event);
    if (payload) onDropCallback(payload, event);
  }

  return {
    isDragOver,
    onDragOver,
    onDragLeave,
    onDrop
  };
}

export function startComponentDrag(event, componentType) {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData(
    BUILDER_DRAG_TYPES.COMPONENT,
    JSON.stringify({ kind: 'component', type: componentType })
  );
  event.dataTransfer.effectAllowed = 'copy';
}

export function startMergeTagDrag(event, path) {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData(
    BUILDER_DRAG_TYPES.MERGE_TAG,
    JSON.stringify({ kind: 'merge-tag', path })
  );
  event.dataTransfer.effectAllowed = 'copy';
}

export function useBuilderDropTarget(parentId, context = {}) {
  const dropHandler = inject(BUILDER_DROP_KEY, null);
  const { mergeOnly = false, ...dropContext } = context;

  return useBuilderDropZone((payload) => {
    if (!dropHandler) return;
    if (mergeOnly && payload.kind !== 'merge-tag') return;
    dropHandler(payload, { parentId, ...dropContext });
  });
}

export function useBuilderDropHighlightClass(isDragOver) {
  return computed(() =>
    isDragOver.value ? 'ring-2 ring-primary-400/60 bg-primary-50/40 dark:bg-primary-950/20' : ''
  );
}

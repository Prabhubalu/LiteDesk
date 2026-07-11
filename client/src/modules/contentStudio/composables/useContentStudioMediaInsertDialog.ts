import { ref } from 'vue';
import type { MediaInsertBlockType, MediaInsertValues } from '../editor/mediaInsertDialog';

export function useContentStudioMediaInsertDialog() {
  const open = ref(false);
  const blockType = ref<MediaInsertBlockType>('embed');
  let pendingResolve: ((value: MediaInsertValues | null) => void) | null = null;

  function request(type: MediaInsertBlockType): Promise<MediaInsertValues | null> {
    blockType.value = type;
    open.value = true;
    return new Promise((resolve) => {
      pendingResolve = resolve;
    });
  }

  function submit(values: MediaInsertValues) {
    open.value = false;
    pendingResolve?.(values);
    pendingResolve = null;
  }

  function cancel() {
    open.value = false;
    pendingResolve?.(null);
    pendingResolve = null;
  }

  return {
    open,
    blockType,
    request,
    submit,
    cancel,
  };
}

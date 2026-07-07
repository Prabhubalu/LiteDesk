import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import type { Editor } from '@tiptap/core';

interface UseContentStudioKeyboardShortcutsOptions {
  editor: Ref<Editor | null | undefined>;
  onSave: () => void;
  linkPrompt: (current?: string) => string | null;
}

export function useContentStudioKeyboardShortcuts(options: UseContentStudioKeyboardShortcutsOptions) {
  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || target?.isContentEditable === false) {
      if (!(event.metaKey || event.ctrlKey)) return;
    }

    const mod = event.metaKey || event.ctrlKey;
    const ed = options.editor.value;
    if (!ed) return;

    if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault();
      options.onSave();
      return;
    }

    if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const current = ed.getAttributes('link')?.href as string | undefined;
      const href = options.linkPrompt(current);
      if (!href) return;
      if (href === '__remove__') {
        ed.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }
      ed.chain().focus().extendMarkRange('link').setLink({ href }).run();
      return;
    }

    if (mod && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      ed.chain().focus().toggleBold().run();
      return;
    }

    if (mod && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      ed.chain().focus().toggleItalic().run();
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
}

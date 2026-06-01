<template>
  <div class="task-description-editor rounded-lg border border-gray-200/70 dark:border-gray-700/70 bg-white dark:bg-gray-800 overflow-hidden outline-1 -outline-offset-1 outline-gray-200/40 dark:outline-white/10 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-indigo-500 dark:focus-within:outline-indigo-500">
    <!-- Bubble menu (Notion-style: appears on text selection) -->
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :tippy-options="{ duration: 100, placement: 'top' }"
      class="flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1 px-1"
    >
      <div class="flex items-center gap-0.5" @mousedown.prevent>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorHeading1')"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
      >
        <span class="font-bold text-base">H1</span>
      </button>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorHeading2')"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        <span class="font-semibold text-sm">H2</span>
      </button>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorHeading3')"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
      >
        <span class="font-medium text-sm">H3</span>
      </button>
      <span class="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorBold')"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <span class="font-bold text-sm">B</span>
      </button>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorItalic')"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <span class="italic text-sm">I</span>
      </button>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('strike') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorStrikethrough')"
        @click="editor.chain().focus().toggleStrike().run()"
      >
        <span class="line-through text-sm">S</span>
      </button>
      <span class="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorBulletList')"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 6a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2zM8 5h10a1 1 0 010 2H8a1 1 0 010-2zm0 4h10a1 1 0 110 2H8a1 1 0 110-2zm0 4h10a1 1 0 110 2H8a1 1 0 110-2z" />
        </svg>
      </button>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorNumberedList')"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 4h14v1.5H2V4zm0 5h14v1.5H2V9zm0 5h14v1.5H2V14zM17 4v1.5h1V4h-1zm0 5v1.5h1V9h-1zm0 5v1.5h1V14h-1z" />
        </svg>
      </button>
      <span class="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <Popover v-slot="{ close }" class="relative">
        <PopoverButton
          type="button"
          :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('link') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
          :title="t('settings.modFieldsPbResourceLink')"
          @click="handleLinkButtonClick"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </PopoverButton>
        <PopoverPanel
          class="absolute left-0 top-full mt-1 w-72 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg p-3 z-50 focus:outline-none"
        >
          <div class="space-y-2">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">URL</label>
            <input
              ref="linkInputRef"
              v-model="linkUrl"
              type="url"
              placeholder="https://"
              class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
              @keydown.enter.prevent="applyLink(close)"
              @keydown.escape="close"
            />
            <div class="flex gap-2 justify-end">
              <button
                type="button"
                class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                @click="close"
              >{{ t('performance.cancelWizard') }}</button>
              <button
                type="button"
                :disabled="!canApplyLink"
                class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                @click="applyLink(close)"
              >{{ t('actions.apply') }}</button>
            </div>
          </div>
        </PopoverPanel>
      </Popover>
      <button
        v-if="editor.isActive('link')"
        type="button"
        class="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        :title="t('records.taskDescriptionEditorRemoveLink')"
        @click="editor.chain().focus().unsetLink().run()"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      </div>
    </BubbleMenu>
    <!-- Editor content -->
    <EditorContent
      :editor="editor"
      class="[&_.tiptap]:min-h-[120px] [&_.tiptap]:text-md [&_.tiptap]:leading-[1.75] [&_.tiptap_p]:mb-2 [&_.tiptap_p:last-child]:mb-0 [&_.tiptap_p]:leading-[1.75] [&_.tiptap_h1]:text-2xl [&_.tiptap_h1]:font-bold [&_.tiptap_h1]:my-4 [&_.tiptap_h1]:mb-2 [&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:my-4 [&_.tiptap_h2]:mb-2 [&_.tiptap_h3]:text-lg [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:my-4 [&_.tiptap_h3]:mb-2 [&_.tiptap_ul]:pl-6 [&_.tiptap_ol]:pl-6 [&_.tiptap_ul]:list-disc [&_.tiptap_ol]:list-decimal [&_.tiptap_a]:text-indigo-600 [&_.tiptap_a]:underline dark:[&_.tiptap_a]:text-indigo-400 [&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-gray-300 [&_.tiptap_blockquote]:bg-gray-50 [&_.tiptap_blockquote]:px-3 [&_.tiptap_blockquote]:py-2 [&_.tiptap_blockquote]:my-2 dark:[&_.tiptap_blockquote]:border-gray-600 dark:[&_.tiptap_blockquote]:bg-gray-800/60"
    />
    <!-- Cmd/Ctrl+K: BubbleMenu/Tippy prevents reliable programmatic Popover open; use a body Teleport -->
    <TaskDescriptionLinkShortcutPanel
      :open="shortcutLinkPanelOpen"
      :panel-style="shortcutLinkPanelStyle"
      :link-url="linkUrl"
      :can-apply="canApplyLink"
      @update:link-url="linkUrl = $event"
      @apply="applyShortcutLink"
      @close="closeShortcutLinkPanel"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import StarterKit from '@tiptap/starter-kit';
import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { SlashCommands } from './slashCommands.js';
import TaskDescriptionLinkShortcutPanel from './TaskDescriptionLinkShortcutPanel.vue';
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: "Write or type '/' for commands"
  }
});

const { t } = useI18n();

const emit = defineEmits(['update:modelValue', 'blur', 'cancel']);

const linkUrl = ref('https://');

/** True once the field has real URL content (not empty / not only scheme prefix). */
const canApplyLink = computed(() => {
  const trimmed = (linkUrl.value || '').trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower === 'https://' || lower === 'http://') return false;
  return true;
});

const linkInputRef = ref(null);
const shortcutLinkPanelOpen = ref(false);
const shortcutLinkPanelStyle = ref({});

/** Populated once TipTap mounts; avoids TDZ when useEditor callbacks run. */
const editorInstance = { current: null };

function closeShortcutLinkPanel() {
  shortcutLinkPanelOpen.value = false;
}

function computeShortcutPanelPosition(ed) {
  if (!ed?.view) return {};
  const { from, to } = ed.state.selection;
  if (from === to) return {};
  const view = ed.view;
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  const leftEdge = Math.min(start.left, end.left, start.right, end.right);
  const bottomEdge = Math.max(start.bottom, end.bottom);
  const panelW = 288;
  const margin = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const clampedLeft = Math.min(Math.max(leftEdge, margin), vw - panelW - margin);
  return {
    position: 'fixed',
    left: `${clampedLeft}px`,
    top: `${bottomEdge + 4}px`,
    zIndex: 12000
  };
}

function syncLinkUrlFromSelection() {
  linkUrl.value = editorInstance.current?.getAttributes('link')?.href || 'https://';
}

function openLinkEditorFromShortcut() {
  const ed = editorInstance.current;
  if (!ed || ed.state.selection.empty) return;
  syncLinkUrlFromSelection();
  shortcutLinkPanelStyle.value = computeShortcutPanelPosition(ed);
  shortcutLinkPanelOpen.value = true;
}

function applyShortcutLink() {
  if (!canApplyLink.value) return;
  const url = linkUrl.value.trim();
  editorInstance.current?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  closeShortcutLinkPanel();
}

const ReplyQuoteBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      replyQuote: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-reply-quote'),
        renderHTML: (attributes) => (
          attributes.replyQuote ? { 'data-reply-quote': String(attributes.replyQuote) } : {}
        )
      },
      collapsed: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-collapsed'),
        renderHTML: (attributes) => (
          attributes.collapsed ? { 'data-collapsed': String(attributes.collapsed) } : {}
        )
      }
    };
  }
});

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      heading: false,
      blockquote: false
    }),
    ReplyQuoteBlockquote,
    Heading.configure({
      levels: [1, 2, 3]
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-indigo-600 dark:text-indigo-400 underline hover:no-underline',
        target: '_blank',
        rel: 'noopener noreferrer'
      }
    }),
    Placeholder.configure({
      placeholder: props.placeholder
    }),
    SlashCommands
  ],
  editorProps: {
    attributes: {
      class: 'rte-content min-h-[120px] px-6 py-4 text-md text-gray-900 dark:text-white focus:outline-none'
    },
    handleKeyDown: (view, event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        const { empty } = view.state.selection;
        // Keep global Cmd/Ctrl+K behavior unless there's an active text selection in this editor.
        if (empty) return false;
        event.preventDefault();
        openLinkEditorFromShortcut();
        return true;
      }
      if (shortcutLinkPanelOpen.value && event.key === 'Escape') {
        event.preventDefault();
        closeShortcutLinkPanel();
        return true;
      }
      if (event.key === 'Escape') {
        emit('cancel');
        return true;
      }
      return false;
    },
    handleClick: (view, pos, event) => {
      const target = event?.target;
      if (!(target instanceof Element)) return false;
      const quoteEl = target.closest('blockquote[data-reply-quote]');
      if (!quoteEl) return false;
      const quotePos = view.posAtDOM(quoteEl, 0);
      const $pos = view.state.doc.resolve(Math.max(0, quotePos));
      for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth);
        if (node.type.name !== 'blockquote') continue;
        const nodePos = $pos.before(depth);
        const isCollapsed = String(node.attrs?.collapsed || '').toLowerCase() === 'true';
        const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
          ...node.attrs,
          replyQuote: 'true',
          collapsed: isCollapsed ? 'false' : 'true'
        });
        view.dispatch(tr);
        return true;
      }
      return false;
    }
  },
  onBlur: ({ event, editor: ed }) => {
    // Defer to avoid blur when clicking BubbleMenu (tippy-box) or slash command menu
    setTimeout(() => {
      if (!ed.isFocused) {
        const target = event?.relatedTarget;
        const isInteractiveMenu = target && typeof target.closest === 'function' &&
          (target.closest('.slash-command-list') || target.closest('.tippy-box') || target.closest('.task-description-link-shortcut'));
        if (!isInteractiveMenu) {
          emit('blur');
        }
      }
    }, 0);
  },
  onCreate: ({ editor: ed }) => {
    editorInstance.current = ed;
  },
  onDestroy: () => {
    editorInstance.current = null;
  },
  onUpdate: ({ editor: e }) => {
    emit('update:modelValue', e.getHTML());
  }
});

watch(
  () => props.modelValue,
  (newVal) => {
    const current = editor.value?.getHTML();
    const normalized = newVal?.trim() || '';
    const currentNorm = current?.trim() || '';
    if (editor.value && normalized !== currentNorm) {
      editor.value.commands.setContent(normalized, false);
    }
  },
  { immediate: false }
);

const focusLinkInput = () => {
  window.setTimeout(() => {
    linkInputRef.value?.focus();
    linkInputRef.value?.select();
  }, 0);
};

const handleLinkButtonClick = () => {
  closeShortcutLinkPanel();
  syncLinkUrlFromSelection();
  nextTick(() => focusLinkInput());
};

const applyLink = (close) => {
  if (!canApplyLink.value) return;
  const url = linkUrl.value.trim();
  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  close?.();
};

const focus = () => {
  editor.value?.commands.focus();
};

const insertText = (text) => {
  const value = String(text || '');
  if (!value || !editor.value) return;
  editor.value.chain().focus().insertContent(value).run();
};

defineExpose({ focus, insertText });
</script>

<style scoped>
/* TipTap Placeholder: show on any empty paragraph (new line) */
/* emptyNodeClass='is-empty' for empty nodes; emptyEditorClass='is-editor-empty' when doc is empty */
.task-description-editor :deep(.tiptap p.is-empty::before),
.task-description-editor :deep(.tiptap p.is-editor-empty::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: #9ca3af;
}
/* Stabilize last line: prevent empty trailing block from collapsing and causing jitter */
.task-description-editor :deep(.tiptap p:last-child) {
  min-height: 1.75em;
}

/* Gmail-like collapsed quoted history in replies */
.task-description-editor :deep(.tiptap blockquote[data-reply-quote]) {
  border-left: 3px solid #d1d5db;
  background: #f9fafb;
  border-radius: 0.25rem;
  margin: 0.5rem 0;
  padding: 0.5rem 0.75rem;
}

.task-description-editor :deep(.tiptap blockquote[data-reply-quote][data-collapsed="true"]) {
  cursor: pointer;
  padding-top: 0.35rem;
  padding-bottom: 0.35rem;
}

.task-description-editor :deep(.tiptap blockquote[data-reply-quote][data-collapsed="true"] > *) {
  display: none;
}

.task-description-editor :deep(.tiptap blockquote[data-reply-quote][data-collapsed="true"]::before) {
  content: "...";
  color: #6b7280;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.task-description-editor :deep(.dark .tiptap blockquote[data-reply-quote]) {
  border-left-color: #4b5563;
  background: rgba(31, 41, 55, 0.6);
}
</style>

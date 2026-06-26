<template>
  <div
    ref="editorRef"
    contenteditable="true"
    spellcheck="true"
    class="outline-none empty:before:text-neutral-400 empty:before:content-[attr(data-placeholder)]"
    :class="[textClass, editorStateClass, multiline ? 'block w-full min-h-[3rem] whitespace-pre-wrap' : '']"
    :style="editorStyle"
    :data-placeholder="placeholder"
    @focus="onFocus"
    @blur="onBlur"
    @input="onInput"
    @keydown="onKeyDown"
    @dragover="onMergeDragOver"
    @dragleave="onMergeDragLeave"
    @drop="onMergeDrop"
  />
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue';
import { BUILDER_ACTIVE_TEXT_EDITOR_KEY, BUILDER_DELETE_NODE_KEY } from '@/constants/builderInjectKeys';
import { BUILDER_DRAG_TYPES } from '@/constants/builderDragTypes';
import { useBuilderDropTarget } from '@/composables/useBuilderDragDrop';
import {
  bindingTextToEditorHtml,
  execEditorCommand,
  insertTextAtContentEditable,
  readEditorHtml,
  sanitizeRichTextHtml
} from '@/utils/builderRichText';
import {
  chipHtmlToMergeTokens,
  mergeTokensToChipHtml
} from '@/utils/builderMergeTagHtml';

const props = defineProps({
  nodeId: { type: String, required: true },
  text: { type: String, default: '' },
  isSelected: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  textClass: { type: String, default: '' },
  textAlign: { type: String, default: 'left' },
  fontSize: { type: Number, default: null },
  fontWeight: { type: Number, default: null },
  bindingField: { type: String, default: 'text' },
  enterBehavior: { type: String, default: 'continue' },
  multiline: { type: Boolean, default: false },
  plainText: { type: Boolean, default: false }
});

const emit = defineEmits(['select', 'patch', 'format-state', 'remove', 'continue-after']);

const editorRef = ref(null);
const isFocused = ref(false);
const activeTextEditor = inject(BUILDER_ACTIVE_TEXT_EDITOR_KEY, null);
const deleteNode = inject(BUILDER_DELETE_NODE_KEY, null);
let syncFromProps = false;

const { onDragOver, onDragLeave, onDrop } = useBuilderDropTarget(props.nodeId, {
  targetNodeId: props.nodeId,
  mergeOnly: true
});

function isMergeTagDragEvent(event) {
  return Boolean(event.dataTransfer?.types?.includes(BUILDER_DRAG_TYPES.MERGE_TAG));
}

function onMergeDragOver(event) {
  if (!isMergeTagDragEvent(event)) return;
  event.stopPropagation();
  onDragOver(event);
}

function onMergeDragLeave(event) {
  if (!isMergeTagDragEvent(event)) return;
  event.stopPropagation();
  onDragLeave();
}

function onMergeDrop(event) {
  if (!isMergeTagDragEvent(event)) return;
  event.stopPropagation();
  onDrop(event);
}

const editorStyle = computed(() => ({
  textAlign: props.textAlign || 'left',
  fontSize: props.fontSize ? `${props.fontSize}px` : undefined,
  fontWeight: props.fontWeight || undefined
}));

const editorStateClass = computed(() => {
  if (props.isSelected) {
    return 'rounded-sm bg-primary-50/40 dark:bg-primary-950/20';
  }
  return '';
});

function syncEditorContent(value) {
  const el = editorRef.value;
  if (!el) return;
  if (props.plainText) {
    const next = String(value || '');
    if ((el.textContent || '') === next) return;
    syncFromProps = true;
    el.textContent = next;
    syncFromProps = false;
    return;
  }
  const nextHtml = bindingTextToEditorHtml(value);
  const current = sanitizeRichTextHtml(el.innerHTML).replace(/<br\s*\/?>/gi, '').trim();
  const next = sanitizeRichTextHtml(nextHtml).replace(/<br\s*\/?>/gi, '').trim();
  if (current === next) return;
  syncFromProps = true;
  el.innerHTML = nextHtml || '';
  syncFromProps = false;
}

function readEditorValue(el) {
  if (props.plainText) {
    return String(el.innerText || '').replace(/\u00a0/g, ' ');
  }
  return chipHtmlToMergeTokens(readEditorHtml(el));
}

function formatCommitValue(raw) {
  if (props.bindingField === 'items') {
    return String(raw || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return raw;
}

function commitText() {
  const el = editorRef.value;
  if (!el) return;
  const rawValue = readEditorValue(el);
  emit('patch', {
    nodeId: props.nodeId,
    patch: { bindings: { [props.bindingField]: formatCommitValue(rawValue) } }
  });
  publishFormatState();
}

function prepareEditorForFocus() {
  const el = editorRef.value;
  if (!el) return;
  syncFromProps = true;
  if (props.plainText) {
    el.textContent = props.text || '';
  } else {
    el.innerHTML = bindingTextToEditorHtml(props.text);
  }
  syncFromProps = false;
}

function decorateEditorChips() {
  if (props.plainText) return;
  const el = editorRef.value;
  if (!el || isFocused.value) return;
  const html = bindingTextToEditorHtml(props.text);
  if (!html.includes('{{')) return;
  syncFromProps = true;
  el.innerHTML = mergeTokensToChipHtml(html);
  syncFromProps = false;
}

function publishFormatState() {
  emit('format-state', queryFormatState());
}

function queryFormatState() {
  return {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic')
  };
}

function registerActiveEditor() {
  if (!activeTextEditor) return;
  activeTextEditor.value = {
    nodeId: props.nodeId,
    kind: 'inline-text',
    insertText(text) {
      const el = editorRef.value;
      if (!el) return;
      insertTextAtContentEditable(el, text);
      commitText();
    },
    applyFormat,
    queryFormatState
  };
}

function unregisterActiveEditor() {
  if (activeTextEditor?.value?.nodeId === props.nodeId) {
    activeTextEditor.value = null;
  }
}

function applyFormat(action, value) {
  const el = editorRef.value;
  if (!el) return;

  if (action === 'bold') {
    execEditorCommand(el, 'bold');
    commitText();
    return;
  }

  if (action === 'italic') {
    execEditorCommand(el, 'italic');
    commitText();
    return;
  }

  if (action === 'align') {
    emit('patch', {
      nodeId: props.nodeId,
      patch: {
        style: {
          typography: {
            textAlign: value || 'left'
          }
        }
      }
    });
    return;
  }

  if (action === 'headingLevel') {
    emit('patch', {
      nodeId: props.nodeId,
      patch: {
        bindings: {
          level: Number(value) || 1
        }
      }
    });
  }
}

function onFocus() {
  isFocused.value = true;
  emit('select', props.nodeId);
  prepareEditorForFocus();
  registerActiveEditor();
  publishFormatState();
}

function onBlur() {
  isFocused.value = false;
  commitText();
  decorateEditorChips();
  unregisterActiveEditor();
}

function onInput() {
  if (syncFromProps) return;
  commitText();
}

function isEditorEmpty() {
  const el = editorRef.value;
  if (!el) return true;
  if (props.plainText) {
    return String(el.textContent || '').replace(/\u00a0/g, ' ').trim().length === 0;
  }
  const plain = readEditorHtml(el).replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ').trim();
  return plain.length === 0;
}

function onKeyDown(event) {
  const meta = event.metaKey || event.ctrlKey;
  if (!props.plainText) {
    if (meta && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      applyFormat('bold');
      return;
    }
    if (meta && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      applyFormat('italic');
      return;
    }
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    const shouldDeleteBlock = meta || isEditorEmpty();
    if (shouldDeleteBlock) {
      event.preventDefault();
      if (typeof deleteNode === 'function') {
        deleteNode(props.nodeId);
      } else {
        emit('remove', props.nodeId);
      }
      return;
    }
  }

  if (event.key === 'Enter') {
    if (props.enterBehavior === 'linebreak') {
      event.preventDefault();
      execEditorCommand(editorRef.value, 'insertLineBreak');
      commitText();
      return;
    }
    if (event.shiftKey) {
      event.preventDefault();
      execEditorCommand(editorRef.value, 'insertLineBreak');
      commitText();
      return;
    }
    event.preventDefault();
    commitText();
    emit('continue-after', props.nodeId);
    return;
  }

  event.stopPropagation();
}

watch(
  () => props.text,
  (value) => {
    if (isFocused.value) return;
    syncEditorContent(value);
    decorateEditorChips();
  },
  { immediate: true }
);

onMounted(() => {
  syncEditorContent(props.text);
  decorateEditorChips();
});

defineExpose({
  applyFormat,
  queryFormatState
});
</script>

<style scoped>
[contenteditable]:empty {
  min-height: 1.5em;
}

:deep(.builder-merge-chip) {
  display: inline-flex;
  align-items: center;
  border-radius: 0.375rem;
  background: rgb(var(--color-primary-100, 219 234 254) / 1);
  padding: 0 0.375rem;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  color: rgb(var(--color-primary-700, 29 78 216) / 1);
}
</style>

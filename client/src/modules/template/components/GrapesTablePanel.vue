<template>
  <section class="space-y-3 border-t pt-4" :class="ui.border">
    <div>
      <h3 :class="ui.label">{{ t('templates.builderComponentTable') }}</h3>
      <p class="mt-1 text-xs leading-relaxed" :class="ui.textMuted">
        {{ t('templates.builderTableGridHint') }}
      </p>
    </div>

    <div>
      <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderTableWidthPercent') }}</label>
      <div class="flex gap-2">
        <input
          :value="tableWidth"
          type="text"
          :class="ui.input"
          class="min-w-0 flex-1"
          placeholder="100%"
          @change="onTableWidthChange($event.target.value)"
        />
        <button
          type="button"
          :class="[ui.btnGhost, 'shrink-0 text-xs']"
          @click="onTableWidthChange('100%')"
        >
          100%
        </button>
        <button
          type="button"
          :class="[ui.btnGhost, 'shrink-0 text-xs']"
          @click="onTableWidthChange('600')"
        >
          600
        </button>
      </div>
      <p class="mt-1 text-[11px] leading-relaxed" :class="ui.textMuted">
        {{ t('templates.builderTableHtmlWidthHint') }}
      </p>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <button type="button" :class="[ui.btnGhost, 'text-xs']" @click="run('insert-row-above')">
        {{ t('templates.builderTableInsertRowAbove') }}
      </button>
      <button type="button" :class="[ui.btnGhost, 'text-xs']" @click="run('insert-row-below')">
        {{ t('templates.builderTableInsertRowBelow') }}
      </button>
      <button type="button" :class="[ui.btnGhost, 'text-xs']" @click="run('insert-col-left')">
        {{ t('templates.builderTableInsertColLeft') }}
      </button>
      <button type="button" :class="[ui.btnGhost, 'text-xs']" @click="run('insert-col-right')">
        {{ t('templates.builderTableInsertColRight') }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        :class="[ui.btnGhost, 'text-xs']"
        :disabled="!canMergeCells"
        @click="run('merge-cells')"
      >
        {{ t('templates.builderTableMergeCells') }}
      </button>
      <button
        type="button"
        :class="[ui.btnGhost, 'text-xs']"
        :disabled="!canUnmergeCells"
        @click="run('unmerge-cells')"
      >
        {{ t('templates.builderTableUnmergeCells') }}
      </button>
    </div>

    <p class="text-[11px]" :class="ui.textMuted">
      {{ t('templates.builderTableGridHint') }}
    </p>

    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="item in alignments"
        :key="item.action"
        type="button"
        :class="[ui.btnGhost, 'text-xs', activeAlign === item.value ? ui.selectedBg : '']"
        @click="run(item.action)"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <button type="button" :class="[ui.btnGhost, 'text-xs']" @click="copyCell">
        {{ t('templates.builderTableCopyCell') }}
      </button>
      <button
        type="button"
        :class="[ui.btnGhost, 'text-xs']"
        :disabled="!hasClipboard"
        @click="pasteCell"
      >
        {{ t('templates.builderTablePasteCell') }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        :class="[ui.btnGhost, 'text-xs', showFooter ? ui.selectedBg : '']"
        @click="run('toggle-footer')"
      >
        {{ t('templates.builderTableFooterRow') }}
      </button>
      <button
        type="button"
        :class="[ui.btnGhost, 'text-xs', isDataRowActive ? ui.selectedBg : '']"
        @click="run('toggle-data-row')"
      >
        {{ isDataRowActive ? t('templates.builderTableClearDataRow') : t('templates.builderTableMarkDataRow') }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        :class="[ui.btnGhost, 'text-xs text-danger-600']"
        :disabled="!canDeleteRowActive"
        @click="run('delete-row')"
      >
        {{ t('templates.builderTableDeleteRow') }}
      </button>
      <button
        type="button"
        :class="[ui.btnGhost, 'text-xs text-danger-600']"
        :disabled="!canDeleteColActive"
        @click="run('delete-col')"
      >
        {{ t('templates.builderTableDeleteCol') }}
      </button>
    </div>

    <button type="button" :class="[ui.btnGhost, 'w-full text-xs text-danger-600']" @click="run('delete-table')">
      {{ t('templates.builderTableDeleteTable') }}
    </button>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import {
  copyCell as copyTableCell,
  getTableActionState,
  runTableAction,
  TABLE_SELECTION_CHANGED
} from '../editor/tableActions';
import { findTableRoot } from '../editor/tableModel';
import {
  patchComponentAttributes,
  patchComponentStyle,
  readComponentAttributes,
  readStyleValue
} from '../editor/selection';

const props = defineProps({
  component: { type: Object, default: null },
  editor: { type: Object, default: null }
});

const emit = defineEmits(['change']);

const { t } = useI18n();
const ui = useBuilderUi();
const revision = ref(0);
const clipboard = ref(null);

watch(
  () => props.component,
  () => {
    revision.value += 1;
  }
);

let detachSelectionListener = null;

watch(
  () => props.editor,
  (editor) => {
    detachSelectionListener?.();
    detachSelectionListener = null;
    if (!editor) return;
    const handler = () => {
      revision.value += 1;
    };
    editor.on(TABLE_SELECTION_CHANGED, handler);
    detachSelectionListener = () => editor.off(TABLE_SELECTION_CHANGED, handler);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  detachSelectionListener?.();
});

const tableState = computed(() => {
  void revision.value;
  return props.component ? getTableActionState(props.component) : null;
});

const tableRoot = computed(() => {
  void revision.value;
  return props.component ? findTableRoot(props.component) : null;
});

const tableWidth = computed(() => {
  void revision.value;
  const table = tableRoot.value;
  if (!table) return '';
  const attrs = readComponentAttributes(table);
  return String(attrs.width || '').trim();
});

const canMergeCells = computed(() => tableState.value?.canMerge ?? false);
const canUnmergeCells = computed(() => tableState.value?.canUnmerge ?? false);
const canDeleteRowActive = computed(() => tableState.value?.canDeleteRow ?? false);
const canDeleteColActive = computed(() => tableState.value?.canDeleteCol ?? false);
const showFooter = computed(() => tableState.value?.showFooter ?? false);
const isDataRowActive = computed(() => tableState.value?.isDataRow ?? false);

const activeAlign = computed(() => {
  void revision.value;
  return readStyleValue(props.component, ['text-align', 'textAlign'], 'left');
});

const hasClipboard = computed(() => Boolean(clipboard.value));

const alignments = computed(() => [
  { value: 'left', label: t('templates.builderFormatAlignLeft'), action: 'align-left' },
  { value: 'center', label: t('templates.builderFormatAlignCenter'), action: 'align-center' },
  { value: 'right', label: t('templates.builderFormatAlignRight'), action: 'align-right' }
]);

function run(action) {
  if (!props.component || !props.editor) return;
  runTableAction(props.editor, props.component, action, clipboard.value);
  revision.value += 1;
}

function normalizeTableWidthValue(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^\d+(\.\d+)?%$/.test(value)) return value;
  if (/^\d+(\.\d+)?px$/i.test(value)) return value.replace(/px$/i, '');
  if (/^\d+(\.\d+)?$/.test(value)) return value;
  return value;
}

function onTableWidthChange(raw) {
  const table = tableRoot.value;
  if (!table) return;

  const value = normalizeTableWidthValue(raw);
  const el = table.view?.el;

  if (!value) {
    patchComponentAttributes(table, { width: undefined });
    if (el instanceof HTMLElement) el.removeAttribute('width');
  } else {
    patchComponentAttributes(table, { width: value });
    const styleWidth = /^\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
    patchComponentStyle(table, { width: styleWidth });
    if (el instanceof HTMLElement) {
      el.setAttribute('width', value);
      el.style.width = styleWidth;
    }
  }

  revision.value += 1;
  emit('change');
}

function copyCell() {
  if (!props.component) return;
  clipboard.value = copyTableCell(props.component);
}

function pasteCell() {
  if (!props.component || !props.editor || !clipboard.value) return;
  runTableAction(props.editor, props.component, 'paste-cell', clipboard.value);
  revision.value += 1;
}
</script>

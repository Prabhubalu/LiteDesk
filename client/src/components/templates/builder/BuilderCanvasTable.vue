<template>
  <div
    class="ld-builder-table relative min-h-full"
    :class="[hiddenClass, isSelected ? 'ring-1 ring-primary-400/40 rounded-md' : '']"
    @mousedown.stop
    @click.stop="emit('select', nodeId)"
  >
    <div
      v-if="isSelected && editingCell"
      class="pointer-events-auto absolute bottom-full left-0 z-50 mb-1 w-max max-w-none"
    >
      <BuilderTextFormatToolbar
        dock="above"
        :show-drag-handle="false"
        node-type="Paragraph"
        :node-id="nodeId"
        :text-align="selectedCellAlign"
        :active-formats="cellFormatState"
        @format="onCellTextFormat"
      />
    </div>

    <div
      v-else-if="isSelected && !readonly"
      class="pointer-events-auto absolute bottom-full left-0 z-50 mb-1 w-max max-w-[calc(100vw-2rem)]"
    >
      <BuilderTableToolbar
        :can-delete-column="colCount > 1"
        :can-merge="canMergeSelectionRange"
        :can-unmerge="canUnmergeSelectedCell"
        :active-align="selectedCellAlign"
        :active-format="selectedCellFormat"
        :show-footer="false"
        @action="onToolbarAction"
      />
    </div>

    <BuilderTableContextMenu
      :open="menu.open"
      :x="menu.x"
      :y="menu.y"
      :can-delete-row="gridBindings.grid.length > 1"
      :can-delete-col="colCount > 1"
      :can-merge="canMergeSelectionRange"
      :can-unmerge="canUnmergeAtMenuCell"
      :has-clipboard="hasClipboard"
      :is-data-row="menu.row === gridBindings.repeatRowIndex"
      @action="onMenuAction"
      @close="closeMenu"
    />

    <div class="overflow-x-auto rounded-md border border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900">
      <table class="border-collapse text-sm" :style="tableStyle">
        <colgroup>
          <col v-for="(width, index) in displayWidths" :key="`col-${index}`" :style="{ width: `${width}px` }" />
        </colgroup>
        <tbody>
          <tr v-for="(row, rowIndex) in gridBindings.grid" :key="`row-${rowIndex}`">
            <td
              v-for="(cell, colIndex) in row"
              v-show="!cell.skip"
              :key="`cell-${rowIndex}-${colIndex}`"
              :data-row="rowIndex"
              :data-col="colIndex"
              :colspan="cell.colSpan > 1 ? cell.colSpan : undefined"
              :rowspan="cell.rowSpan > 1 ? cell.rowSpan : undefined"
              class="relative border border-neutral-300 p-0 align-top dark:border-neutral-600"
              :class="[
                cellClass(rowIndex, colIndex),
                rowIndex === gridBindings.repeatRowIndex ? 'bg-blue-50/40 dark:bg-blue-950/20' : 'bg-white dark:bg-neutral-900'
              ]"
              :style="{ textAlign: cell.align || 'left' }"
              @mousedown.stop="onCellMouseDown(rowIndex, colIndex, $event)"
              @mouseenter="onCellMouseEnter(rowIndex, colIndex)"
              @click.stop="onCellClick(rowIndex, colIndex, $event)"
              @contextmenu.prevent.stop="openMenu($event, rowIndex, colIndex)"
            >
              <div
                v-if="!isEditing(rowIndex, colIndex)"
                class="sheet-cell min-h-[2rem] select-none whitespace-pre-wrap px-2 py-1.5 text-sm"
                :class="readonly ? 'cursor-default' : ''"
                @dblclick.stop="!readonly && startEdit(rowIndex, colIndex)"
              >
                <span v-if="cell.text">{{ cell.text }}</span>
                <span v-else class="text-xs text-neutral-400">{{ t('templates.builderTableDoubleClickEdit') }}</span>
              </div>
              <div
                v-else
                :ref="setEditRef"
                contenteditable="true"
                class="sheet-cell-editing min-h-[2rem] whitespace-pre-wrap px-2 py-1.5 text-sm outline-none"
                :style="{ textAlign: selectedCellAlign }"
                @mousedown.stop
                @focus="registerTableCellEditor"
                @input="onCellInput"
                @blur="onEditBlur"
                @keydown.stop="onEditKeydown"
              />

              <div
                v-if="colIndex < colCount - 1"
                class="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize"
                @mousedown.stop.prevent="startColumnResize(colIndex, $event)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BuilderTableContextMenu from '@/components/templates/builder/BuilderTableContextMenu.vue';
import BuilderTableToolbar from '@/components/templates/builder/BuilderTableToolbar.vue';
import BuilderTextFormatToolbar from '@/components/templates/builder/BuilderTextFormatToolbar.vue';
import { BUILDER_DELETE_NODE_KEY, BUILDER_ACTIVE_TEXT_EDITOR_KEY, BUILDER_PAGE_METRICS_KEY, BUILDER_TABLE_MERGE_CONTEXT_KEY } from '@/constants/builderInjectKeys';
import { execEditorCommand, insertTextAtContentEditable } from '@/utils/builderRichText';
import { copyTableCell, hasTableClipboard, readTableClipboard } from '@/utils/builderTableClipboard';
import { buildTableBindingsPatch, createFreshTableBindings, isLegacyTableBindings } from '@/utils/builderTableBindings';
import {
  deleteColumn,
  deleteRow,
  insertColumn,
  insertRow,
  canMergeSelection,
  isCellInSelectionBounds,
  mergeCells,
  normalizeSelectionBounds,
  normalizeTableGridBindings,
  resolveColumnWidthsPx,
  resolveTableWidthPx,
  setRepeatRowIndex,
  unmergeCell,
  updateCell,
  updateColumnWidth
} from '@/utils/builderTableGridModel';

const props = defineProps({
  nodeId: { type: String, required: true },
  node: { type: Object, required: true },
  isSelected: { type: Boolean, default: false },
  hiddenClass: { type: String, default: '' },
  readonly: { type: Boolean, default: false }
});

const emit = defineEmits(['select', 'patch']);

const { t } = useI18n();
const deleteNode = inject(BUILDER_DELETE_NODE_KEY, null);
const pageMetrics = inject(BUILDER_PAGE_METRICS_KEY, null);
const activeTextEditor = inject(BUILDER_ACTIVE_TEXT_EDITOR_KEY, null);
const tableMergeContext = inject(BUILDER_TABLE_MERGE_CONTEXT_KEY, null);

const contentWidthPx = computed(() => pageMetrics?.value?.contentArea?.width || 700);

const gridBindings = computed(() => normalizeTableGridBindings(props.node?.bindings));
const colCount = computed(() => gridBindings.value.grid[0]?.length || 0);

const selectionAnchor = ref({ row: 0, col: 0 });
const selectionEnd = ref({ row: 0, col: 0 });
const isDragSelecting = ref(false);
const suppressClickSelection = ref(false);
const editingCell = ref(null);
const editBuffer = ref('');
const editRef = ref(null);
const resizeDraft = ref(null);
const menu = ref({ open: false, x: 0, y: 0, row: 0, col: 0 });
const cellFormatState = ref({ bold: false, italic: false });

const selectedCell = computed(() => {
  const { row, col } = selectionEnd.value;
  return gridBindings.value.grid[row]?.[col] || null;
});

const selectionBounds = computed(() =>
  normalizeSelectionBounds(selectionAnchor.value, selectionEnd.value)
);

const canMergeSelectionRange = computed(() =>
  canMergeSelection(selectionAnchor.value, selectionEnd.value, gridBindings.value.grid)
);

const canUnmergeSelectedCell = computed(() => {
  const { r0, c0 } = selectionBounds.value;
  const cell = gridBindings.value.grid[r0]?.[c0];
  return Boolean(cell && (cell.colSpan > 1 || cell.rowSpan > 1));
});

const canUnmergeAtMenuCell = computed(() => {
  const { row, col } = menu.value;
  const cell = gridBindings.value.grid[row]?.[col];
  return Boolean(cell && (cell.colSpan > 1 || cell.rowSpan > 1));
});

const selectedCellAlign = computed(() => selectedCell.value?.align || 'left');
const selectedCellFormat = computed(() => selectedCell.value?.format || 'text');

const tableWidthPx = computed(() => resolveTableWidthPx(gridBindings.value, contentWidthPx.value));

const displayWidths = computed(() => {
  if (resizeDraft.value) {
    return resolveColumnWidthsPx(gridBindings.value, contentWidthPx.value).map((width, index) =>
      index === resizeDraft.value.col ? resizeDraft.value.width : width
    );
  }
  return resolveColumnWidthsPx(gridBindings.value, contentWidthPx.value);
});

const tableStyle = computed(() => ({
  width: `${tableWidthPx.value}px`,
  tableLayout: 'fixed'
}));

const hasClipboard = computed(() => hasTableClipboard());

function patchBindings(nextBindings) {
  emit('patch', {
    nodeId: props.nodeId,
    patch: {
      bindings: buildTableBindingsPatch(props.node?.bindings, nextBindings)
    }
  });
}

function ensureGridPersisted() {
  const bindings = props.node?.bindings;
  if (!bindings || typeof bindings !== 'object') return;
  if (Array.isArray(bindings.grid) && bindings.grid.length) return;
  if (isLegacyTableBindings(bindings)) {
    migrateLegacyBindingsIfNeeded();
    return;
  }
  patchBindings(createFreshTableBindings(3, 3));
}

function migrateLegacyBindingsIfNeeded() {
  const bindings = props.node?.bindings;
  if (!isLegacyTableBindings(bindings)) return;
  patchBindings(normalizeTableGridBindings(bindings));
}

onMounted(() => {
  ensureGridPersisted();
});

watch(
  () => props.node?.id,
  () => {
    ensureGridPersisted();
  }
);

watch(
  () => [
    props.isSelected,
    selectionAnchor.value.row,
    selectionAnchor.value.col,
    selectionEnd.value.row,
    selectionEnd.value.col,
    editingCell.value,
    selectedCell.value
  ],
  () => {
    if (!tableMergeContext) return;
    if (!props.isSelected) {
      if (tableMergeContext.value?.nodeId === props.nodeId) {
        tableMergeContext.value = null;
      }
      return;
    }
    const { row, col } = selectionEnd.value;
    const bounds = selectionBounds.value;
    tableMergeContext.value = {
      nodeId: props.nodeId,
      row,
      col,
      isEditing: Boolean(editingCell.value),
      selectionBounds: bounds,
      canMerge: canMergeSelectionRange.value,
      cell: selectedCell.value
        ? {
            text: selectedCell.value.text,
            align: selectedCell.value.align,
            format: selectedCell.value.format || 'text'
          }
        : null
    };
  },
  { immediate: true, deep: true }
);

function setSelection(row, col, { extend = false } = {}) {
  if (extend) {
    selectionEnd.value = { row, col };
    return;
  }
  selectionAnchor.value = { row, col };
  selectionEnd.value = { row, col };
}

function collapseSelectionToAnchor() {
  const { r0, c0 } = selectionBounds.value;
  selectionAnchor.value = { row: r0, col: c0 };
  selectionEnd.value = { row: r0, col: c0 };
}

function cellClass(row, col) {
  if (!isCellInSelectionBounds(row, col, selectionAnchor.value, selectionEnd.value)) {
    return '';
  }
  const { r0, c0 } = selectionBounds.value;
  const isPrimary = row === selectionEnd.value.row && col === selectionEnd.value.col;
  const isAnchor = row === r0 && col === c0;
  if (isPrimary || isAnchor) {
    return 'ring-2 ring-inset ring-primary-500 dark:ring-primary-400 bg-primary-50/30 dark:bg-primary-950/20';
  }
  return 'ring-2 ring-inset ring-primary-300/80 dark:ring-primary-600/80 bg-primary-50/20 dark:bg-primary-950/10';
}

function isEditing(row, col) {
  return editingCell.value?.row === row && editingCell.value?.col === col;
}

function setEditRef(el) {
  editRef.value = el;
}

function resolveCellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest?.('td[data-row][data-col]');
  if (!cell) return null;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row, col };
}

function onCellMouseDown(row, col, event) {
  if (props.readonly) return;
  if (event.button !== 0) return;
  event.preventDefault();
  emit('select', props.nodeId);
  if (editingCell.value) return;
  suppressClickSelection.value = false;
  isDragSelecting.value = true;
  setSelection(row, col, { extend: event.shiftKey });

  function onMouseMove(moveEvent) {
    if (!isDragSelecting.value) return;
    const hit = resolveCellFromPoint(moveEvent.clientX, moveEvent.clientY);
    if (hit) {
      selectionEnd.value = hit;
    }
  }

  function onMouseUp() {
    const { r0, r1, c0, c1 } = normalizeSelectionBounds(selectionAnchor.value, selectionEnd.value);
    if (r0 !== r1 || c0 !== c1) {
      suppressClickSelection.value = true;
    }
    isDragSelecting.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function onCellMouseEnter(row, col) {
  if (!isDragSelecting.value || editingCell.value) return;
  selectionEnd.value = { row, col };
}

function onCellClick(row, col, event) {
  emit('select', props.nodeId);
  if (editingCell.value) return;
  if (suppressClickSelection.value) {
    suppressClickSelection.value = false;
    return;
  }
  if (!event.shiftKey) {
    setSelection(row, col);
  }
}

function openMenu(event, row, col) {
  if (props.readonly) return;
  emit('select', props.nodeId);
  if (!isCellInSelectionBounds(row, col, selectionAnchor.value, selectionEnd.value)) {
    setSelection(row, col);
  }
  menu.value = {
    open: true,
    x: event.clientX,
    y: event.clientY,
    row,
    col
  };
}

function closeMenu() {
  menu.value = { ...menu.value, open: false };
}

async function startEdit(row, col) {
  emit('select', props.nodeId);
  setSelection(row, col);
  editBuffer.value = gridBindings.value.grid[row]?.[col]?.text || '';
  editingCell.value = { row, col };
  await nextTick();
  const el = editRef.value;
  if (!el) return;
  el.textContent = editBuffer.value;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  registerTableCellEditor();
  publishCellFormatState();
}

function publishCellFormatState() {
  cellFormatState.value = {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic')
  };
}

function registerTableCellEditor() {
  if (!activeTextEditor || !editingCell.value) return;
  const { row, col } = editingCell.value;
  activeTextEditor.value = {
    nodeId: props.nodeId,
    kind: 'table-cell',
    row,
    col,
    insertText(text) {
      const el = editRef.value;
      if (!el || !editingCell.value) return;
      insertTextAtContentEditable(el, text);
    },
    applyFormat(action, value) {
      onCellTextFormat(action, value);
    },
    queryFormatState: publishCellFormatState
  };
}

function unregisterTableCellEditor() {
  if (
    activeTextEditor?.value?.nodeId === props.nodeId
    && activeTextEditor?.value?.kind === 'table-cell'
  ) {
    activeTextEditor.value = null;
  }
}

function cancelEdit() {
  editingCell.value = null;
  editBuffer.value = '';
  unregisterTableCellEditor();
}

function onEditBlur() {
  window.setTimeout(() => {
    if (!editingCell.value) return;
    const active = document.activeElement;
    const el = editRef.value;
    if (el && (active === el || el.contains(active))) return;
    commitEdit();
  }, 0);
}

function rowContainsLineMergeTags(row) {
  return Array.isArray(row) && row.some((cell) => /\{\{\s*lines\./i.test(String(cell?.text || '')));
}

function commitEdit() {
  if (!editingCell.value) return;
  const { row, col } = editingCell.value;
  const text = editRef.value?.innerText ?? editBuffer.value;
  let next = updateCell(gridBindings.value, row, col, { text });
  if (rowContainsLineMergeTags(next.grid[row])) {
    next = setRepeatRowIndex(
      { ...next, collection: next.collection || 'lines' },
      row
    );
  }
  patchBindings(next);
  cancelEdit();
}

function onCellInput() {
  publishCellFormatState();
}

function onEditKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    commitEdit();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelEdit();
  }
}

function onCellTextFormat(action, value) {
  const { row, col } = selectionEnd.value;
  if (action === 'bold' || action === 'italic') {
    const el = editRef.value;
    if (el && editingCell.value) {
      execEditorCommand(el, action);
      publishCellFormatState();
      return;
    }
  }
  if (action === 'align') {
    patchBindings(updateCell(gridBindings.value, row, col, { align: value || 'left' }));
  }
}

function mergeSelectedCells() {
  const { r0, r1, c0, c1 } = selectionBounds.value;
  const next = {
    ...gridBindings.value,
    grid: mergeCells(gridBindings.value.grid, r0, c0, r1, c1)
  };
  patchBindings(next);
  collapseSelectionToAnchor();
}

function onToolbarAction(action, value) {
  const { row, col } = selectionEnd.value;
  let next = gridBindings.value;

  switch (action) {
    case 'insert-left':
      next = insertColumn(next, col);
      break;
    case 'insert-right':
      next = insertColumn(next, col + 1);
      break;
    case 'delete-column':
      next = deleteColumn(next, col);
      break;
    case 'align':
      next = updateCell(next, row, col, { align: value || 'left' });
      break;
    case 'format':
      next = updateCell(next, row, col, { format: value || 'text' });
      break;
    case 'merge':
      mergeSelectedCells();
      return;
    case 'unmerge': {
      const { r0, c0 } = selectionBounds.value;
      next = { ...next, grid: unmergeCell(next.grid, r0, c0) };
      collapseSelectionToAnchor();
      break;
    }
    case 'delete-table':
      deleteNode?.(props.nodeId);
      return;
    default:
      return;
  }

  patchBindings(next);
}

function onMenuAction(action) {
  closeMenu();
  const { row, col } = menu.value;
  let next = gridBindings.value;

  switch (action) {
    case 'merge-cells':
      mergeSelectedCells();
      return;
    case 'unmerge-cells': {
      next = { ...next, grid: unmergeCell(next.grid, row, col) };
      patchBindings(next);
      setSelection(row, col);
      return;
    }
    case 'insert-row-above':
      next = { ...next, grid: insertRow(next.grid, row, colCount.value) };
      if (next.repeatRowIndex != null && next.repeatRowIndex >= row) {
        next.repeatRowIndex += 1;
      }
      break;
    case 'insert-row-below':
      next = { ...next, grid: insertRow(next.grid, row + 1, colCount.value) };
      if (next.repeatRowIndex != null && next.repeatRowIndex > row) {
        next.repeatRowIndex += 1;
      }
      break;
    case 'insert-col-left':
      next = insertColumn(next, col);
      break;
    case 'insert-col-right':
      next = insertColumn(next, col + 1);
      break;
    case 'copy-cell':
      copyTableCell(next.grid[row][col]);
      return;
    case 'paste-cell': {
      const clip = readTableClipboard();
      if (clip) next = updateCell(next, row, col, { text: clip.text, align: clip.align });
      break;
    }
    case 'toggle-data-row':
      next = setRepeatRowIndex(next, next.repeatRowIndex === row ? null : row);
      break;
    case 'delete-row': {
      const removed = deleteRow(next.grid, row);
      let repeatRowIndex = next.repeatRowIndex;
      if (repeatRowIndex === row) repeatRowIndex = null;
      else if (repeatRowIndex != null && repeatRowIndex > row) repeatRowIndex -= 1;
      next = { ...next, grid: removed, repeatRowIndex };
      break;
    }
    case 'delete-col':
      next = deleteColumn(next, col);
      break;
    case 'delete-table':
      deleteNode?.(props.nodeId);
      return;
    default:
      return;
  }

  patchBindings(next);
}

function startColumnResize(col, event) {
  const startX = event.clientX;
  const originWidth = displayWidths.value[col] || 120;

  function onMove(moveEvent) {
    resizeDraft.value = {
      col,
      width: Math.max(48, Math.round(originWidth + (moveEvent.clientX - startX)))
    };
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (resizeDraft.value) {
      patchBindings(updateColumnWidth(gridBindings.value, col, resizeDraft.value.width, contentWidthPx.value));
    }
    resizeDraft.value = null;
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
</script>

<style scoped>
.sheet-cell-editing {
  box-shadow: inset 0 0 0 2px rgb(79 70 229 / 0.55);
  background: #fff;
}
</style>

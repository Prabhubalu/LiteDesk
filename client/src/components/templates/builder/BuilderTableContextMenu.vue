<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[90]"
      @mousedown="emit('close')"
      @contextmenu.prevent="emit('close')"
    >
      <div
        class="fixed min-w-[11rem] max-w-[16rem] rounded-lg border bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        :style="menuStyle"
        @mousedown.stop
        @contextmenu.prevent
      >
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
          :class="item.danger ? 'text-danger-600' : 'text-neutral-700 dark:text-neutral-200'"
          :disabled="item.disabled"
          @click.stop="emit('action', item.id)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  open: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  canDeleteRow: { type: Boolean, default: true },
  canDeleteCol: { type: Boolean, default: true },
  canMerge: { type: Boolean, default: false },
  canUnmerge: { type: Boolean, default: false },
  hasClipboard: { type: Boolean, default: false },
  isDataRow: { type: Boolean, default: false }
});

const emit = defineEmits(['action', 'close']);

const { t } = useI18n();

const items = computed(() => [
  { id: 'insert-row-above', label: t('templates.builderTableInsertRowAbove') },
  { id: 'insert-row-below', label: t('templates.builderTableInsertRowBelow') },
  { id: 'insert-col-left', label: t('templates.builderTableInsertColLeft') },
  { id: 'insert-col-right', label: t('templates.builderTableInsertColRight') },
  { id: 'merge-cells', label: t('templates.builderTableMergeCells'), disabled: !props.canMerge },
  { id: 'unmerge-cells', label: t('templates.builderTableUnmergeCells'), disabled: !props.canUnmerge },
  { id: 'copy-cell', label: t('templates.builderTableCopyCell') },
  { id: 'paste-cell', label: t('templates.builderTablePasteCell'), disabled: !props.hasClipboard },
  { id: 'toggle-data-row', label: props.isDataRow ? t('templates.builderTableClearDataRow') : t('templates.builderTableMarkDataRow') },
  { id: 'delete-row', label: t('templates.builderTableDeleteRow'), disabled: !props.canDeleteRow },
  { id: 'delete-col', label: t('templates.builderTableDeleteCol'), disabled: !props.canDeleteCol, danger: true },
  { id: 'delete-table', label: t('templates.builderTableDeleteTable'), danger: true }
]);

const menuStyle = computed(() => {
  const padding = 8;
  const offset = 4;
  const menuWidth = 176;
  const menuHeight = items.value.length * 36 + 8;
  const left = Math.min(
    Math.max(props.x + offset, padding),
    Math.max(padding, window.innerWidth - menuWidth - padding)
  );
  const top = Math.min(
    Math.max(props.y + offset, padding),
    Math.max(padding, window.innerHeight - menuHeight - padding)
  );
  return { left: `${left}px`, top: `${top}px` };
});
</script>

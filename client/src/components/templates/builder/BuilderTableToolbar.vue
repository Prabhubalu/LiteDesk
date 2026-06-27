<template>
  <div
    class="pointer-events-auto z-50 mb-2 flex max-w-none flex-nowrap items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
  >
    <button type="button" :class="ui.btnIcon" :title="t('templates.builderTableInsertColLeft')" @mousedown.prevent @click.stop="emit('action', 'insert-left')">
      <ArrowLeftCircleIcon class="h-4 w-4" />
    </button>
    <button type="button" :class="ui.btnIcon" :title="t('templates.builderTableInsertColRight')" @mousedown.prevent @click.stop="emit('action', 'insert-right')">
      <ArrowRightCircleIcon class="h-4 w-4" />
    </button>
    <button
      type="button"
      :class="ui.btnIcon"
      :disabled="!canDeleteColumn"
      :title="t('templates.builderTableDeleteCol')"
      @mousedown.prevent
      @click.stop="emit('action', 'delete-column')"
    >
      <MinusCircleIcon class="h-4 w-4 text-danger-600" />
    </button>

    <span class="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

    <button
      type="button"
      :class="ui.btnIcon"
      :disabled="!canMerge"
      :title="t('templates.builderTableMergeCells')"
      @mousedown.prevent
      @click.stop="emit('action', 'merge')"
    >
      <TableCellsIcon class="h-4 w-4" />
    </button>
    <button
      type="button"
      :class="ui.btnIcon"
      :disabled="!canUnmerge"
      :title="t('templates.builderTableUnmergeCells')"
      @mousedown.prevent
      @click.stop="emit('action', 'unmerge')"
    >
      <ViewColumnsIcon class="h-4 w-4" />
    </button>

    <span class="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

    <button
      v-for="item in alignments"
      :key="item.value"
      type="button"
      :class="[ui.btnIcon, activeAlign === item.value ? ui.selectedBg : '']"
      :title="item.label"
      @mousedown.prevent
      @click.stop="emit('action', 'align', item.value)"
    >
      <component :is="item.icon" class="h-4 w-4" />
    </button>

    <span class="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

    <select
      :value="activeFormat"
      :class="[ui.input, 'w-auto py-1 text-xs']"
      @mousedown.stop
      @click.stop
      @change="emit('action', 'format', $event.target.value)"
    >
      <option value="text">{{ t('templates.builderFormatText') }}</option>
      <option value="currency">{{ t('templates.builderFormatCurrency') }}</option>
      <option value="date">{{ t('templates.builderFormatDate') }}</option>
    </select>

    <span class="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

    <button
      type="button"
      :class="[ui.btnGhost, showFooter ? ui.selectedBg : '']"
      @mousedown.prevent
      @click.stop="emit('action', 'toggle-footer')"
    >
      {{ t('templates.builderTableFooterRow') }}
    </button>

    <button type="button" :class="ui.btnIcon" :title="t('actions.delete')" @mousedown.prevent @click.stop="emit('action', 'delete-table')">
      <TrashIcon class="h-4 w-4 text-danger-600" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
  Bars3BottomLeftIcon,
  Bars3BottomRightIcon,
  Bars3CenterLeftIcon,
  MinusCircleIcon,
  TableCellsIcon,
  TrashIcon,
  ViewColumnsIcon
} from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  canDeleteColumn: { type: Boolean, default: true },
  canMerge: { type: Boolean, default: false },
  canUnmerge: { type: Boolean, default: false },
  activeAlign: { type: String, default: 'left' },
  activeFormat: { type: String, default: 'text' },
  showFooter: { type: Boolean, default: false }
});

const emit = defineEmits(['action']);

const { t } = useI18n();
const ui = useBuilderUi();

const alignments = computed(() => [
  { value: 'left', label: t('templates.builderFormatAlignLeft'), icon: Bars3BottomLeftIcon },
  { value: 'center', label: t('templates.builderFormatAlignCenter'), icon: Bars3CenterLeftIcon },
  { value: 'right', label: t('templates.builderFormatAlignRight'), icon: Bars3BottomRightIcon }
]);
</script>

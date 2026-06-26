<template>
  <div v-if="!node" class="text-sm" :class="ui.textMuted">
    {{ t('templates.builderPropertiesEmpty') }}
  </div>

  <form v-else class="space-y-4" @submit.prevent>
    <div v-if="node">
      <p :class="[ui.meta, 'mb-1']">{{ node.type }}</p>
      <p class="text-meta font-mono text-neutral-400">#{{ node.id }}</p>
    </div>

    <div>
      <label class="mb-1 block" :class="ui.label">{{ t('templates.fieldName') }}</label>
      <input
        :value="node.name || ''"
        type="text"
        :class="ui.input"
        @input="patchName($event.target.value)"
      />
    </div>

    <div class="grid grid-cols-2 gap-2">
      <label class="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" :class="ui.border">
        <input
          type="checkbox"
          :checked="!isNodeHidden(node)"
          @change="patchVisibility({ hidden: !$event.target.checked })"
        />
        <span :class="ui.textSubtle">{{ t('templates.builderFieldVisible') }}</span>
      </label>
      <label class="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" :class="ui.border">
        <input
          type="checkbox"
          :checked="isNodeLocked(node)"
          @change="patchVisibility({ locked: $event.target.checked })"
        />
        <span :class="ui.textSubtle">{{ t('templates.builderFieldLocked') }}</span>
      </label>
    </div>

    <p
      v-if="showCanvasEditHint"
      class="text-xs"
      :class="ui.textMuted"
    >
      {{ t('templates.builderCanvasEditHint') }}
    </p>

    <template v-if="isTypographyComponent">
      <div v-if="node.type === 'Heading'">
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldHeadingLevel') }}</label>
        <select
          :value="Number(node.bindings?.level || 1)"
          :class="ui.input"
          @change="patchBindings({ level: Number($event.target.value) })"
        >
          <option v-for="level in [1, 2, 3, 4]" :key="level" :value="level">H{{ level }}</option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldFontSize') }}</label>
          <input
            :value="Number(node.style?.typography?.fontSize || defaultFontSize)"
            type="number"
            min="8"
            max="72"
            :class="ui.input"
            @input="patchTypography({ fontSize: Number($event.target.value) })"
          />
        </div>
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldFontWeight') }}</label>
          <select
            :value="Number(node.style?.typography?.fontWeight || defaultFontWeight)"
            :class="ui.input"
            @change="patchTypography({ fontWeight: Number($event.target.value) })"
          >
            <option :value="400">{{ t('templates.builderFontWeightRegular') }}</option>
            <option :value="600">{{ t('templates.builderFontWeightSemibold') }}</option>
            <option :value="700">{{ t('templates.builderFontWeightBold') }}</option>
          </select>
        </div>
      </div>
    </template>

    <template v-else-if="node.type === 'MergeTag'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldMergePath') }}</label>
        <input
          :value="String(node.bindings?.path || '')"
          type="text"
          :class="[ui.input, 'font-mono']"
          @input="patchBindings({ path: $event.target.value })"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldFormat') }}</label>
        <select
          :value="String(node.bindings?.format || 'text')"
          :class="ui.input"
          @change="patchBindings({ format: $event.target.value })"
        >
          <option value="text">{{ t('templates.builderFormatText') }}</option>
          <option value="currency">{{ t('templates.builderFormatCurrency') }}</option>
          <option value="date">{{ t('templates.builderFormatDate') }}</option>
        </select>
      </div>
    </template>

    <template v-else-if="node.type === 'Image' || node.type === 'Logo'">
      <BuilderImageAssetPicker @select="onAssetSelected" />
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldImageSrc') }}</label>
        <input
          :value="String(node.bindings?.src || '')"
          type="text"
          :class="ui.input"
          @input="patchBindings({ src: $event.target.value })"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldImageAlt') }}</label>
        <input
          :value="String(node.bindings?.alt || '')"
          type="text"
          :class="ui.input"
          @input="patchBindings({ alt: $event.target.value })"
        />
      </div>
    </template>

    <template v-else-if="node.type === 'Table'">
      <p v-if="isGridTable" class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('templates.builderTableGridHint') }}
      </p>
      <p v-if="isGridTable" class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('templates.builderPrintMarginHint') }}
      </p>

      <div v-if="isGridTable" class="space-y-3">
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderTableWidthPercent') }}</label>
          <div class="flex items-center gap-2">
            <input
              :value="Number(tableGridBindings?.tableWidthPercent || 100)"
              type="number"
              min="10"
              max="100"
              step="1"
              :class="[ui.input, 'font-mono']"
              @input="updateTableWidthPercent($event.target.value)"
            />
            <span class="text-xs text-neutral-500">%</span>
          </div>
          <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('templates.builderTableWidthPercentHint') }}
          </p>
        </div>

        <div>
          <label class="mb-2 block" :class="ui.label">{{ t('templates.builderTableColumnPercents') }}</label>
          <div class="space-y-2">
            <div
              v-for="(percent, index) in tableColumnPercents"
              :key="`col-width-${index}`"
              class="flex items-center gap-2"
            >
              <span class="w-14 shrink-0 text-xs text-neutral-500">{{ t('templates.builderTableColumnLabel', { index: index + 1 }) }}</span>
              <input
                :value="percent"
                type="number"
                min="5"
                max="95"
                step="1"
                :class="[ui.input, 'py-1.5 text-sm font-mono']"
                @input="updateTableColumnPercent(index, $event.target.value)"
              />
              <span class="text-xs text-neutral-500">%</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="isGridTable && tableCellContext" class="space-y-3 rounded-lg border p-3" :class="ui.border">
        <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {{ t('templates.builderTableCellSection') }}
        </p>
        <p class="text-meta" :class="ui.textMuted">
          {{ t('templates.builderTableCellPosition', { row: tableCellContext.row + 1, col: tableCellContext.col + 1 }) }}
        </p>

        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldText') }}</label>
          <textarea
            :value="String(tableCellContext.cell?.text || '')"
            rows="3"
            :class="[ui.input, 'font-mono text-sm']"
            @change="patchTableCell({ text: $event.target.value })"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="mb-1 block" :class="ui.label">{{ t('templates.builderTableCellAlign') }}</label>
            <select
              :value="tableCellContext.cell?.align || 'left'"
              :class="ui.input"
              @change="patchTableCell({ align: $event.target.value })"
            >
              <option value="left">{{ t('templates.builderFormatAlignLeft') }}</option>
              <option value="center">{{ t('templates.builderFormatAlignCenter') }}</option>
              <option value="right">{{ t('templates.builderFormatAlignRight') }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldFormat') }}</label>
            <select
              :value="tableCellContext.cell?.format || 'text'"
              :class="ui.input"
              @change="patchTableCell({ format: $event.target.value })"
            >
              <option value="text">{{ t('templates.builderFormatText') }}</option>
              <option value="currency">{{ t('templates.builderFormatCurrency') }}</option>
              <option value="date">{{ t('templates.builderFormatDate') }}</option>
            </select>
          </div>
        </div>

        <button
          v-if="tableCellContext.row === tableRepeatRowIndex"
          type="button"
          class="text-xs text-primary-600 dark:text-primary-400"
          @click="patchTableCellClearDataRow"
        >
          {{ t('templates.builderTableClearDataRow') }}
        </button>
        <button
          v-else
          type="button"
          class="text-xs text-primary-600 dark:text-primary-400"
          @click="patchTableCellSetDataRow"
        >
          {{ t('templates.builderTableSetDataRow') }}
        </button>
      </div>

      <div v-if="isGridTable && tableRepeatRowIndex != null" class="space-y-2">
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderTableCollectionLabel') }}</label>
          <input
            :value="String(node.bindings?.collection || '')"
            type="text"
            :class="[ui.input, 'font-mono']"
            :placeholder="t('templates.builderTableCollectionPlaceholder')"
            @input="patchBindings({ collection: $event.target.value })"
          />
        </div>
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('templates.builderTableDataRowLabel', { row: tableRepeatRowIndex + 1 }) }}
          <template v-if="node.bindings?.collection">
            — {{ t('templates.builderTableDataRowHint', { collection: node.bindings.collection }) }}
          </template>
          <template v-else>
            — {{ t('templates.builderTableCollectionUnset') }}
          </template>
        </p>
      </div>

      <div v-if="!isGridTable">
        <div class="mb-2 flex items-center justify-between">
          <label :class="ui.label">{{ t('templates.builderTableColumns') }}</label>
          <button type="button" class="text-xs text-primary-600 dark:text-primary-400" @click="addTableColumn">
            {{ t('templates.builderAddColumn') }}
          </button>
        </div>
        <div class="space-y-2">
          <div
            v-for="(column, index) in tableColumns"
            :key="index"
            class="space-y-2 rounded-lg border p-2"
            :class="ui.border"
          >
            <input
              :value="column.header"
              type="text"
              :class="[ui.input, 'py-1.5 text-sm']"
              :placeholder="t('templates.builderColumnHeader')"
              @input="updateTableColumn(index, { header: $event.target.value })"
            />
            <input
              :value="column.path"
              type="text"
              :class="[ui.input, 'py-1.5 text-sm font-mono']"
              :placeholder="t('templates.builderColumnPath')"
              @input="updateTableColumn(index, { path: $event.target.value })"
            />
            <div class="flex items-center gap-2">
              <select
                :value="column.format || 'text'"
                :class="[ui.input, 'flex-1 py-1.5 text-sm']"
                @change="updateTableColumn(index, { format: $event.target.value })"
              >
                <option value="text">{{ t('templates.builderFormatText') }}</option>
                <option value="currency">{{ t('templates.builderFormatCurrency') }}</option>
                <option value="date">{{ t('templates.builderFormatDate') }}</option>
              </select>
              <button type="button" class="text-xs text-danger-600" @click="removeTableColumn(index)">
                {{ t('actions.delete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="node.type === 'LineItem'">
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('templates.builderLineItemHint') }}
      </p>
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            :checked="node.bindings?.showSections !== false"
            @change="patchBindings({ showSections: $event.target.checked })"
          />
          {{ t('templates.builderLineItemShowSections') }}
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            :checked="node.bindings?.showSectionTotals !== false"
            @change="patchBindings({ showSectionTotals: $event.target.checked })"
          />
          {{ t('templates.builderLineItemShowSectionTotals') }}
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            :checked="node.bindings?.showDocumentTotals !== false"
            @change="patchBindings({ showDocumentTotals: $event.target.checked })"
          />
          {{ t('templates.builderLineItemShowDocumentTotals') }}
        </label>
      </div>
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {{ t('templates.builderLineItemColumns') }}
        </p>
        <label
          v-for="column in lineItemColumns"
          :key="column.key"
          class="flex items-center gap-2 text-sm"
        >
          <input
            type="checkbox"
            :checked="column.visible !== false"
            :disabled="column.visible !== false && lineItemVisibleColumnCount <= 1"
            @change="toggleLineItemColumn(column.key, $event.target.checked)"
          />
          {{ column.header }}
        </label>
      </div>
      <div class="mt-3">
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderTableWidthPercent') }}</label>
        <div class="flex items-center gap-2">
          <input
            :value="Number(node.bindings?.tableWidthPercent || 100)"
            type="number"
            min="10"
            max="100"
            step="1"
            :class="[ui.input, 'font-mono']"
            @input="patchLineItemTableWidthPercent($event.target.value)"
          />
          <span class="text-xs text-neutral-500">%</span>
        </div>
      </div>

      <div v-if="lineItemVisibleColumnCount > 0" class="mt-3 space-y-2">
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderTableColumnPercents') }}</label>
        <div
          v-for="(column, index) in lineItemVisibleColumns"
          :key="`line-item-col-${column.key}`"
          class="flex items-center gap-2"
        >
          <span class="w-20 shrink-0 truncate text-xs text-neutral-500">{{ column.header }}</span>
          <input
            :value="lineItemColumnPercents[index]"
            type="number"
            min="5"
            max="95"
            step="1"
            :class="[ui.input, 'py-1.5 text-sm font-mono']"
            @input="updateLineItemColumnPercent(index, $event.target.value)"
          />
          <span class="text-xs text-neutral-500">%</span>
        </div>
      </div>
    </template>

    <template v-else-if="node.type === 'Row'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldRowGap') }}</label>
        <input
          :value="Number(node.bindings?.gap ?? 8)"
          type="number"
          min="0"
          max="48"
          step="1"
          :class="ui.input"
          @input="patchBindings({ gap: Number($event.target.value) })"
        />
        <p class="mt-1 text-xs" :class="ui.textMuted">{{ t('templates.builderFieldRowGapHint') }}</p>
      </div>
    </template>

    <template v-else-if="node.type === 'Column'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldColumnSpan') }}</label>
        <select
          :value="columnSpan"
          :class="ui.input"
          @change="patchBindings({ span: Number($event.target.value) })"
        >
          <option
            v-for="span in rowColumnSpanOptions"
            :key="span"
            :value="span"
          >
            {{ t('templates.builderFieldColumnSpanOption', { span, total: 12 }) }}
          </option>
        </select>
        <p class="mt-1 text-xs" :class="ui.textMuted">{{ t('templates.builderFieldColumnSpanHint') }}</p>
      </div>
    </template>

    <template v-else-if="bindingFields.length">
      <div v-for="field in bindingFields" :key="field.key">
        <label v-if="field.input !== 'checkbox'" class="mb-1 block" :class="ui.label">
          {{ t(field.labelKey) }}
        </label>
        <textarea
          v-if="field.input === 'textarea'"
          :value="bindingFieldValue(field)"
          :rows="field.rows || 3"
          :class="[ui.input, 'font-mono text-sm']"
          @input="patchBindingField(field, $event.target.value)"
        />
        <input
          v-else-if="field.input === 'number'"
          :value="bindingFieldValue(field)"
          type="number"
          :class="ui.input"
          @input="patchBindingField(field, $event.target.value)"
        />
        <label
          v-else-if="field.input === 'checkbox'"
          class="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
          :class="ui.border"
        >
          <input
            type="checkbox"
            :checked="Boolean(node.bindings?.[field.key])"
            @change="patchBindingField(field, $event.target.checked)"
          />
          <span :class="ui.textSubtle">{{ t(field.labelKey) }}</span>
        </label>
        <input
          v-else
          :value="bindingFieldValue(field)"
          type="text"
          :class="[ui.input, field.key === 'expression' || field.key === 'condition' ? 'font-mono text-sm' : '']"
          @input="patchBindingField(field, $event.target.value)"
        />
      </div>
    </template>

    <template v-else-if="node.type === 'Spacer'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldSpacerHeight') }}</label>
        <input
          :value="Number(node.bindings?.height || 16)"
          type="number"
          min="4"
          max="120"
          :class="ui.input"
          @input="patchBindings({ height: Number($event.target.value) })"
        />
      </div>
    </template>

    <div v-if="showLayoutFields" class="grid grid-cols-2 gap-2">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldPosX') }}</label>
        <input
          :value="Number(node.layout?.x || contentArea.x)"
          type="number"
          :min="contentArea.x"
          :class="ui.input"
          @input="patchLayout({ x: Number($event.target.value) })"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldPosY') }}</label>
        <input
          :value="Number(node.layout?.y || contentArea.y)"
          type="number"
          :min="contentArea.y"
          :class="ui.input"
          @input="patchLayout({ y: Number($event.target.value) })"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldWidth') }}</label>
        <input
          v-if="!(node.type === 'Table' && tableUsesPercentWidth)"
          :value="Number(node.layout?.width || 0)"
          type="number"
          min="16"
          :class="ui.input"
          @input="patchLayout({ width: Number($event.target.value) })"
        />
        <p v-else class="rounded-lg border px-3 py-2 text-sm font-mono" :class="ui.border">
          {{ resolvedTableFrameWidthPx }}px
        </p>
        <p v-if="node.type === 'Table' && tableUsesPercentWidth" class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('templates.builderTableFrameWidthHint') }}
        </p>
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldHeight') }}</label>
        <input
          :value="Number(node.layout?.height || 0)"
          type="number"
          min="16"
          :class="ui.input"
          @input="patchLayout({ height: Number($event.target.value) })"
        />
      </div>
    </div>

    <div v-if="showSpacingFields" class="grid grid-cols-2 gap-2">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldMarginTop') }}</label>
        <input
          :value="Number(node.style?.spacing?.marginTop || 0)"
          type="number"
          min="0"
          max="120"
          :class="ui.input"
          @input="patchSpacing({ marginTop: Number($event.target.value) })"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldMarginBottom') }}</label>
        <input
          :value="Number(node.style?.spacing?.marginBottom || 0)"
          type="number"
          min="0"
          max="120"
          :class="ui.input"
          @input="patchSpacing({ marginBottom: Number($event.target.value) })"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldPaddingTop') }}</label>
        <input
          :value="Number(node.style?.spacing?.paddingTop || 0)"
          type="number"
          min="0"
          max="120"
          :class="ui.input"
          @input="patchSpacing({ paddingTop: Number($event.target.value) })"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldPaddingBottom') }}</label>
        <input
          :value="Number(node.style?.spacing?.paddingBottom || 0)"
          type="number"
          min="0"
          max="120"
          :class="ui.input"
          @input="patchSpacing({ paddingBottom: Number($event.target.value) })"
        />
      </div>
    </div>
  </form>
</template>

<script setup>
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import BuilderImageAssetPicker from '@/components/templates/builder/BuilderImageAssetPicker.vue';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { BUILDER_PAGE_METRICS_KEY, BUILDER_TABLE_MERGE_CONTEXT_KEY } from '@/constants/builderInjectKeys';
import { buildTableBindingsPatch } from '@/utils/builderTableBindings';
import {
  normalizeTableGridBindings,
  resolveTableWidthPx,
  updateColumnWidthPercent
} from '@/utils/builderTableGridModel';
import { clampLayoutToContentArea } from '@/utils/builderLayout';
import {
  normalizeLineItemColumnList,
  resolveLineItemLayoutColumns,
  updateLineItemColumnWidthPercent,
  visibleLineItemColumns
} from '@/constants/lineItemDefaults';
import { getBuilderBindingFields,
  formatBindingFieldValue,
  parseBindingFieldInput
} from '@/constants/builderComponentBindings';
import { hasCanvasInlineEdit } from '@/constants/builderInlineEdit';
import {
  BUILDER_ROW_COLUMN_SPAN_OPTIONS,
  normalizeColumnSpan
} from '@/utils/builderRowColumnLayout';
import { isNodeHidden, isNodeLocked } from '@/utils/templateBuilderTree';

const props = defineProps({
  node: { type: Object, default: null },
  layoutMode: { type: String, default: 'flow' }
});

const emit = defineEmits(['patch', 'patch-table-cell']);

const { t } = useI18n();
const ui = useBuilderUi();
const pageMetrics = inject(BUILDER_PAGE_METRICS_KEY, null);
const tableSelectionContext = inject(BUILDER_TABLE_MERGE_CONTEXT_KEY, null);

const contentWidthPx = computed(() => pageMetrics?.value?.contentArea?.width || 704);

const contentArea = computed(() => pageMetrics?.value?.contentArea || {
  x: 45,
  y: 45,
  width: contentWidthPx.value,
  height: 1033
});

const isTypographyComponent = computed(() => {
  const type = props.node?.type;
  return type === 'Heading' || type === 'Paragraph';
});

const bindingFields = computed(() => {
  const type = String(props.node?.type || '');
  if (!type || ['Heading', 'Paragraph', 'MergeTag', 'Image', 'Logo', 'Table', 'LineItem', 'Spacer', 'Row', 'Column'].includes(type)) {
    return [];
  }
  return getBuilderBindingFields(type);
});

const rowColumnSpanOptions = BUILDER_ROW_COLUMN_SPAN_OPTIONS;

const columnSpan = computed(() => normalizeColumnSpan(props.node?.bindings?.span));

const showCanvasEditHint = computed(() => {
  const type = String(props.node?.type || '');
  if (!type) return false;
  if (type === 'Heading' || type === 'Paragraph') return true;
  return hasCanvasInlineEdit(type) && bindingFields.value.length === 0;
});

const tableColumns = computed(() => {
  const columns = props.node?.bindings?.columns;
  return Array.isArray(columns) ? columns : [];
});

const isGridTable = computed(() => Array.isArray(props.node?.bindings?.grid));

const tableRepeatRowIndex = computed(() => {
  const index = props.node?.bindings?.repeatRowIndex;
  return typeof index === 'number' ? index : null;
});

const tableCellContext = computed(() => {
  const ctx = tableSelectionContext?.value;
  if (!ctx || ctx.nodeId !== props.node?.id || !ctx.cell) return null;
  return ctx;
});

const tableGridBindings = computed(() => {
  if (props.node?.type !== 'Table') return null;
  return normalizeTableGridBindings(props.node?.bindings);
});

const tableColumnPercents = computed(() => tableGridBindings.value?.columnWidthPercents || []);

const tableUsesPercentWidth = computed(() =>
  isGridTable.value && tableGridBindings.value?.widthUnit === 'percent'
);

const resolvedTableFrameWidthPx = computed(() => {
  if (!tableGridBindings.value) return 0;
  return resolveTableWidthPx(tableGridBindings.value, contentWidthPx.value);
});

const defaultFontSize = computed(() => (props.node?.type === 'Heading' ? 24 : 14));
const defaultFontWeight = computed(() => (props.node?.type === 'Heading' ? 700 : 400));

const showSpacingFields = computed(() => {
  const type = props.node?.type;
  return type && type !== 'Page' && type !== 'PageBreak';
});

const showLayoutFields = computed(() => {
  return props.layoutMode === 'absolute'
    && props.node?.type
    && props.node.type !== 'Page';
});

const lineItemColumns = computed(() => {
  if (props.node?.type !== 'LineItem') return [];
  return normalizeLineItemColumnList(props.node?.bindings?.columns);
});

const lineItemVisibleColumnCount = computed(() =>
  lineItemColumns.value.filter((column) => column.visible !== false).length
);

const lineItemVisibleColumns = computed(() => visibleLineItemColumns(props.node?.bindings?.columns));

const lineItemColumnPercents = computed(() => {
  const layout = resolveLineItemLayoutColumns(props.node?.bindings?.columns);
  const stored = props.node?.bindings?.columnWidthPercents;
  if (Array.isArray(stored) && stored.length === layout.visibleColumns.length) {
    return stored;
  }
  return layout.columnWidthPercents;
});

function toggleLineItemColumn(key, visible) {
  const next = lineItemColumns.value.map((column) =>
    column.key === key ? { ...column, visible } : column
  );
  const visibleCount = next.filter((column) => column.visible !== false).length;
  if (visibleCount < 1) return;
  const layout = resolveLineItemLayoutColumns(next);
  patchBindings({
    columns: layout.columns,
    columnWidths: layout.columnWidths,
    columnWidthPercents: layout.columnWidthPercents
  });
}

function patchLineItemTableWidthPercent(raw) {
  patchBindings({ tableWidthPercent: Math.max(10, Math.min(100, Number(raw) || 100)) });
}

function updateLineItemColumnPercent(col, raw) {
  const bindings = updateLineItemColumnWidthPercent(
    props.node?.bindings || {},
    col,
    Number(raw) || 0
  );
  patchBindings(bindings);
}

function patchLayout(partial) {
  const merged = {
    ...(props.node?.layout || {}),
    ...partial
  };
  const layout = clampLayoutToContentArea(
    {
      x: Number(merged.x) || contentArea.value.x,
      y: Number(merged.y) || contentArea.value.y,
      width: Math.max(32, Number(merged.width) || 240),
      height: Math.max(32, Number(merged.height) || 80),
      zIndex: merged.zIndex
    },
    contentArea.value
  );
  emit('patch', { layout });
}

function patchTypography(partial) {
  emit('patch', {
    style: {
      typography: {
        ...(props.node?.style?.typography || {}),
        ...partial
      }
    }
  });
}

function patchSpacing(partial) {
  emit('patch', {
    style: {
      spacing: {
        ...(props.node?.style?.spacing || {}),
        ...partial
      }
    }
  });
}

function onAssetSelected({ src, alt }) {
  patchBindings({ src, alt: alt || props.node?.bindings?.alt || '' });
}

function patchName(name) {
  emit('patch', { name });
}

function patchBindings(partial) {
  emit('patch', {
    bindings: {
      ...(props.node?.bindings || {}),
      ...partial
    }
  });
}

function bindingFieldValue(field) {
  const raw = props.node?.bindings?.[field.key];
  return formatBindingFieldValue(field, raw);
}

function patchBindingField(field, raw) {
  patchBindings({ [field.key]: parseBindingFieldInput(field, raw) });
}

function patchTableCell(cellPatch) {
  const ctx = tableCellContext.value;
  if (!ctx) return;
  emit('patch-table-cell', {
    row: ctx.row,
    col: ctx.col,
    patch: cellPatch
  });
}

function patchTableCellSetDataRow() {
  const ctx = tableCellContext.value;
  if (!ctx) return;
  emit('patch-table-cell', {
    row: ctx.row,
    col: ctx.col,
    patch: {},
    setDataRow: true
  });
}

function patchTableCellClearDataRow() {
  emit('patch', {
    bindings: {
      ...(props.node?.bindings || {}),
      repeatRowIndex: null
    }
  });
}

function patchTableBindings(next) {
  emit('patch', {
    bindings: buildTableBindingsPatch(props.node?.bindings, next)
  });
}

function updateTableWidthPercent(value) {
  const next = Math.max(10, Math.min(100, Number(value) || 100));
  patchTableBindings({ tableWidthPercent: next, widthUnit: 'percent' });
}

function updateTableColumnPercent(index, value) {
  if (!tableGridBindings.value) return;
  patchTableBindings(updateColumnWidthPercent(tableGridBindings.value, index, Number(value) || 5));
}

function patchVisibility(partial) {
  emit('patch', {
    visibility: {
      ...(props.node?.visibility || {}),
      ...partial
    }
  });
}

function updateTableColumn(index, patch) {
  const next = tableColumns.value.map((column, i) =>
    i === index ? { ...column, ...patch } : column
  );
  patchBindings({ columns: next });
}

function addTableColumn() {
  patchBindings({
    columns: [...tableColumns.value, { header: 'Column', path: 'field', format: 'text' }]
  });
}

function removeTableColumn(index) {
  patchBindings({
    columns: tableColumns.value.filter((_, i) => i !== index)
  });
}
</script>

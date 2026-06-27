<template>
  <section class="space-y-3 border-t pt-4" :class="ui.border">
    <div>
      <h3 :class="ui.label">{{ t('templates.builderComponentLineItem') }}</h3>
      <p class="mt-1 text-xs leading-relaxed" :class="ui.textMuted">
        {{ t('templates.builderLineItemHint') }}
      </p>
    </div>

    <div class="space-y-2">
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="bindings.showSections !== false"
          @change="patch({ showSections: $event.target.checked })"
        />
        {{ t('templates.builderLineItemShowSections') }}
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="bindings.showSectionTotals !== false"
          @change="patch({ showSectionTotals: $event.target.checked })"
        />
        {{ t('templates.builderLineItemShowSectionTotals') }}
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="bindings.showDocumentTotals !== false"
          @change="patch({ showDocumentTotals: $event.target.checked })"
        />
        {{ t('templates.builderLineItemShowDocumentTotals') }}
      </label>
    </div>

    <div>
      <label class="mb-1 block" :class="ui.label">{{ t('templates.builderCurrencyDisplay') }}</label>
      <select
        :value="currencyDisplayValue"
        :class="ui.input"
        @change="patchCurrencyDisplay($event.target.value)"
      >
        <option value="">{{ t('templates.builderCurrencyDisplayInherit') }}</option>
        <option value="code">{{ t('templates.builderCurrencyDisplayCode') }}</option>
        <option value="symbol">{{ t('templates.builderCurrencyDisplaySymbol') }}</option>
      </select>
    </div>

    <div class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wide" :class="ui.textMuted">
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
          :disabled="column.visible !== false && visibleColumnCount <= 1"
          @change="toggleColumn(column.key, $event.target.checked)"
        />
        {{ column.header }}
      </label>
    </div>

    <div>
      <label class="mb-1 block" :class="ui.label">{{ t('templates.builderTableWidthPercent') }}</label>
      <div class="flex items-center gap-2">
        <input
          :value="Number(bindings.tableWidthPercent || 100)"
          type="number"
          min="10"
          max="100"
          step="1"
          :class="[ui.input, 'font-mono']"
          @input="patchTableWidth($event.target.value)"
        />
        <span class="text-xs" :class="ui.textMuted">%</span>
      </div>
    </div>

    <div v-if="visibleColumnCount > 0" class="space-y-2">
      <label class="mb-1 block" :class="ui.label">{{ t('templates.builderTableColumnPercents') }}</label>
      <div
        v-for="(column, index) in visibleColumns"
        :key="`line-item-col-${column.key}`"
        class="flex items-center gap-2"
      >
        <span class="w-20 shrink-0 truncate text-xs" :class="ui.textMuted">{{ column.header }}</span>
        <input
          :value="columnPercents[index]"
          type="number"
          min="5"
          max="95"
          step="1"
          :class="[ui.input, 'py-1.5 text-sm font-mono']"
          @input="updateColumnPercent(index, $event.target.value)"
        />
        <span class="text-xs" :class="ui.textMuted">%</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import {
  normalizeLineItemColumnList,
  resolveLineItemLayoutColumns,
  updateLineItemColumnWidthPercent,
  visibleLineItemColumns
} from '@/constants/lineItemDefaults';
import {
  getLineItemTemplateModuleScope,
  updateLineItemBindings
} from '../editor/lineItemComponent';
import { readLineItemBindings } from '../editor/lineItemModel';

const props = defineProps({
  component: { type: Object, required: true },
  moduleScope: { type: String, default: '' },
  revision: { type: Number, default: 0 }
});

const emit = defineEmits(['change']);

const { t } = useI18n();
const ui = useBuilderUi();

const scope = computed(() => props.moduleScope || getLineItemTemplateModuleScope());

const bindings = computed(() => {
  void props.revision;
  return readLineItemBindings(props.component, scope.value);
});

const lineItemColumns = computed(() => normalizeLineItemColumnList(bindings.value.columns));

const visibleColumnCount = computed(() =>
  lineItemColumns.value.filter((column) => column.visible !== false).length
);

const visibleColumns = computed(() => visibleLineItemColumns(bindings.value.columns));

const columnPercents = computed(() => {
  const layout = resolveLineItemLayoutColumns(bindings.value.columns);
  const stored = bindings.value.columnWidthPercents;
  if (Array.isArray(stored) && stored.length === layout.visibleColumns.length) {
    return stored;
  }
  return layout.columnWidthPercents;
});

const currencyDisplayValue = computed(() => {
  const mode = bindings.value.currencyDisplay;
  return mode === 'symbol' || mode === 'code' ? mode : '';
});

function patch(partial) {
  updateLineItemBindings(props.component, partial);
  emit('change');
}

function patchCurrencyDisplay(value) {
  if (value === 'code' || value === 'symbol') {
    patch({ currencyDisplay: value });
    return;
  }
  patch({ currencyDisplay: '' });
}

function toggleColumn(key, visible) {
  const next = lineItemColumns.value.map((column) =>
    column.key === key ? { ...column, visible } : column
  );
  const count = next.filter((column) => column.visible !== false).length;
  if (count < 1) return;
  const layout = resolveLineItemLayoutColumns(next);
  patch({
    columns: layout.columns,
    columnWidths: layout.columnWidths,
    columnWidthPercents: layout.columnWidthPercents
  });
}

function patchTableWidth(raw) {
  patch({ tableWidthPercent: Math.max(10, Math.min(100, Number(raw) || 100)) });
}

function updateColumnPercent(col, raw) {
  const next = updateLineItemColumnWidthPercent(bindings.value, col, Number(raw) || 0);
  patch(next);
}
</script>

<template>
  <div class="flex w-full min-w-0 items-center gap-2">
    <div
      v-if="reserveConnectorColumn || $slots.connector"
      class="flex h-9 flex-shrink-0 items-center justify-end self-center"
      :style="{ width: FILTER_RULE_CONNECTOR_WIDTH }"
    >
      <slot name="connector" />
    </div>
    <div
      class="grid min-h-9 min-w-0 flex-1 items-center gap-2"
      :class="fieldGridClass"
    >
      <FilterFieldPicker
        :model-value="fieldKey"
        :options="fieldOptions"
        :class="fieldPickerClass"
        @update:model-value="onFieldChange"
      />
      <template v-if="showOperatorColumn">
        <FilterOperatorPicker
          v-if="resolvedFilter"
          :model-value="operator"
          :filter="resolvedFilter"
          class="w-full min-w-0"
          @update:model-value="onOperatorChange"
        />
        <span
          v-else
          class="inline-flex h-9 w-full min-w-0 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-400 dark:border-gray-600 dark:bg-gray-800"
        >
          {{ t('common.filterBuilderOperatorIs') }}
        </span>
      </template>
      <template v-if="showValueColumn">
        <div v-if="showValueInput" class="min-w-0 w-full">
          <FilterValuePicker
            :filter="resolvedFilter!"
            :model-value="modelValue"
            :operator="operator"
            @update:model-value="onValueChange"
            @opened="$emit('filter-opened', resolvedFilter!.key)"
          />
        </div>
        <div
          v-else-if="!resolvedFilter"
          class="inline-flex h-9 w-full min-w-0 items-center rounded-lg border border-dashed border-gray-200 px-3 text-sm text-gray-400 dark:border-gray-600"
        >
          {{ t('common.filterBuilderSelectValue') }}
        </div>
      </template>
    </div>
    <button
      v-if="showRemove"
      type="button"
      class="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center self-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      :aria-label="t('common.filterBuilderRemoveRule')"
      @click="$emit('remove')"
    >
      <TrashIcon class="h-4 w-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { TrashIcon } from '@heroicons/vue/24/outline';
import FilterFieldPicker from '@/components/filters/FilterFieldPicker.vue';
import FilterOperatorPicker from '@/components/filters/FilterOperatorPicker.vue';
import FilterValuePicker from '@/components/filters/FilterValuePicker.vue';
import {
  FILTER_RULE_CONNECTOR_WIDTH,
  FILTER_RULE_GRID_CLASS,
  FILTER_RULE_GRID_NO_VALUE_CLASS,
} from '@/components/filters/filterRuleLayout';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import {
  getDefaultOperatorForFilter,
  operatorRequiresValue,
} from '@/platform/filters/filterOperators';

const props = withDefaults(
  defineProps<{
    fieldKey: string | null;
    modelValue: unknown;
    operator: FilterOperatorId;
    fieldOptions: FilterConfig[];
    filterByKey: Record<string, FilterConfig>;
    showRemove?: boolean;
    hideOperatorUntilField?: boolean;
    reserveConnectorColumn?: boolean;
  }>(),
  {
    showRemove: true,
    hideOperatorUntilField: false,
    reserveConnectorColumn: false,
  }
);

const emit = defineEmits<{
  (e: 'update:fieldKey', value: string | null): void;
  (e: 'update:modelValue', value: unknown): void;
  (e: 'update:operator', value: FilterOperatorId): void;
  (e: 'remove'): void;
  (e: 'filter-opened', key: string): void;
}>();

const { t } = useI18n();

const resolvedFilter = computed(() => {
  if (!props.fieldKey) return null;
  return props.filterByKey[props.fieldKey] ?? props.fieldOptions.find((f) => f.key === props.fieldKey) ?? null;
});

const showValueInput = computed(
  () => Boolean(resolvedFilter.value) && operatorRequiresValue(props.operator)
);

const showOperatorColumn = computed(
  () => !props.hideOperatorUntilField || Boolean(resolvedFilter.value)
);

const showValueColumn = computed(() => {
  if (props.hideOperatorUntilField && !resolvedFilter.value) return false;
  if (!resolvedFilter.value) return true;
  return operatorRequiresValue(props.operator);
});

/** Keep 3-column grid when nested rows need to align with parent; else compact single column. */
const usesThreeColumnGrid = computed(
  () => props.reserveConnectorColumn || showOperatorColumn.value || showValueColumn.value
);

const fieldGridClass = computed(() => {
  if (!usesThreeColumnGrid.value) return 'grid-cols-[minmax(10.5rem,1fr)]';
  if (!showValueColumn.value) return FILTER_RULE_GRID_NO_VALUE_CLASS;
  return FILTER_RULE_GRID_CLASS;
});

const fieldPickerClass = computed(() => {
  const base = 'w-full min-w-0';
  if (usesThreeColumnGrid.value && !showOperatorColumn.value && !showValueColumn.value) {
    return `${base} col-span-3`;
  }
  return base;
});

function onFieldChange(key: string | null) {
  emit('update:fieldKey', key);
  emit('update:modelValue', '');
  if (key) {
    const filter = props.filterByKey[key] ?? props.fieldOptions.find((f) => f.key === key);
    emit('update:operator', getDefaultOperatorForFilter(filter ?? null));
  }
}

function onOperatorChange(op: FilterOperatorId) {
  emit('update:operator', op);
}

function onValueChange(value: unknown) {
  emit('update:modelValue', value);
}
</script>

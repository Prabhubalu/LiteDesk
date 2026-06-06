<template>
  <div class="min-w-0 w-full">
    <input
      v-if="isTextInput"
      :value="textValue"
      type="text"
      :placeholder="textPlaceholder"
      class="block h-9 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      @input="onTextInput"
    />
    <ListColumnFilter
      v-else
      :filter="effectiveFilter"
      :model-value="modelValue"
      dense
      teleport-options
      @update:model-value="$emit('update:modelValue', $event)"
      @opened="$emit('opened')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ListColumnFilter from '@/components/common/ListColumnFilter.vue';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import { operatorRequiresValue, operatorUsesMultiValue } from '@/platform/filters/filterOperators';

const props = defineProps<{
  filter: FilterConfig;
  modelValue: unknown;
  operator: FilterOperatorId;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void;
  (e: 'opened'): void;
}>();

const { t } = useI18n();

const isTextInput = computed(
  () =>
    operatorRequiresValue(props.operator) &&
    (props.filter.filterType === 'text' ||
      props.filter.filterType === 'number' ||
      props.operator === 'contains' ||
      props.operator === 'not_contains')
);

const effectiveFilter = computed((): FilterConfig => {
  if (operatorUsesMultiValue(props.operator, props.filter.filterType)) {
    return { ...props.filter, filterType: 'multi-select' };
  }
  return props.filter;
});

const textValue = computed(() => (props.modelValue == null ? '' : String(props.modelValue)));

const textPlaceholder = computed(() => {
  if (props.filter.filterType === 'number') {
    return t('common.listColumnFilterNumberExample');
  }
  return t('common.filterBuilderValuePlaceholder');
});

function onTextInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

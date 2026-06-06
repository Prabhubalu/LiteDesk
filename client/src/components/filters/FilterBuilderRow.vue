<template>
  <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
    <div class="flex items-start gap-2">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <FilterFieldPicker
          :model-value="fieldKey"
          :options="fieldOptions"
          :class="fieldPickerClass"
          @update:model-value="onFieldChange"
        />
        <FilterOperatorPicker
          v-if="resolvedFilter"
          :model-value="operator"
          :filter="resolvedFilter"
          :class="operatorPickerClass"
          @update:model-value="onOperatorChange"
        />
        <span
          v-else
          class="inline-flex h-9 flex-shrink-0 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-400 dark:border-gray-600 dark:bg-gray-800"
        >
          {{ t('common.filterBuilderOperatorIs') }}
        </span>
        <div v-if="showValueInput" class="min-w-[8rem] flex-1">
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
          class="inline-flex h-9 min-w-[8rem] flex-1 items-center rounded-lg border border-dashed border-gray-200 px-3 text-sm text-gray-400 dark:border-gray-600"
        >
          {{ t('common.filterBuilderSelectValue') }}
        </div>
      </div>
      <button
        type="button"
        class="mt-1 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        :aria-label="t('common.filterBuilderRemoveRule')"
        @click="$emit('remove')"
      >
        <TrashIcon class="h-4 w-4" />
      </button>
    </div>
    <div v-if="$slots.footer" class="mt-2">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { TrashIcon } from '@heroicons/vue/24/outline';
import FilterFieldPicker from '@/components/filters/FilterFieldPicker.vue';
import FilterOperatorPicker from '@/components/filters/FilterOperatorPicker.vue';
import FilterValuePicker from '@/components/filters/FilterValuePicker.vue';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import {
  getDefaultOperatorForFilter,
  operatorRequiresValue,
} from '@/platform/filters/filterOperators';

const props = defineProps<{
  fieldKey: string | null;
  modelValue: unknown;
  operator: FilterOperatorId;
  fieldOptions: FilterConfig[];
  filterByKey: Record<string, FilterConfig>;
}>();

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

const fieldPickerClass = computed(() =>
  showValueInput.value || !resolvedFilter.value
    ? 'min-w-[8rem] flex-1'
    : 'w-[10.5rem] flex-shrink-0'
);

const operatorPickerClass = computed(() =>
  !showValueInput.value && resolvedFilter.value
    ? 'min-w-0 flex-1'
    : 'w-[7rem] flex-shrink-0'
);

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

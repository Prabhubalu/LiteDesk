<template>
  <HeadlessSelect
    :model-value="modelValue"
    :options="logicOptions"
    teleport
    :searchable="false"
    :truncate-button-label="false"
    button-class="!h-9 !w-auto !min-w-[3.75rem] !rounded-md !border-gray-200 !bg-white !px-2.5 !text-xs !font-semibold !uppercase !tracking-wide dark:!border-gray-600 dark:!bg-gray-800"
    @update:model-value="onUpdate"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import type { FilterLogic } from '@/platform/filters/filterQueryAst';

defineProps<{
  modelValue: FilterLogic;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: FilterLogic): void;
}>();

const { t } = useI18n();

const logicOptions = computed(() => [
  { value: 'AND', label: t('common.filterBuilderAnd') },
  { value: 'OR', label: t('common.filterBuilderOr') },
]);

function onUpdate(value: string | number | null) {
  const logic = String(value || 'AND').toUpperCase();
  emit('update:modelValue', logic === 'OR' ? 'OR' : 'AND');
}
</script>

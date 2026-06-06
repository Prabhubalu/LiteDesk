<template>
  <div ref="rootRef" class="relative min-w-0 w-full">
    <button
      ref="buttonRef"
      type="button"
      class="relative inline-flex h-9 w-full min-w-0 items-center rounded-lg border border-gray-200 bg-white px-3 text-left text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      @click="toggleMenu"
    >
      <span class="block min-w-0 flex-1 truncate">
        {{ selectedLabel }}
      </span>
      <ChevronUpDownIcon class="ml-2 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        :style="menuStyle"
        class="fixed z-[10050] max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
        @mousedown.stop
      >
        <button
          v-for="op in operatorOptions"
          :key="op.value"
          type="button"
          class="relative flex w-full cursor-pointer select-none items-center py-2 pl-3 pr-8 text-left text-sm text-gray-900 hover:bg-indigo-50 dark:text-gray-100 dark:hover:bg-indigo-900/30"
          :class="op.value === modelValue ? 'bg-indigo-50 font-medium text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100' : 'font-normal'"
          @mousedown.prevent="selectOperator(op.value)"
        >
          <span class="truncate">{{ op.label }}</span>
          <CheckIcon
            v-if="op.value === modelValue"
            class="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-600 dark:text-indigo-400"
          />
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/20/solid';
import { Teleport } from 'vue';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import { getOperatorsForFilter } from '@/platform/filters/filterOperators';

const props = defineProps<{
  modelValue: FilterOperatorId;
  filter: FilterConfig | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: FilterOperatorId): void;
}>();

const { t } = useI18n();

const rootRef = ref<HTMLElement | null>(null);
const buttonRef = ref<HTMLButtonElement | null>(null);
const open = ref(false);
const menuStyle = ref<Record<string, string>>({});

const operatorOptions = computed(() =>
  getOperatorsForFilter(props.filter).map((op) => ({
    value: op.id,
    label: t(op.labelKey),
  }))
);

const selectedLabel = computed(() => {
  const match = operatorOptions.value.find((op) => op.value === props.modelValue);
  return match?.label ?? t('common.filterOperatorIs');
});

function syncMenuPosition() {
  const el = buttonRef.value;
  if (!el?.getBoundingClientRect) return;
  const rect = el.getBoundingClientRect();
  menuStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 128)}px`,
  };
}

function toggleMenu() {
  open.value = !open.value;
  if (open.value) syncMenuPosition();
}

function selectOperator(value: FilterOperatorId) {
  emit('update:modelValue', value);
  open.value = false;
}

function onDocumentMouseDown(event: MouseEvent) {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (rootRef.value?.contains(target)) return;
  open.value = false;
}

function onViewportChange() {
  if (open.value) syncMenuPosition();
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown);
  window.removeEventListener('scroll', onViewportChange, true);
  window.removeEventListener('resize', onViewportChange);
});
</script>

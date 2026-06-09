<template>
  <div ref="rootRef" class="min-w-0">
    <button
      ref="buttonRef"
      type="button"
      class="relative inline-flex h-9 w-full min-w-0 items-center rounded-lg border border-gray-200 bg-white px-3 text-left text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      @click="toggleMenu"
    >
      <component
        v-if="selectedFilter"
        :is="getFilterFieldIcon(selectedFilter)"
        class="mr-2 h-4 w-4 flex-shrink-0 text-gray-400"
      />
      <span
        class="block min-w-0 flex-1 truncate"
        :class="selectedFilter ? '' : 'text-gray-400 dark:text-gray-500'"
      >
        {{ selectedLabel }}
      </span>
      <ChevronUpDownIcon class="ml-2 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        :style="menuStyle"
        class="fixed z-[10050] max-h-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
        @mousedown.stop
      >
        <div class="border-b border-gray-200 p-2 dark:border-gray-600" @mousedown.stop>
          <div class="relative">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              :placeholder="t('common.filterBuilderSearchFields')"
              class="w-full rounded-md border-0 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-600"
              autocomplete="off"
              @keydown.stop
              @mousedown.stop
            />
          </div>
        </div>
        <div class="max-h-56 overflow-auto py-1">
          <div
            v-if="filteredOptions.length === 0"
            class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
          >
            {{ t('common.filterBuilderNoFields') }}
          </div>
          <button
            v-for="filter in filteredOptions"
            :key="filter.key"
            type="button"
            class="relative flex w-full cursor-pointer select-none items-center gap-2 py-2 pl-3 pr-8 text-left text-sm text-gray-900 hover:bg-indigo-50 dark:text-gray-100 dark:hover:bg-indigo-900/30"
            :class="filter.key === modelValue ? 'bg-indigo-50 font-medium text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100' : 'font-normal'"
            @mousedown.prevent="selectField(filter.key)"
          >
            <component :is="getFilterFieldIcon(filter)" class="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span class="truncate">{{ filter.label || filter.key }}</span>
            <CheckIcon
              v-if="filter.key === modelValue"
              class="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-600 dark:text-indigo-400"
            />
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckIcon, ChevronUpDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/20/solid';
import { Teleport } from 'vue';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import { getFilterFieldIcon } from '@/platform/filters/filterFieldIcons';

const props = defineProps<{
  modelValue: string | null;
  options: FilterConfig[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void;
}>();

const { t } = useI18n();
const rootRef = ref<HTMLElement | null>(null);
const buttonRef = ref<HTMLButtonElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const open = ref(false);
const searchQuery = ref('');
const menuStyle = ref<Record<string, string>>({});

const selectedFilter = computed(() =>
  props.options.find((filter) => filter.key === props.modelValue) ?? null
);

const selectedLabel = computed(() => {
  if (selectedFilter.value) {
    return selectedFilter.value.label || selectedFilter.value.key;
  }
  return t('common.filterBuilderSelectFilter');
});

const filteredOptions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const sorted = [...props.options].sort((a, b) =>
    (a.label || a.key).localeCompare(b.label || b.key)
  );
  if (!query) return sorted;
  return sorted.filter((filter) => {
    const label = (filter.label || filter.key).toLowerCase();
    return label.includes(query) || filter.key.toLowerCase().includes(query);
  });
});

function syncMenuPosition() {
  const el = buttonRef.value;
  if (!el?.getBoundingClientRect) return;
  const rect = el.getBoundingClientRect();
  menuStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 224)}px`,
  };
}

function toggleMenu() {
  open.value = !open.value;
  if (open.value) {
    syncMenuPosition();
    nextTick(() => searchInputRef.value?.focus());
  } else {
    searchQuery.value = '';
  }
}

function selectField(key: string) {
  searchQuery.value = '';
  emit('update:modelValue', key);
  open.value = false;
}

function onDocumentMouseDown(event: MouseEvent) {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (rootRef.value?.contains(target)) return;
  open.value = false;
  searchQuery.value = '';
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

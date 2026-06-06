<template>
  <div class="min-w-0">
    <Combobox
      as="div"
      class="relative min-w-0 w-full"
      :model-value="modelValue"
      nullable
      v-slot="{ open }"
      @update:model-value="onSelect"
    >
      <span v-show="false" aria-hidden="true">{{ syncOpenState(open) }}</span>
      <div class="relative min-w-0">
      <ComboboxButton
        ref="buttonRef"
        class="relative inline-flex h-9 w-full min-w-0 items-center rounded-lg border border-gray-200 bg-white px-3 text-left text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        @click="syncMenuPosition"
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
      </ComboboxButton>

      <Transition
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <Teleport to="body">
          <ComboboxOptions
            v-if="open"
            :style="menuStyle"
            class="fixed z-[10050] max-h-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
            @vue:before-mount="syncMenuPosition"
          >
            <div class="border-b border-gray-200 p-2 dark:border-gray-600" @click.stop @mousedown.stop>
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
                  @click.stop
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
              <ComboboxOption
                v-for="filter in filteredOptions"
                :key="filter.key"
                :value="filter.key"
                v-slot="{ active, selected }"
              >
                <li
                  :class="[
                    'relative flex cursor-pointer select-none items-center gap-2 py-2 pl-3 pr-8 text-sm',
                    active ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100',
                  ]"
                >
                  <component :is="getFilterFieldIcon(filter)" class="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span :class="[selected ? 'font-medium' : 'font-normal', 'truncate']">
                    {{ filter.label || filter.key }}
                  </span>
                  <CheckIcon
                    v-if="selected"
                    class="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-600 dark:text-indigo-400"
                  />
                </li>
              </ComboboxOption>
            </div>
          </ComboboxOptions>
        </Teleport>
      </Transition>
      </div>
    </Combobox>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Combobox,
  ComboboxButton,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/20/solid';
import { Transition, Teleport } from 'vue';
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
const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
const buttonRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});
const comboboxOpen = ref(false);
let viewportListenersBound = false;

function getButtonElement(): HTMLElement | null {
  const raw = buttonRef.value;
  if (!raw) return null;
  return ('$el' in raw && raw.$el ? raw.$el : raw) as HTMLElement;
}

function syncMenuPosition() {
  const el = getButtonElement();
  if (!el?.getBoundingClientRect) return;
  const rect = el.getBoundingClientRect();
  menuStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 224)}px`,
  };
}

function syncOpenState(open: boolean) {
  const wasOpen = comboboxOpen.value;
  comboboxOpen.value = open;
  if (!wasOpen && open) {
    syncMenuPosition();
    nextTick(() => searchInputRef.value?.focus());
  }
  if (wasOpen && !open) {
    searchQuery.value = '';
  }
  return '';
}

function onViewportChange() {
  if (comboboxOpen.value) syncMenuPosition();
}

function bindViewportListeners() {
  if (viewportListenersBound) return;
  viewportListenersBound = true;
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
}

function unbindViewportListeners() {
  if (!viewportListenersBound) return;
  viewportListenersBound = false;
  window.removeEventListener('scroll', onViewportChange, true);
  window.removeEventListener('resize', onViewportChange);
}

watch(comboboxOpen, (open) => {
  if (open) {
    bindViewportListeners();
    syncMenuPosition();
  } else {
    unbindViewportListeners();
  }
});

onBeforeUnmount(() => {
  unbindViewportListeners();
});

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

function onSelect(value: string | null) {
  searchQuery.value = '';
  emit('update:modelValue', value);
}
</script>

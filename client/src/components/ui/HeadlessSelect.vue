<template>
  <Listbox
    :model-value="modelValue"
    v-slot="{ open }"
    @update:model-value="onModelValueUpdate"
    as="div"
    :class="['relative', wrapperClass]"
  >
    <span v-show="false" aria-hidden="true">{{ syncListboxOpenState(open) }}</span>
    <ListboxButton
      ref="buttonRef"
      :id="id"
      :disabled="disabled"
      :class="[
        'block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500',
        'relative cursor-default text-left',
        disabled && 'cursor-not-allowed opacity-60',
        invalid && 'border-red-500 dark:border-red-500',
        buttonClass
      ]"
      @click="onListboxButtonClick"
    >
      <span
        :class="[
          'block truncate pr-8',
          isMutedSelection && 'text-gray-500 dark:text-gray-500'
        ]"
      >
        {{ buttonText }}
      </span>
      <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <ChevronUpDownIcon class="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
      </span>
    </ListboxButton>
    <Transition
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <Teleport to="body" :disabled="!teleport">
        <ListboxOptions
          v-if="!teleport || open"
          :style="teleport ? teleportMenuStyle : undefined"
          @vue:before-mount="syncTeleportPosition"
          @vue:before-unmount="clearSearch"
          :class="[
            teleport
              ? 'fixed z-[10050] mt-0 rounded-lg bg-white dark:bg-gray-700 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm'
              : 'absolute z-10 mt-1 w-full rounded-lg bg-white dark:bg-gray-700 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm',
            showSearch ? 'max-h-72 flex flex-col overflow-hidden' : 'max-h-60 overflow-auto py-1',
            optionsClass
          ]"
        >
        <div
          v-if="showSearch"
          class="shrink-0 p-2 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
          @click.stop
          @mousedown.stop
        >
          <div class="relative">
            <MagnifyingGlassIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              :placeholder="searchPlaceholderText"
              class="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              autocomplete="off"
              @click.stop
              @keydown.stop
            />
          </div>
        </div>
        <div :class="showSearch ? 'min-h-0 max-h-52 overflow-y-auto py-1' : ''">
        <ListboxOption
          v-if="allowEmpty"
          :value="emptyValue"
          v-slot="{ active }"
        >
          <li :class="optionRowClass(active)">
            <span class="block truncate">{{ emptyLabel }}</span>
          </li>
        </ListboxOption>
        <template v-if="hasGroups">
          <template v-for="(group, groupIndex) in filteredOptionGroups" :key="group.label || groupIndex">
            <div
              v-if="group.label"
              :class="[
                'px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400',
                (allowEmpty || groupIndex > 0) && 'mt-1 border-t border-gray-100 dark:border-gray-600'
              ]"
              role="presentation"
            >
              {{ group.label }}
            </div>
            <ListboxOption
              v-for="opt in group.options"
              :key="String(opt.value)"
              :value="opt.value"
              v-slot="{ active, selected }"
            >
              <li :class="optionRowClass(active)">
                <span :class="['block truncate', selected ? 'font-semibold' : 'font-normal']">{{ opt.label }}</span>
                <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                  </svg>
                </span>
              </li>
            </ListboxOption>
          </template>
        </template>
        <ListboxOption
          v-else
          v-for="opt in filteredOptions"
          :key="String(opt.value)"
          :value="opt.value"
          v-slot="{ active, selected }"
        >
          <li :class="optionRowClass(active)">
            <span :class="['block truncate', selected ? 'font-semibold' : 'font-normal']">{{ opt.label }}</span>
            <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
              </svg>
            </span>
          </li>
        </ListboxOption>
        <div
          v-if="showSearch && !hasFilteredResults"
          class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
        >
          {{ noMatchesText }}
        </div>
        </div>
        </ListboxOptions>
      </Teleport>
    </Transition>
  </Listbox>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { ChevronUpDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  modelValue: { type: [String, Number, null], default: null },
  /** Options: { value: string|number, label: string }[] */
  options: { type: Array, default: () => [] },
  /** Grouped options: { label: string, options: { value, label }[] }[] */
  optionGroups: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select...' },
  allowEmpty: { type: Boolean, default: false },
  emptyLabel: { type: String, default: '—' },
  emptyValue: { type: [String, Number], default: '' },
  id: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
  /** Visual error state (matches DynamicFormField) */
  invalid: { type: Boolean, default: false },
  /** Merged into ListboxButton after base styles */
  buttonClass: { type: [String, Array, Object], default: undefined },
  /** Merged into ListboxOptions (e.g. z-index above drawers/modals) */
  optionsClass: { type: [String, Array, Object], default: undefined },
  /** Root Listbox wrapper (use mt-2 below a label to match DynamicFormField) */
  wrapperClass: { type: [String, Array, Object], default: '' },
  /** Render dropdown in document body (avoids overflow clipping in headers/toolbars) */
  teleport: { type: Boolean, default: false },
  /** Force search on/off; when omitted, search appears when option count exceeds searchMinOptions */
  searchable: { type: Boolean, default: undefined },
  /** Show search when total options exceed this count (default 7) */
  searchMinOptions: { type: Number, default: 7 }
});

const { t } = useI18n();

const emit = defineEmits(['update:modelValue']);

const buttonRef = ref(null);
const searchInputRef = ref(null);
const searchQuery = ref('');
const teleportMenuStyle = ref({});
const listboxOpen = ref(false);
let listboxWasOpen = false;
let viewportListenersBound = false;

function getButtonElement() {
  const raw = buttonRef.value;
  if (!raw) return null;
  return raw.$el ?? raw;
}

function syncTeleportPosition() {
  if (!props.teleport) return;
  const el = getButtonElement();
  if (!el?.getBoundingClientRect) return;
  const rect = el.getBoundingClientRect();
  teleportMenuStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`
  };
}

function clearSearch() {
  searchQuery.value = '';
}

function syncListboxOpenState(open) {
  if (listboxWasOpen && !open) {
    clearSearch();
  }
  if (!listboxWasOpen && open && showSearch.value) {
    nextTick(() => searchInputRef.value?.focus());
  }
  listboxWasOpen = open;
  listboxOpen.value = open;
  return '';
}

function onListboxButtonClick() {
  syncTeleportPosition();
}

function onModelValueUpdate(value) {
  clearSearch();
  emit('update:modelValue', value);
}

function optionMatchesSearch(option, query) {
  const label = String(option?.label ?? '').toLowerCase();
  const value = String(option?.value ?? '').toLowerCase();
  return label.includes(query) || value.includes(query);
}

function onViewportChange() {
  if (props.teleport && listboxOpen.value) syncTeleportPosition();
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

watch(
  () => props.teleport,
  (enabled) => {
    if (enabled && listboxOpen.value) syncTeleportPosition();
  }
);

watch([listboxOpen, () => props.teleport], ([open, teleport]) => {
  if (open && teleport) {
    bindViewportListeners();
    syncTeleportPosition();
  } else {
    unbindViewportListeners();
  }
});

onBeforeUnmount(() => {
  unbindViewportListeners();
});

const hasGroups = computed(() => (props.optionGroups?.length ?? 0) > 0);

const resolvedOptions = computed(() => {
  if (hasGroups.value) {
    return props.optionGroups.flatMap((g) => g.options || []);
  }
  return props.options;
});

const showSearch = computed(() => {
  if (props.searchable != null) return props.searchable;
  return resolvedOptions.value.length > props.searchMinOptions;
});

const searchPlaceholderText = computed(() => t('common.searchPlaceholder'));
const noMatchesText = computed(() => t('records.editableNoMatches'));

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());

const filteredOptions = computed(() => {
  if (hasGroups.value) return [];
  const query = normalizedSearchQuery.value;
  if (!query) return props.options;
  return props.options.filter((opt) => optionMatchesSearch(opt, query));
});

const filteredOptionGroups = computed(() => {
  if (!hasGroups.value) return [];
  const query = normalizedSearchQuery.value;
  if (!query) return props.optionGroups;
  return props.optionGroups
    .map((group) => ({
      ...group,
      options: (group.options || []).filter((opt) => optionMatchesSearch(opt, query)),
    }))
    .filter((group) => group.options.length > 0);
});

const hasFilteredResults = computed(() => {
  if (hasGroups.value) {
    return filteredOptionGroups.value.some((group) => (group.options || []).length > 0);
  }
  return filteredOptions.value.length > 0;
});

function optionRowClass(active) {
  return [
    'relative cursor-default select-none py-2 pl-3 pr-9',
    active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
  ];
}

const isEmptyValue = computed(() => {
  const v = props.modelValue;
  return v === null || v === undefined || v === '';
});

const selectedLabel = computed(() => {
  if (isEmptyValue.value) return '';
  const opt = resolvedOptions.value.find((o) => o.value === props.modelValue);
  return opt ? opt.label : '';
});

const buttonText = computed(() => {
  if (isEmptyValue.value) {
    return props.allowEmpty ? props.emptyLabel : props.placeholder;
  }
  return selectedLabel.value || props.placeholder;
});

/** Muted styling when no concrete option is selected */
const isMutedSelection = computed(() => isEmptyValue.value || !selectedLabel.value);
</script>

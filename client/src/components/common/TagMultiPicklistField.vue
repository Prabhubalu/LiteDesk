<template>
  <div class="relative">
    <div
      :class="triggerClassList"
      @click.stop="!disabled && toggleDropdown()"
    >
      <div :class="chipRowClassList">
        <template v-if="selectedValues.length > 0">
          <span
            v-for="(selected, index) in selectedValues"
            :key="`${optionKey(selected)}-${index}`"
            :style="chipStyle(selected)"
            :class="chipClassList"
          >
            <span
              v-if="variant === 'form' && resolveChipColor(selected) && !chipStyle(selected)"
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              :style="{ backgroundColor: resolveChipColor(selected) }"
            />
            <span class="truncate">{{ displayChipLabel(selected) }}</span>
            <button
              v-if="!disabled"
              type="button"
              class="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
              :aria-label="t('actions.remove')"
              @click.stop="removeValue(selected)"
            >
              <XMarkIcon :class="variant === 'inline' ? 'h-3 w-3' : 'h-3.5 w-3.5'" />
            </button>
          </span>
        </template>
        <span
          v-else
          :class="placeholderClassList"
        >
          {{ placeholder }}
        </span>
      </div>
    </div>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showOptions && !disabled"
        v-click-outside="closeDropdown"
        class="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-h-72 flex flex-col"
        @click.stop
      >
        <div
          v-if="showSearch"
          class="shrink-0 p-2 border-b border-gray-200 dark:border-gray-600"
          @click.stop
          @mousedown.stop
        >
          <div class="relative">
            <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('common.formSearchOptions')"
              class="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-gray-100 dark:bg-gray-700 outline-1 -outline-offset-1 outline-gray-300/20 dark:outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:outline-indigo-500 text-gray-900 dark:text-white placeholder:text-gray-500 relative z-10"
              autocomplete="off"
              @keydown.escape.stop="closeDropdown"
              @click.stop
              @mousedown.stop
            />
          </div>
        </div>
        <div class="py-1 max-h-60 overflow-y-auto">
          <button
            v-for="(option, index) in filteredOptions"
            :key="`${optionKey(option)}-${index}`"
            type="button"
            class="w-full text-left px-4 py-2 text-sm transition-colors"
            :class="isSelected(option)
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 font-medium'
              : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'"
            @click.stop="toggleOption(option)"
          >
            <div class="flex items-center gap-2">
              <div
                class="flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                :class="isSelected(option)
                  ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500'
                  : 'border-gray-300 dark:border-gray-600'"
              >
                <CheckSolidIcon v-if="isSelected(option)" class="w-3 h-3 text-white" />
              </div>
              <span
                v-if="optionColor(option)"
                class="w-3 h-3 rounded-full flex-shrink-0"
                :style="{ backgroundColor: optionColor(option) }"
              />
              <span>{{ optionLabel(option) }}</span>
            </div>
          </button>
          <div
            v-if="filteredOptions.length === 0"
            class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400"
          >
            {{ t('common.formNoOptions') }}
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Transition } from 'vue';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { CheckIcon as CheckSolidIcon } from '@heroicons/vue/24/solid';
import clickOutside from '@/directives/clickOutside';
import {
  filterPicklistOptions,
  findPicklistOptionByValue,
  picklistOptionColor,
  picklistOptionKey,
  picklistOptionLabel
} from '@/utils/picklistOptionUtils';
import {
  backfillPicklistOptionColors,
  getPicklistOptionValue,
  getSemanticPicklistColor,
} from '@/utils/picklistColorPalette';
import { picklistBadgeStyle } from '@/utils/peopleParticipationPicklistColors';

const vClickOutside = clickOutside;

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  hasError: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  /** form = drawer/settings; inline = record key-field row (min height aligned with other values) */
  variant: {
    type: String,
    default: 'form',
    validator: (value) => ['form', 'inline'].includes(value),
  },
  fieldKey: { type: String, default: '' },
  moduleKey: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

const showOptions = ref(false);
const searchQuery = ref('');

const showSearch = computed(() => props.options.length > 6);

const isInline = computed(() => props.variant === 'inline');

const triggerClassList = computed(() => {
  if (isInline.value) {
    return [
      'w-full min-h-8 rounded transition-colors text-sm',
      props.disabled
        ? 'opacity-50 cursor-not-allowed'
        : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800',
      props.hasError ? 'ring-2 ring-red-500/80 ring-offset-1 dark:ring-offset-gray-900' : '',
      showOptions.value && !props.disabled ? 'ring-2 ring-indigo-500/40' : '',
    ];
  }
  return [
    'w-full rounded-md transition-all text-base sm:text-sm/6',
    props.disabled
      ? 'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed'
      : 'bg-gray-100 dark:bg-gray-700 cursor-pointer focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10',
    props.hasError ? 'outline-2 -outline-offset-2 outline-red-500 dark:outline-red-500' : '',
    showOptions.value && !props.disabled ? 'outline-2 -outline-offset-2 outline-indigo-500 dark:outline-indigo-500' : '',
  ];
});

const chipRowClassList = computed(() => (
  isInline.value
    ? 'flex flex-nowrap items-center gap-1 min-h-8 max-h-8 overflow-x-auto overflow-y-hidden'
    : 'flex flex-wrap items-center gap-2 px-3 py-2 min-h-[2.5rem]'
));

const chipClassList = computed(() => (
  isInline.value
    ? 'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium shrink-0 max-w-full'
    : 'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium shrink-0 max-w-full'
));

const placeholderClassList = computed(() => (
  isInline.value
    ? 'text-record-empty text-sm px-0.5'
    : 'text-gray-500 dark:text-gray-500 text-base sm:text-sm/6 px-2'
));

const coloredOptions = computed(() =>
  backfillPicklistOptionColors(props.options, props.fieldKey, props.moduleKey)
);

const selectedValues = computed(() => {
  const value = props.modelValue;
  if (!value) return [];
  let list;
  if (Array.isArray(value)) list = value;
  else if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        // fall through
      }
    }
    if (!list) list = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  } else {
    list = [value].filter(Boolean);
  }
  // Coerce populated user/entity objects → stable ids for model/chip keying
  return (list || [])
    .map((item) => {
      if (item != null && typeof item === 'object') {
        const id = item.value ?? item._id ?? item.id ?? item.userId;
        return id != null ? String(id) : item;
      }
      return item;
    })
    .filter((item) => item != null && String(item).trim() !== '');
});

const filteredOptions = computed(() => filterPicklistOptions(coloredOptions.value, searchQuery.value));

function optionKey(option) {
  return picklistOptionKey(option);
}

function optionLabel(option) {
  return picklistOptionLabel(option);
}

function optionColor(option) {
  return picklistOptionColor(option);
}

function displayChipLabel(selected) {
  if (selected != null && typeof selected === 'object') {
    const name = [selected.firstName ?? selected.first_name, selected.lastName ?? selected.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const fromUser = name || selected.name || selected.label || selected.email;
    if (fromUser) return String(fromUser);
  }
  const value = getPicklistOptionValue(selected);
  const match = findPicklistOptionByValue(coloredOptions.value, value);
  if (match) return optionLabel(match);
  // Prefer scalar over [object Object]
  if (selected != null && typeof selected === 'object') {
    const id = selected._id ?? selected.id ?? selected.value;
    return id != null ? String(id) : optionLabel(selected);
  }
  return optionLabel(selected);
}

function resolveChipColor(selected) {
  const value = getPicklistOptionValue(selected);
  const match = findPicklistOptionByValue(coloredOptions.value, value);
  return (
    picklistOptionColor(match)
    || getSemanticPicklistColor(props.fieldKey, value, props.moduleKey)
    || null
  );
}

function chipStyle(selected) {
  const style = picklistBadgeStyle(resolveChipColor(selected));
  return Object.keys(style).length ? style : undefined;
}

function isSelected(option) {
  const optionValue = getPicklistOptionValue(option);
  return selectedValues.value.some((selected) => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue || String(selectedValue) === String(optionValue);
  });
}

function emitValues(values) {
  emit('update:modelValue', values);
}

function toggleDropdown() {
  showOptions.value = !showOptions.value;
}

function closeDropdown() {
  if (!showOptions.value) return;
  showOptions.value = false;
  searchQuery.value = '';
}

function toggleOption(option) {
  const optionValue = getPicklistOptionValue(option);
  const current = [...selectedValues.value];
  const index = current.findIndex((selected) => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue || String(selectedValue) === String(optionValue);
  });

  if (index > -1) {
    current.splice(index, 1);
  } else {
    current.push(optionValue);
  }

  emitValues(current);
}

function removeValue(option) {
  const optionValue = getPicklistOptionValue(option);
  const current = selectedValues.value.filter((selected) => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue !== optionValue && String(selectedValue) !== String(optionValue);
  });
  emitValues(current);
}
</script>

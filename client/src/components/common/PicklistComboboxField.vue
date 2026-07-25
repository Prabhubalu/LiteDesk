<template>
  <Combobox
    :model-value="modelValue ?? ''"
    :disabled="disabled"
    nullable
    @update:model-value="onValueChange"
  >
    <div class="relative">
      <ComboboxButton
        :class="[
          'block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 sm:text-sm/6 dark:outline-white/10',
          'relative cursor-default text-left',
          disabled ? 'opacity-50 cursor-not-allowed' : 'focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:focus:outline-indigo-500',
          hasError ? 'outline-2 -outline-offset-2 outline-red-500 dark:outline-red-500' : ''
        ]"
        @click="onButtonClick"
      >
        <div class="flex items-center gap-2 pr-8">
          <span
            v-if="selectedColor"
            class="w-3 h-3 rounded-full flex-shrink-0"
            :style="{ backgroundColor: selectedColor }"
          />
          <span :class="['block truncate', !hasSelection && 'text-gray-500 dark:text-gray-500']">
            {{ selectedLabel || placeholder }}
          </span>
        </div>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
        </span>
      </ComboboxButton>

      <Transition
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
        @after-enter="focusSearchInput"
      >
        <ComboboxOptions
          class="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
        >
          <div
            v-if="showSearch"
            class="p-2 border-b border-gray-200 dark:border-gray-600"
            @click.stop
            @mousedown.stop
          >
            <div class="relative">
              <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
              <ComboboxInput
                ref="searchInputRef"
                :display-value="() => searchQuery"
                :placeholder="t('common.formSearchOptions')"
                class="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-gray-100 dark:bg-gray-700 outline-1 -outline-offset-1 outline-gray-300/20 dark:outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:outline-indigo-500 text-gray-900 dark:text-white placeholder:text-gray-500 relative z-10"
                autocomplete="off"
                @change="searchQuery = $event.target.value"
                @keydown.escape.stop
                @click.stop
                @mousedown.stop
              />
            </div>
          </div>

          <div class="max-h-60 overflow-auto py-1">
            <ComboboxOption
              v-if="allowEmpty"
              :value="''"
              v-slot="{ active, selected }"
            >
              <li
                :class="[
                  'relative cursor-default select-none py-2 pl-4 pr-10',
                  active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                ]"
              >
                <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate text-gray-500 dark:text-gray-400']">
                  {{ placeholder }}
                </span>
                <span
                  v-if="selected"
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                >
                  <CheckIcon class="h-5 w-5" aria-hidden="true" />
                </span>
              </li>
            </ComboboxOption>

            <div
              v-if="filteredOptions.length === 0"
              class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400"
            >
              {{ t('common.formNoOptions') }}
            </div>

            <ComboboxOption
              v-for="(option, index) in filteredOptions"
              :key="`${picklistOptionKey(option)}-${index}`"
              :value="picklistOptionKey(option)"
              v-slot="{ active, selected }"
            >
              <li
                :class="[
                  'relative cursor-default select-none py-2 pl-4 pr-10',
                  active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                ]"
              >
                <div class="flex items-center gap-2">
                  <span
                    v-if="picklistOptionColor(option)"
                    class="w-3 h-3 rounded-full flex-shrink-0"
                    :style="{ backgroundColor: picklistOptionColor(option) }"
                  />
                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                    {{ picklistOptionLabel(option) }}
                  </span>
                </div>
                <span
                  v-if="selected"
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                >
                  <CheckIcon class="h-5 w-5" aria-hidden="true" />
                </span>
              </li>
            </ComboboxOption>
          </div>
        </ComboboxOptions>
      </Transition>
    </div>
  </Combobox>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Transition } from 'vue';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions
} from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import {
  filterPicklistOptions,
  findPicklistOptionByValue,
  picklistOptionColor,
  picklistOptionKey,
  picklistOptionLabel
} from '@/utils/picklistOptionUtils';

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  hasError: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  allowEmpty: { type: Boolean, default: true }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

const searchQuery = ref('');
const searchInputRef = ref(null);

const showSearch = computed(() => props.options.length > 6);

const filteredOptions = computed(() => filterPicklistOptions(props.options, searchQuery.value));

const hasSelection = computed(() => String(props.modelValue ?? '').trim() !== '');

const selectedOption = computed(() => findPicklistOptionByValue(props.options, props.modelValue));

const selectedLabel = computed(() => {
  if (!hasSelection.value) return '';
  return picklistOptionLabel(selectedOption.value ?? props.modelValue);
});

const selectedColor = computed(() => picklistOptionColor(selectedOption.value));

function onValueChange(value) {
  emit('update:modelValue', value ?? '');
  searchQuery.value = '';
}

function onButtonClick() {
  if (props.disabled) return;
  searchQuery.value = '';
}

function resolveSearchInputEl(refVal) {
  if (!refVal) return null;
  if (typeof refVal.focus === 'function' && refVal.nodeType === 1) return refVal;
  const el = refVal.el ?? refVal.$el ?? null;
  if (!el) return null;
  if (typeof el.focus === 'function') return el;
  return typeof el.querySelector === 'function' ? el.querySelector('input') : null;
}

function focusSearchInput() {
  if (!showSearch.value) return;
  nextTick(() => {
    resolveSearchInputEl(searchInputRef.value)?.focus?.();
  });
}
</script>

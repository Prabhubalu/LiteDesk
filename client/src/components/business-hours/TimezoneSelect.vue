<template>
  <div class="relative">
    <label v-if="label" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ label }}</label>
    <Combobox
      :model-value="modelValue"
      nullable
      @update:model-value="$emit('update:modelValue', $event || 'UTC')"
    >
      <div class="relative">
        <ComboboxButton
          class="relative w-full cursor-default rounded-lg bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left text-sm text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <span class="block truncate">{{ modelValue || resolvedPlaceholder }}</span>
          <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
          </span>
        </ComboboxButton>

        <Transition
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
          @after-enter="focusSearch"
        >
          <ComboboxOptions
            class="absolute z-50 mt-1 w-full overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-sm shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none"
          >
            <div class="p-2 border-b border-gray-200 dark:border-gray-700" @click.stop @mousedown.stop>
              <div class="relative">
                <MagnifyingGlassIcon
                  class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
                />
                <input
                  ref="searchInputRef"
                  v-model="searchQuery"
                  type="search"
                  :placeholder="t('settings.settingsBhTzSearchPh')"
                  autocomplete="off"
                  class="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  @keydown.enter.stop
                  @keydown.escape.stop
                  @click.stop
                  @mousedown.stop
                />
              </div>
            </div>

            <div class="max-h-60 overflow-auto py-1">
              <template v-if="filteredOptions.length">
                <template v-for="(group, groupName) in groupedFiltered" :key="groupName">
                  <div
                    v-if="groupName"
                    class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    {{ translateGroup(groupName) }}
                  </div>
                  <ComboboxOption
                    v-for="opt in group"
                    :key="opt.value"
                    :value="opt.value"
                    v-slot="{ active, selected }"
                  >
                    <li
                      :class="[
                        'relative cursor-default select-none py-2 pl-3 pr-9',
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100'
                          : 'text-gray-900 dark:text-gray-100'
                      ]"
                    >
                      <span :class="['block truncate', selected ? 'font-semibold' : 'font-normal']">
                        {{ opt.label }}
                      </span>
                      <span
                        v-if="selected"
                        class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                      >
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ComboboxOption>
                </template>
              </template>
              <p v-else class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                {{ t('settings.settingsBhTzNoMatch') }}
              </p>
            </div>
          </ComboboxOptions>
        </Transition>
      </div>
    </Combobox>
    <p v-if="showLiveClock" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
      {{ t('settings.settingsBhTzNowInZone', { time: liveTime }) }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Combobox,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption
} from '@headlessui/vue';
import { ChevronUpDownIcon, MagnifyingGlassIcon, CheckIcon } from '@heroicons/vue/24/outline';
import { buildTimezonePickerOptions, formatTimeInZone } from '@/utils/ianaTimezones';

const props = defineProps({
  modelValue: { type: String, default: 'UTC' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  showLiveClock: { type: Boolean, default: true }
});

defineEmits(['update:modelValue']);

const { t } = useI18n();

const resolvedPlaceholder = computed(
  () => props.placeholder || t('settings.settingsBhTzSelectPh')
);

const searchQuery = ref('');
const searchInputRef = ref(null);

const GROUP_KEYS = {
  'Current selection': 'settingsBhTzGroupCurrent',
  Popular: 'settingsBhTzGroupPopular',
  Other: 'settingsBhTzGroupOther'
};

function translateGroup(name) {
  const key = GROUP_KEYS[name];
  return key ? t(`settings.${key}`) : name;
}

const allOptions = computed(() => buildTimezonePickerOptions(props.modelValue));

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allOptions.value;
  return allOptions.value.filter(
    (opt) =>
      opt.label.toLowerCase().includes(q) ||
      opt.group.toLowerCase().includes(q) ||
      opt.value.toLowerCase().replace(/_/g, ' ').includes(q)
  );
});

const groupedFiltered = computed(() => {
  const groups = {};
  const order = [
    'Current selection',
    'UTC',
    'Popular',
    'Africa',
    'America',
    'Asia',
    'Europe',
    'Pacific',
    'Other'
  ];
  for (const opt of filteredOptions.value) {
    const key = opt.group || 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(opt);
  }
  const sorted = {};
  for (const key of order) {
    if (groups[key]?.length) sorted[key] = groups[key];
  }
  for (const key of Object.keys(groups)) {
    if (!sorted[key]) sorted[key] = groups[key];
  }
  return sorted;
});

const liveTime = computed(() => formatTimeInZone(props.modelValue || 'UTC'));

function focusSearch() {
  nextTick(() => searchInputRef.value?.focus());
}

watch(
  () => props.modelValue,
  () => {
    searchQuery.value = '';
  }
);
</script>

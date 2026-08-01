<template>
  <Popover v-slot="{ open, close }" class="relative w-full">
    <input
      type="hidden"
      tabindex="-1"
      aria-hidden="true"
      :value="syncPopoverOpen(open)"
    />
    <PopoverButton
      ref="triggerRef"
      :id="id"
      :disabled="disabled"
      type="button"
      :class="[
        inputClass,
        'relative w-full cursor-pointer text-left flex items-center gap-2 pr-9',
        disabled ? 'opacity-60 cursor-not-allowed' : '',
        invalid ? 'border-red-500 dark:border-red-500' : '',
      ]"
      :aria-label="t('common.datePickerSelectDate')"
      @keydown.esc.stop="$emit('escape')"
      @keydown.enter.prevent="$emit('enter')"
    >
      <span
        :class="[
          'block truncate flex-1 min-w-0',
          modelValue ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500',
        ]"
      >
        {{ displayText }}
      </span>
      <CalendarDaysIcon
        class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
        aria-hidden="true"
      />
    </PopoverButton>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-1 scale-95"
    >
      <PopoverPanel
        :class="[
          'absolute left-0 top-full mt-1.5 w-[min(100vw-2rem,18.5rem)] origin-top-left rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10',
          panelClass || 'z-50',
        ]"
        @keydown.esc.stop="close(); $emit('escape')"
      >
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between gap-1">
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            :aria-label="t('common.datePickerPrevMonth')"
            @click="prevMonth"
          >
            <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
          </button>

          <div class="flex min-w-0 flex-1 items-center justify-center gap-1">
            <Listbox :model-value="viewMonth" @update:model-value="setViewMonth">
              <div class="relative">
                <ListboxButton
                  class="rounded-md px-2 py-1 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                >
                  {{ monthLabel }}
                </ListboxButton>
                <Transition
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0"
                >
                  <ListboxOptions
                    class="absolute left-1/2 z-10 mt-1 max-h-48 w-36 -translate-x-1/2 overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 dark:bg-gray-700 dark:ring-white/10"
                  >
                    <ListboxOption
                      v-for="(label, index) in monthLabels"
                      :key="label"
                      :value="index"
                      v-slot="{ active, selected }"
                    >
                      <li
                        :class="[
                          'cursor-default select-none px-3 py-1.5',
                          active ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100',
                          selected ? 'font-semibold' : 'font-normal',
                        ]"
                      >
                        {{ label }}
                      </li>
                    </ListboxOption>
                  </ListboxOptions>
                </Transition>
              </div>
            </Listbox>

            <Listbox :model-value="viewYear" @update:model-value="setViewYear">
              <div class="relative">
                <ListboxButton
                  class="rounded-md px-2 py-1 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                >
                  {{ viewYear }}
                </ListboxButton>
                <Transition
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0"
                >
                  <ListboxOptions
                    class="absolute left-1/2 z-10 mt-1 max-h-48 w-24 -translate-x-1/2 overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 dark:bg-gray-700 dark:ring-white/10"
                  >
                    <ListboxOption
                      v-for="year in yearOptions"
                      :key="year"
                      :value="year"
                      v-slot="{ active, selected }"
                    >
                      <li
                        :class="[
                          'cursor-default select-none px-3 py-1.5',
                          active ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100',
                          selected ? 'font-semibold' : 'font-normal',
                        ]"
                      >
                        {{ year }}
                      </li>
                    </ListboxOption>
                  </ListboxOptions>
                </Transition>
              </div>
            </Listbox>
          </div>

          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            :aria-label="t('common.datePickerNextMonth')"
            @click="nextMonth"
          >
            <ChevronRightIcon class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <!-- Weekday headers -->
        <div class="mb-1 grid grid-cols-7 gap-0.5">
          <span
            v-for="(label, index) in weekdayLabels"
            :key="`${label}-${index}`"
            class="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500"
          >
            {{ label }}
          </span>
        </div>

        <!-- Day grid -->
        <div class="grid grid-cols-7 gap-0.5">
          <button
            v-for="day in calendarDays"
            :key="day.iso"
            type="button"
            :disabled="isDateDisabled(day.iso)"
            :class="[
              'relative flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors',
              isDateDisabled(day.iso)
                ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                : day.isSelected
                  ? 'bg-indigo-600 font-semibold text-white shadow-sm hover:bg-indigo-500'
                  : day.isToday
                    ? 'font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-500/60 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20'
                    : day.isCurrentMonth
                      ? 'text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700'
                      : 'text-gray-300 hover:bg-gray-50 dark:text-gray-600 dark:hover:bg-gray-700/50',
            ]"
            @click="!isDateDisabled(day.iso) && selectDate(day.iso, close)"
          >
            {{ day.date.getDate() }}
          </button>
        </div>

        <!-- Footer -->
        <div class="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            @click="clearDate(close)"
          >
            {{ t('common.listClear') }}
          </button>
          <button
            type="button"
            :disabled="isTodayDisabled"
            :class="[
              'rounded-md px-2 py-1 text-sm font-medium transition-colors',
              isTodayDisabled
                ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20',
            ]"
            @click="!isTodayDisabled && selectToday(close)"
          >
            {{ t('common.datePickerToday') }}
          </button>
        </div>
      </PopoverPanel>
    </Transition>
  </Popover>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/vue';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline';
import { formatDate, formatUserDate, getLocaleFormatContext } from '@/utils/localeFormat';
import {
  buildCalendarGrid,
  normalizeDateInput,
  parseIsoDate,
  toIsoDate,
} from '@/utils/datePickerUtils';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  id: {
    type: String,
    default: undefined,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  invalid: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: undefined,
  },
  inputClass: {
    type: String,
    default:
      'h-8 px-2 py-1 text-sm border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
  },
  panelClass: {
    type: String,
    default: '',
  },
  min: {
    type: String,
    default: undefined,
  },
  max: {
    type: String,
    default: undefined,
  },
});

const emit = defineEmits(['update:modelValue', 'blur', 'escape', 'enter']);

const { t, locale } = useI18n();

const userTimeZone = computed(() => getLocaleFormatContext().timeZone || 'UTC');

const popoverWasOpen = ref(false);

function syncPopoverOpen(open) {
  if (popoverWasOpen.value && !open) {
    emit('blur');
  }
  popoverWasOpen.value = open;
  return open ? '1' : '0';
}

const triggerRef = ref(null);
const viewYear = ref(new Date().getFullYear());
const viewMonth = ref(new Date().getMonth());

const normalizedValue = computed(() => normalizeDateInput(props.modelValue));

const displayText = computed(() => {
  if (!normalizedValue.value) {
    return props.placeholder ?? t('common.datePickerPlaceholder');
  }
  return formatUserDate(normalizedValue.value) || normalizedValue.value;
});

const monthLabels = computed(() =>
  Array.from({ length: 12 }, (_, index) =>
    formatDate(
      new Date(2024, index, 1),
      { month: 'long', timeZone: userTimeZone.value },
      { locale: locale.value, timeZone: userTimeZone.value }
    )
  )
);

const monthLabel = computed(() => monthLabels.value[viewMonth.value] ?? '');

const weekdayLabels = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' });
  const base = new Date(2024, 0, 7); // Sunday
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return formatter.format(date);
  });
});

const yearOptions = computed(() => {
  const current = new Date().getFullYear();
  const start = current - 100;
  const end = current + 20;
  const years = [];
  for (let year = end; year >= start; year -= 1) {
    years.push(year);
  }
  return years;
});

const calendarDays = computed(() =>
  buildCalendarGrid(viewYear.value, viewMonth.value, normalizedValue.value)
);

function isDateDisabled(iso) {
  if (props.min && iso < props.min) return true;
  if (props.max && iso > props.max) return true;
  return false;
}

const todayIso = computed(() => toIsoDate(new Date()));
const isTodayDisabled = computed(() => isDateDisabled(todayIso.value));

function syncViewToValue() {
  const parsed = parseIsoDate(normalizedValue.value);
  const anchor = parsed ?? new Date();
  viewYear.value = anchor.getFullYear();
  viewMonth.value = anchor.getMonth();
}

watch(normalizedValue, syncViewToValue, { immediate: true });

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value -= 1;
  } else {
    viewMonth.value -= 1;
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value += 1;
  } else {
    viewMonth.value += 1;
  }
}

function setViewMonth(month) {
  viewMonth.value = month;
}

function setViewYear(year) {
  viewYear.value = year;
}

function selectDate(iso, close) {
  emit('update:modelValue', iso);
  close();
  emit('blur');
}

function clearDate(close) {
  emit('update:modelValue', '');
  close();
  emit('blur');
}

function selectToday(close) {
  const today = new Date();
  emit('update:modelValue', toIsoDate(today));
  viewYear.value = today.getFullYear();
  viewMonth.value = today.getMonth();
  close();
  emit('blur');
}

function focus() {
  const el = triggerRef.value?.$el ?? triggerRef.value;
  el?.focus?.({ preventScroll: true });
}

function open() {
  const el = triggerRef.value?.$el ?? triggerRef.value;
  el?.click?.();
}

defineExpose({ focus, open });
</script>

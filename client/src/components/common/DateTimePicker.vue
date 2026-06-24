<template>
  <Popover v-slot="{ close }" class="relative w-full">
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
      :aria-label="t('common.dateTimePickerSelectDateTime')"
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
      <ClockIcon
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
          'absolute left-0 top-full mt-1.5 w-[min(100vw-2rem,22rem)] origin-top-left rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10',
          panelClass || 'z-50',
        ]"
        @keydown.esc.stop="close(); $emit('escape')"
      >
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

        <div class="mb-1 grid grid-cols-7 gap-0.5">
          <span
            v-for="(label, index) in weekdayLabels"
            :key="`${label}-${index}`"
            class="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500"
          >
            {{ label }}
          </span>
        </div>

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
                : draftDate === day.iso
                  ? 'bg-indigo-600 font-semibold text-white shadow-sm hover:bg-indigo-500'
                  : day.isToday
                    ? 'font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-500/60 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20'
                    : day.isCurrentMonth
                      ? 'text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700'
                      : 'text-gray-300 hover:bg-gray-50 dark:text-gray-600 dark:hover:bg-gray-700/50',
            ]"
            @click="!isDateDisabled(day.iso) && selectDraftDate(day.iso)"
          >
            {{ day.date.getDate() }}
          </button>
        </div>

        <div class="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
          <p class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ t('common.dateTimePickerTime') }}
          </p>
          <div class="flex items-center gap-2">
            <HeadlessSelect
              v-model="draftHour12"
              :options="hour12SelectOptions"
              :searchable="false"
              teleport
              :truncate-button-label="false"
              :button-class="TIME_SELECT_BUTTON_CLASS"
              :options-class="TIME_SELECT_OPTIONS_CLASS"
              wrapper-class="min-w-[4.5rem] flex-1"
            />
            <span class="shrink-0 text-gray-400">:</span>
            <HeadlessSelect
              v-model="draftMinute"
              :options="minuteSelectOptions"
              :searchable="false"
              teleport
              :truncate-button-label="false"
              :button-class="TIME_SELECT_BUTTON_CLASS"
              :options-class="TIME_SELECT_OPTIONS_CLASS"
              wrapper-class="min-w-[4.5rem] flex-1"
            />
            <HeadlessSelect
              v-model="draftPeriod"
              :options="periodSelectOptions"
              :searchable="false"
              teleport
              :truncate-button-label="false"
              :button-class="TIME_SELECT_BUTTON_CLASS"
              :options-class="TIME_SELECT_OPTIONS_CLASS"
              wrapper-class="min-w-[5rem] flex-1"
            />
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            @click="clearDateTime(close)"
          >
            {{ t('common.listClear') }}
          </button>
          <div class="flex items-center gap-1">
            <button
              type="button"
              :disabled="isNowDisabled"
              :class="[
                'rounded-md px-2 py-1 text-sm font-medium transition-colors',
                isNowDisabled
                  ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                  : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20',
              ]"
              @click="!isNowDisabled && selectNow()"
            >
              {{ t('common.dateTimePickerNow') }}
            </button>
            <button
              type="button"
              :disabled="!canApply"
              class="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              @click="canApply && applyDateTime(close)"
            >
              {{ t('actions.apply') }}
            </button>
          </div>
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
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from '@heroicons/vue/24/outline';
import { formatDate } from '@/utils/localeFormat';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import {
  buildCalendarGrid,
  isDateTimeLocalDisabled,
  normalizeDateTimeInput,
  parseDateTimeLocal,
  splitDateTimeLocal,
  toDateTimeLocal,
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

const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const triggerRef = ref(null);
const viewYear = ref(new Date().getFullYear());
const viewMonth = ref(new Date().getMonth());
const draftDate = ref(toIsoDate(new Date()));
const draftHour = ref(0);
const draftMinute = ref(0);

const normalizedValue = computed(() => normalizeDateTimeInput(props.modelValue));

const displayText = computed(() => {
  if (!normalizedValue.value) {
    return props.placeholder ?? t('common.dateTimePickerPlaceholder');
  }
  const parsed = parseDateTimeLocal(normalizedValue.value);
  if (!parsed) return normalizedValue.value;
  return formatDate(
    parsed,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: localTimeZone,
    },
    { locale: locale.value }
  );
});

const monthLabels = computed(() =>
  Array.from({ length: 12 }, (_, index) =>
    formatDate(
      new Date(2024, index, 1),
      { month: 'long', timeZone: localTimeZone },
      { locale: locale.value }
    )
  )
);

const monthLabel = computed(() => monthLabels.value[viewMonth.value] ?? '');

const weekdayLabels = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' });
  const base = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return formatter.format(date);
  });
});

const yearOptions = computed(() => {
  const current = new Date().getFullYear();
  const years = [];
  for (let year = current + 20; year >= current - 100; year -= 1) {
    years.push(year);
  }
  return years;
});

const calendarDays = computed(() => buildCalendarGrid(viewYear.value, viewMonth.value, draftDate.value));

const hour12Options = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const minuteOptions = computed(() => Array.from({ length: 60 }, (_, index) => index));

const TIME_SELECT_BUTTON_CLASS =
  'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm tabular-nums text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
const TIME_SELECT_OPTIONS_CLASS = 'z-[10060]';

function toHour12(hour24) {
  const hour = hour24 % 12;
  return hour === 0 ? 12 : hour;
}

function toHour24(hour12, period) {
  if (period === 'AM') {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
}

const draftHour12 = computed({
  get: () => toHour12(draftHour.value),
  set: (hour12) => {
    draftHour.value = toHour24(hour12, draftPeriod.value);
  },
});

const draftPeriod = computed({
  get: () => (draftHour.value >= 12 ? 'PM' : 'AM'),
  set: (period) => {
    draftHour.value = toHour24(draftHour12.value, period);
  },
});

const draftDateTime = computed(() =>
  `${draftDate.value}T${pad2(draftHour.value)}:${pad2(draftMinute.value)}`
);

const canApply = computed(() =>
  Boolean(draftDate.value) && !isDateTimeLocalDisabled(draftDateTime.value, props.min, props.max)
);

const nowDateTime = computed(() => toDateTimeLocal(new Date()));
const isNowDisabled = computed(() =>
  isDateTimeLocalDisabled(nowDateTime.value, props.min, props.max)
);

function pad2(value) {
  return String(value).padStart(2, '0');
}

function minDatePart() {
  return props.min?.split('T')[0] ?? null;
}

function maxDatePart() {
  return props.max?.split('T')[0] ?? null;
}

function isDateDisabled(iso) {
  if (minDatePart() && iso < minDatePart()) return true;
  if (maxDatePart() && iso > maxDatePart()) return true;
  return false;
}

function timeBoundsForDraftDate() {
  let minHour = 0;
  let minMinute = 0;
  let maxHour = 23;
  let maxMinute = 59;

  if (props.min?.startsWith(`${draftDate.value}T`)) {
    const time = props.min.split('T')[1] ?? '00:00';
    const [hour, minute] = time.split(':').map(Number);
    minHour = hour ?? 0;
    minMinute = minute ?? 0;
  }

  if (props.max?.startsWith(`${draftDate.value}T`)) {
    const time = props.max.split('T')[1] ?? '23:59';
    const [hour, minute] = time.split(':').map(Number);
    maxHour = hour ?? 23;
    maxMinute = minute ?? 59;
  }

  return { minHour, minMinute, maxHour, maxMinute };
}

function isHourEnabled(hour) {
  const { minHour, minMinute, maxHour, maxMinute } = timeBoundsForDraftDate();
  if (hour < minHour || hour > maxHour) return false;
  if (hour === minHour && minMinute > 59) return false;
  if (hour === maxHour && maxMinute < 0) return false;
  return minuteOptions.value.some((minute) => isMinuteEnabledForHour(hour, minute));
}

function isHour12Enabled(hour12) {
  return isHourEnabled(toHour24(hour12, draftPeriod.value));
}

function isPeriodEnabled(period) {
  return isHourEnabled(toHour24(draftHour12.value, period));
}

function isMinuteEnabledForHour(hour, minute) {
  const candidate = `${draftDate.value}T${pad2(hour)}:${pad2(minute)}`;
  return !isDateTimeLocalDisabled(candidate, props.min, props.max);
}

function isMinuteEnabled(minute) {
  return isMinuteEnabledForHour(draftHour.value, minute);
}

const hour12SelectOptions = computed(() =>
  hour12Options
    .filter((hour) => isHour12Enabled(hour))
    .map((hour) => ({ value: hour, label: String(hour) }))
);

const minuteSelectOptions = computed(() =>
  minuteOptions.value
    .filter((minute) => isMinuteEnabled(minute))
    .map((minute) => ({ value: minute, label: pad2(minute) }))
);

const periodSelectOptions = computed(() => {
  const options = [];
  if (isPeriodEnabled('AM')) {
    options.push({ value: 'AM', label: t('common.dateTimePickerAm') });
  }
  if (isPeriodEnabled('PM')) {
    options.push({ value: 'PM', label: t('common.dateTimePickerPm') });
  }
  return options;
});

function syncDraftFromValue() {
  const parts = splitDateTimeLocal(normalizedValue.value);
  draftDate.value = parts.date;
  draftHour.value = parts.hour;
  draftMinute.value = parts.minute;
  const parsed = parseDateTimeLocal(`${parts.date}T${pad2(parts.hour)}:${pad2(parts.minute)}`);
  const anchor = parsed ?? new Date();
  viewYear.value = anchor.getFullYear();
  viewMonth.value = anchor.getMonth();
}

watch(normalizedValue, syncDraftFromValue, { immediate: true });

watch([draftDate, draftHour], () => {
  if (!isMinuteEnabled(draftMinute.value)) {
    const next = minuteOptions.value.find((minute) => isMinuteEnabled(minute));
    if (next !== undefined) draftMinute.value = next;
  }
  if (!isHour12Enabled(draftHour12.value)) {
    const next = hour12Options.find((hour) => isHour12Enabled(hour));
    if (next !== undefined) draftHour12.value = next;
  }
  if (!isPeriodEnabled(draftPeriod.value)) {
    const next = ['AM', 'PM'].find((period) => isPeriodEnabled(period));
    if (next) draftPeriod.value = next;
  }
});

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

function selectDraftDate(iso) {
  draftDate.value = iso;
}

function selectNow() {
  const now = new Date();
  draftDate.value = toIsoDate(now);
  draftHour.value = now.getHours();
  draftMinute.value = now.getMinutes();
  viewYear.value = now.getFullYear();
  viewMonth.value = now.getMonth();
}

function applyDateTime(close) {
  if (!canApply.value) return;
  emit('update:modelValue', draftDateTime.value);
  close();
  emit('blur');
}

function clearDateTime(close) {
  emit('update:modelValue', '');
  close();
  emit('blur');
}

function focus() {
  const el = triggerRef.value?.$el ?? triggerRef.value;
  el?.focus?.({ preventScroll: true });
}

function open() {
  syncDraftFromValue();
  const el = triggerRef.value?.$el ?? triggerRef.value;
  el?.click?.();
}

defineExpose({ focus, open });
</script>

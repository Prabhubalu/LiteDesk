<template>
  <div class="relative">
    <Popover v-slot="{ open }" class="relative">
      <span v-show="false" aria-hidden="true">{{ syncOpenState(open) }}</span>
      <PopoverButton
        ref="buttonRef"
        :class="buttonClass"
        class="cursor-pointer relative w-full text-left leading-none"
        @click="onButtonClick"
      >
        <span
          class="block truncate font-normal"
          :class="[
            placeholderOverride && !displayLabel
              ? 'pr-0 text-gray-400 dark:text-gray-500'
              : 'pr-6 text-gray-900 dark:text-gray-100'
          ]"
        >
          {{ displayLabel || placeholderOverride || filterAllLabel }}
        </span>
        <span
          v-if="!placeholderOverride"
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
        >
          <ChevronUpDownIcon class="h-4 w-4 text-gray-400" aria-hidden="true" />
        </span>
      </PopoverButton>

      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <Teleport to="body" :disabled="!teleportOptions">
          <PopoverPanel
            v-if="!teleportOptions || open"
            ref="panelRef"
            :class="optionsClass"
            :style="teleportOptions ? teleportMenuStyle : { zIndex: '9999' }"
            @vue:before-mount="syncTeleportPosition"
          >
          <!-- Option list -->
          <button
            type="button"
            :class="[
              'relative cursor-default select-none py-2 pl-4 pr-10 w-full text-left',
              !selectedOption ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600/50'
            ]"
            @click="onSelectOption(null)"
          >
            <span :class="[!selectedOption ? 'font-medium' : 'font-normal', 'block truncate']">
              {{ filterAllLabel }}
            </span>
            <span
              v-if="!selectedOption"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
            >
              <CheckIcon class="h-5 w-5" aria-hidden="true" />
            </span>
          </button>

          <template v-for="group in DATE_FILTER_OPTION_GROUPS" :key="group.label">
            <div class="sticky top-0 z-10 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
              {{ group.label }}
            </div>
            <button
              v-for="option in group.options"
              :key="option.value"
              type="button"
              :class="[
                'relative cursor-default select-none py-2 pl-4 pr-10 w-full text-left',
                isOptionSelected(option) ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600/50'
              ]"
              @click="onSelectOption(option)"
            >
              <span :class="[isOptionSelected(option) ? 'font-medium' : 'font-normal', 'block truncate']">
                {{ option.label }}
              </span>
              <span
                v-if="isOptionSelected(option)"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
              >
                <CheckIcon class="h-5 w-5" aria-hidden="true" />
              </span>
            </button>
          </template>

          <!-- Date/days inputs in popover when Relative or Specific option is selected -->
          <div
            ref="inputSectionRef"
            v-if="showDaysInput || showSingleDateInput || showBetweenInputs"
            class="px-3 py-3 mt-1 border-t border-gray-200 dark:border-gray-600 space-y-3"
          >
            <div v-if="showDaysInput">
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('common.filterDays') }}</label>
              <input
                v-model.number="daysInput"
                type="number"
                min="1"
                max="365"
                class="block w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                :placeholder="t('common.filterDaysPlaceholder')"
                @change="applyDaysInput"
              />
            </div>
            <div v-if="showSingleDateInput">
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('common.filterDate') }}</label>
              <DatePicker
                v-model="singleDateInput"
                panel-class="z-[10001]"
                input-class="block w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                @blur="applySingleDateInput"
              />
            </div>
            <div v-if="showBetweenInputs" class="space-y-2">
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('common.filterFrom') }}</label>
                <DatePicker
                  v-model="fromDateInput"
                  panel-class="z-[10001]"
                  input-class="block w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  @blur="applyBetweenInput"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('common.filterTo') }}</label>
                <DatePicker
                  v-model="toDateInput"
                  panel-class="z-[10001]"
                  input-class="block w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  @blur="applyBetweenInput"
                />
              </div>
            </div>
          </div>
          </PopoverPanel>
        </Teleport>
      </Transition>
    </Popover>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { resolveFilterAllLabel } from '@/platform/filters/filterAllLabelResolver';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/vue/24/outline';
import {
  DATE_FILTER_OPTION_GROUPS,
  parseDateFilterValue,
  getDateFilterLabel
} from '@/utils/dateFilterOptions';
import DatePicker from '@/components/common/DatePicker.vue';

const props = defineProps({
  modelValue: {
    type: [Object, String],
    default: null
  },
  filterKey: {
    type: String,
    default: ''
  },
  filterLabel: {
    type: String,
    default: ''
  },
  buttonClass: {
    type: String,
    default: 'inline-flex h-10 items-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500 cursor-pointer relative w-auto min-w-[140px] text-left'
  },
  optionsClass: {
    type: String,
    default: 'absolute mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm min-w-[200px]'
  },
  placeholderOverride: {
    type: String,
    default: ''
  },
  teleportOptions: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'opened']);

const filterAllLabel = computed(() => {
  if (!props.filterKey && !props.filterLabel) {
    return t('common.filterAll');
  }
  return resolveFilterAllLabel(
    { key: props.filterKey || props.filterLabel, label: props.filterLabel },
    t,
    'common.filterAllNamed'
  );
});

const buttonRef = ref(null);
const teleportMenuStyle = ref({});
const popoverOpen = ref(false);
let viewportListenersBound = false;

function getButtonElement() {
  const raw = buttonRef.value;
  if (!raw) return null;
  return raw.$el ?? raw;
}

function syncTeleportPosition() {
  if (!props.teleportOptions) return;
  const el = getButtonElement();
  if (!el?.getBoundingClientRect) return;
  const rect = el.getBoundingClientRect();
  teleportMenuStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 256)}px`,
  };
}

function syncOpenState(open) {
  popoverOpen.value = open;
  return '';
}

function onButtonClick() {
  syncTeleportPosition();
  emit('opened');
}

function onViewportChange() {
  if (props.teleportOptions && popoverOpen.value) syncTeleportPosition();
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

watch([popoverOpen, () => props.teleportOptions], ([open, teleport]) => {
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

const parsed = computed(() => parseDateFilterValue(props.modelValue));
const displayLabel = computed(() => getDateFilterLabel(parsed.value));

function findOptionByValue(parsedVal) {
  if (!parsedVal) return null;
  if (parsedVal.preset) {
    return DATE_FILTER_OPTION_GROUPS.flatMap(g => g.options).find(o => o.value === `preset:${parsedVal.preset}`) ?? null;
  }
  if (parsedVal.op) {
    return DATE_FILTER_OPTION_GROUPS.flatMap(g => g.options).find(o => o.value === `op:${parsedVal.op}`) ?? null;
  }
  return null;
}

const selectedOption = computed(() => findOptionByValue(parsed.value));

const panelRef = ref(null);
const inputSectionRef = ref(null);

function scrollToInputSection() {
  nextTick(() => {
    nextTick(() => {
      const panel = panelRef.value;
      const inputSection = inputSectionRef.value;
      if (panel && typeof panel.scrollTop !== 'undefined' && panel.scrollHeight > panel.clientHeight) {
        panel.scrollTop = panel.scrollHeight;
      } else if (inputSection) {
        inputSection.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  });
}

function isOptionSelected(option) {
  const sel = selectedOption.value;
  if (!sel) return false;
  return sel.value === option.value;
}

const daysInput = ref(parsed.value?.op === 'lastDays' || parsed.value?.op === 'nextDays' ? parsed.value.days ?? 7 : 7);
const singleDateInput = ref(parsed.value?.date ?? '');
const fromDateInput = ref(parsed.value?.from ?? '');
const toDateInput = ref(parsed.value?.to ?? '');

function getCurrentOptionFromParsed(v) {
  if (!v) return null;
  if (v.preset) return { preset: v.preset };
  if (v.op) return { op: v.op, needsInput: v.op === 'lastDays' || v.op === 'nextDays' ? 'days' : v.op === 'between' ? 'between' : ['on', 'before', 'after'].includes(v.op) ? 'date' : null };
  return null;
}
const currentOption = ref(getCurrentOptionFromParsed(parsed.value));
const showDaysInput = computed(() => {
  const o = currentOption.value;
  return o?.needsInput === 'days' || (o?.op && (o.op === 'lastDays' || o.op === 'nextDays'));
});
const showSingleDateInput = computed(() => {
  const o = currentOption.value;
  return o?.needsInput === 'date' || (o?.op && ['on', 'before', 'after'].includes(o.op));
});
const showBetweenInputs = computed(() => {
  const o = currentOption.value;
  return o?.needsInput === 'between' || o?.op === 'between';
});

watch(parsed, (v) => {
  currentOption.value = getCurrentOptionFromParsed(v);
  if (v?.days != null) daysInput.value = v.days;
  if (v?.date) singleDateInput.value = v.date.slice(0, 10);
  if (v?.from) fromDateInput.value = v.from.slice(0, 10);
  if (v?.to) toDateInput.value = v.to.slice(0, 10);
}, { immediate: true });

function onSelectOption(option) {
  if (!option) {
    currentOption.value = null;
    emit('update:modelValue', null);
    return;
  }
  if (option.value?.startsWith('preset:')) {
    const preset = option.value.replace('preset:', '');
    currentOption.value = { preset };
    emit('update:modelValue', { preset });
    return;
  }
  if (option.value === 'op:empty') {
    currentOption.value = { op: 'empty' };
    emit('update:modelValue', { op: 'empty' });
    return;
  }
  if (option.value === 'op:notEmpty') {
    currentOption.value = { op: 'notEmpty' };
    emit('update:modelValue', { op: 'notEmpty' });
    return;
  }
  if (option.value === 'op:lastDays') {
    currentOption.value = { op: 'lastDays', needsInput: 'days' };
    const days = daysInput.value && daysInput.value >= 1 ? Number(daysInput.value) : 7;
    emit('update:modelValue', { op: 'lastDays', days });
    scrollToInputSection();
    return;
  }
  if (option.value === 'op:nextDays') {
    currentOption.value = { op: 'nextDays', needsInput: 'days' };
    const days = daysInput.value && daysInput.value >= 1 ? Number(daysInput.value) : 7;
    emit('update:modelValue', { op: 'nextDays', days });
    scrollToInputSection();
    return;
  }
  if (option.value === 'op:on' || option.value === 'op:before' || option.value === 'op:after') {
    const op = option.value.replace('op:', '');
    currentOption.value = { op, needsInput: 'date' };
    const date = singleDateInput.value ? new Date(singleDateInput.value).toISOString() : undefined;
    if (date) emit('update:modelValue', { op, date });
    scrollToInputSection();
    return;
  }
  if (option.value === 'op:between') {
    currentOption.value = { op: 'between', needsInput: 'between' };
    const from = fromDateInput.value ? new Date(fromDateInput.value).toISOString() : undefined;
    const to = toDateInput.value ? new Date(toDateInput.value + 'T23:59:59.999Z').toISOString() : undefined;
    if (from && to) emit('update:modelValue', { op: 'between', from, to });
    scrollToInputSection();
    return;
  }
  currentOption.value = option;
}

function applyDaysInput() {
  const o = currentOption.value;
  if (!o || (o.op !== 'lastDays' && o.op !== 'nextDays')) return;
  const days = daysInput.value && daysInput.value >= 1 ? Number(daysInput.value) : 7;
  emit('update:modelValue', { op: o.op, days });
}

function applySingleDateInput() {
  const o = currentOption.value;
  if (!o || !['on', 'before', 'after'].includes(o.op)) return;
  const date = singleDateInput.value ? new Date(singleDateInput.value).toISOString() : undefined;
  if (date) emit('update:modelValue', { op: o.op, date });
}

function applyBetweenInput() {
  const o = currentOption.value;
  if (!o || o.op !== 'between') return;
  const from = fromDateInput.value ? new Date(fromDateInput.value).toISOString() : undefined;
  const to = toDateInput.value ? new Date(toDateInput.value + 'T23:59:59.999Z').toISOString() : undefined;
  if (from && to) emit('update:modelValue', { op: 'between', from, to });
}
</script>

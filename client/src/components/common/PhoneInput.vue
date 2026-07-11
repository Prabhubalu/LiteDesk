<template>
  <Popover v-if="popover" v-slot="{ open, close }" class="relative w-full min-w-0">
    <input
      type="hidden"
      tabindex="-1"
      aria-hidden="true"
      :value="syncPopoverOpen(open, close)"
    />
    <PopoverButton
      ref="triggerRef"
      :id="id"
      :disabled="disabled"
      type="button"
      :class="[
        triggerClass || inputClass,
        'relative w-full min-h-8 cursor-pointer text-left flex items-center',
        minimalTrigger ? 'gap-0 border-0 bg-transparent shadow-none focus:outline-none focus:ring-0' : 'gap-2 pr-9',
        disabled ? 'opacity-60 cursor-not-allowed' : '',
        !minimalTrigger && invalid ? 'border-red-500 dark:border-red-500' : '',
        minimalTrigger && invalid ? 'ring-2 ring-red-500/80 ring-offset-1 dark:ring-offset-gray-900 rounded' : '',
      ]"
      @keydown.esc.stop="handlePopoverCancel(close)"
    >
      <span
        :class="[
          'block truncate flex-1 min-w-0',
          displayIsEmpty && minimalTrigger
            ? 'text-record-empty'
            : displayIsEmpty
              ? 'text-gray-400 dark:text-gray-500'
              : 'text-gray-900 dark:text-white',
        ]"
      >
        {{ displayText }}
      </span>
      <DevicePhoneMobileIcon
        v-if="!minimalTrigger"
        class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
        aria-hidden="true"
      />
    </PopoverButton>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-1 scale-95"
      >
        <PopoverPanel
          v-if="open"
          ref="panelRef"
          :style="panelStyle"
          :class="[
            'fixed origin-top-left rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10',
            panelClass || 'z-[120]',
          ]"
          @keydown.esc.stop="handlePopoverCancel(close)"
        >
          <PhoneInput
            ref="innerRef"
            :model-value="modelValue"
            :name="name"
            :placeholder="placeholder"
            :required="required"
            :disabled="disabled"
            :invalid="invalid"
            :default-country="defaultCountry"
            :input-class="inputClass"
            :editor-height-class="editorHeightClass"
            @update:model-value="$emit('update:modelValue', $event)"
            @enter="handlePopoverCommit(close)"
            @escape="handlePopoverCancel(close)"
          />
        </PopoverPanel>
      </Transition>
    </Teleport>
  </Popover>

  <div v-else :class="inlineWrapperClass">
    <Listbox
      v-slot="{ open: countryOpen }"
      :model-value="selectedCountry.iso2"
      :disabled="disabled"
      @update:model-value="handleCountryChange"
    >
      <div class="relative h-full flex-shrink-0">
        <ListboxButton
          ref="countryButtonRef"
          :class="countryButtonClass"
          :title="`${selectedCountry.name} +${selectedCountry.dialCode}`"
          @mousedown.prevent
          @click.stop="syncCountryListAfterToggle"
        >
          <span class="font-medium">{{ selectedCountry.iso2 }}</span>
          <span class="text-gray-500 dark:text-gray-400">+{{ selectedCountry.dialCode }}</span>
          <ChevronUpDownIcon class="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
        </ListboxButton>
      </div>

      <Transition
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <ListboxOptions
          v-if="countryOpen"
          ref="countryOptionsRef"
          :style="countryListPanelStyle"
          class="fixed z-[120] mt-0 max-h-72 w-72 overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-gray-700 dark:ring-white/10"
        >
          <ListboxOption
            v-for="country in PHONE_COUNTRIES"
            :key="country.iso2"
            :value="country.iso2"
            v-slot="{ active, selected }"
          >
            <li
              :class="[
                'relative cursor-default select-none py-2 pl-3 pr-9',
                active ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
              ]"
            >
              <div class="flex min-w-0 items-center justify-between gap-3">
                <span class="truncate">{{ country.name }}</span>
                <span class="flex-shrink-0 text-gray-500 dark:text-gray-400">+{{ country.dialCode }}</span>
              </div>
              <span
                v-if="selected"
                class="absolute inset-y-0 right-0 flex items-center pr-2 text-indigo-600 dark:text-indigo-400"
              >
                <CheckIcon class="h-4 w-4" aria-hidden="true" />
              </span>
            </li>
          </ListboxOption>
        </ListboxOptions>
      </Transition>
    </Listbox>

    <div class="min-w-0 h-full flex-1">
      <input
        ref="inputRef"
        :id="id"
        :name="name"
        :value="nationalNumber"
        type="text"
        inputmode="numeric"
        autocomplete="tel-national"
        :maxlength="maxNationalLength"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :class="[
          inputClass,
          numberInputHeightClass,
          'rounded-l-none box-border',
          invalid ? 'border-red-500 dark:border-red-500' : ''
        ]"
        @input="handleNumberInput"
        @keydown="preventNonDigitPhoneKeys"
        @blur="handleInlineBlur"
        @keydown.enter.prevent="handleInlineEnter"
        @keydown.esc="$emit('escape')"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useAnchoredPanelPosition } from '@/composables/useAnchoredPanelPosition';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon, DevicePhoneMobileIcon } from '@heroicons/vue/24/outline';
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  formatPhoneValue,
  getPhoneCountry,
  parsePhoneValue,
  preventNonDigitPhoneKeys,
  sanitizePhoneDigits,
} from '@/utils/phoneInput';

const props = defineProps({
  modelValue: {
    type: [String, Number, null],
    default: '',
  },
  id: {
    type: String,
    default: undefined,
  },
  name: {
    type: String,
    default: undefined,
  },
  placeholder: {
    type: String,
    default: 'Phone number',
  },
  required: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  invalid: {
    type: Boolean,
    default: false,
  },
  defaultCountry: {
    type: String,
    default: DEFAULT_PHONE_COUNTRY,
  },
  inputClass: {
    type: String,
    default:
      'block w-full min-w-0 rounded-md border border-gray-300/60 bg-gray-100 px-3 py-2 text-base text-gray-900 outline-none placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:bg-gray-800 dark:focus:outline-indigo-500 sm:text-sm',
  },
  /** Compact trigger + panel editor for narrow row layouts (e.g. key fields). */
  popover: {
    type: Boolean,
    default: false,
  },
  triggerClass: {
    type: String,
    default: undefined,
  },
  panelClass: {
    type: String,
    default: '',
  },
  /** Row-style trigger: no border/icon, matches inline display fields. */
  minimalTrigger: {
    type: Boolean,
    default: false,
  },
  /** Fixed height for compact layouts (e.g. h-8). Omit for standard form field height. */
  editorHeightClass: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:modelValue', 'blur', 'enter', 'escape']);

const { t } = useI18n();

const inputRef = ref(null);
const triggerRef = ref(null);
const innerRef = ref(null);
const panelRef = ref(null);
const countryButtonRef = ref(null);
const countryOptionsRef = ref(null);
const popoverWasOpen = ref(false);
const countryListWasOpen = ref(false);
const skipNextCountryBlur = ref(false);
const popoverCloseFn = ref(null);
const skipNextBlurCommit = ref(false);
const { panelStyle, refresh, close: closePanelPosition, openAt } = useAnchoredPanelPosition({ panelWidth: 320 });
const {
  panelStyle: countryListPanelStyle,
  openAt: openCountryList,
  close: closeCountryList,
  refresh: refreshCountryList,
} = useAnchoredPanelPosition({ panelWidth: 288, panelHeight: 288 });
const selectedCountry = ref(getPhoneCountry(props.defaultCountry));
const nationalNumber = ref('');

/** Matches DynamicForm lookup/combobox controls (h-[2.5rem]). */
const FORM_FIELD_HEIGHT_CLASS = 'h-[2.5rem]';

const isCompactEditor = computed(() => Boolean(props.editorHeightClass));

const inlineWrapperClass = computed(() => [
  'flex w-full min-w-0 items-center',
  isCompactEditor.value ? props.editorHeightClass : FORM_FIELD_HEIGHT_CLASS,
]);

const numberInputHeightClass = computed(() => (
  isCompactEditor.value ? props.editorHeightClass : 'h-full'
));

const countryButtonClass = computed(() => {
  const typographyClass = isCompactEditor.value ? 'text-sm' : 'text-base sm:text-sm/6';
  const shared = [
    'flex shrink-0 items-center gap-1 rounded-l-md bg-gray-100 px-2 text-left text-gray-900 transition-colors dark:bg-gray-700 dark:text-white',
    typographyClass,
    props.disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-800',
  ];

  if (isCompactEditor.value) {
    return [
      ...shared,
      'border border-r-0 outline-none',
      props.editorHeightClass,
      props.invalid ? 'border-red-500 dark:border-red-500' : 'border-gray-300/60 dark:border-gray-600',
    ];
  }

  return [
    ...shared,
    'h-full outline-1 -outline-offset-1 outline-gray-300/20 dark:outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800',
    props.invalid ? 'border border-red-500 dark:border-red-500' : '',
  ];
});

const displayText = computed(() => {
  const raw = props.modelValue;
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return props.minimalTrigger ? '—' : props.placeholder;
  }
  return String(raw);
});

const displayIsEmpty = computed(() => {
  const raw = props.modelValue;
  return raw === null || raw === undefined || String(raw).trim() === '';
});

function resolveCountryOptionsElement() {
  return countryOptionsRef.value?.$el ?? countryOptionsRef.value;
}

function isCountryListVisible() {
  const el = resolveCountryOptionsElement();
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function onCountryListOpened() {
  countryListWasOpen.value = true;
  nextTick(() => {
    openCountryList(countryButtonRef, countryOptionsRef);
    requestAnimationFrame(() => refreshCountryList());
  });
}

function onCountryListClosed() {
  countryListWasOpen.value = false;
  closeCountryList();
}

function syncCountryListAfterToggle() {
  window.setTimeout(() => {
    if (isCountryListVisible()) {
      if (!countryListWasOpen.value) {
        onCountryListOpened();
      } else {
        refreshCountryList();
      }
      return;
    }
    if (countryListWasOpen.value) {
      onCountryListClosed();
    }
  }, 0);
}

function syncPopoverOpen(open, close) {
  popoverCloseFn.value = close;
  if (popoverWasOpen.value && !open) {
    closePanelPosition();
    detachOutsideListener();
    if (!skipNextBlurCommit.value) {
      emit('blur');
    } else {
      skipNextBlurCommit.value = false;
    }
  }
  if (open && !popoverWasOpen.value) {
    attachOutsideListener();
    nextTick(() => {
      openAt(triggerRef, panelRef);
      requestAnimationFrame(() => {
        refresh();
        innerRef.value?.focus?.({ preventScroll: true });
      });
    });
  }
  popoverWasOpen.value = open;
  return open ? '1' : '0';
}

function resolvePanelElement() {
  return panelRef.value?.$el ?? panelRef.value;
}

function resolveTriggerElement() {
  return triggerRef.value?.$el ?? triggerRef.value;
}

function isHeadlessMenuSurface(target) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('[role="listbox"]')
    || target.closest('[data-headlessui-state]')
  );
}

function handleOutsidePointer(event) {
  if (!popoverWasOpen.value) return;
  const target = event?.target;
  if (!(target instanceof HTMLElement)) return;
  const panel = resolvePanelElement();
  const trigger = resolveTriggerElement();
  if (panel?.contains(target) || trigger?.contains(target)) return;
  if (isHeadlessMenuSurface(target)) return;
  handlePopoverCommit(popoverCloseFn.value);
}

function attachOutsideListener() {
  document.addEventListener('mousedown', handleOutsidePointer, true);
}

function detachOutsideListener() {
  document.removeEventListener('mousedown', handleOutsidePointer, true);
}

function handlePopoverCommit(close) {
  if (typeof close === 'function') {
    close();
  } else {
    popoverCloseFn.value?.();
  }
}

function handlePopoverCancel(close) {
  skipNextBlurCommit.value = true;
  emit('escape');
  handlePopoverCommit(close);
}

function handleInlineBlur() {
  if (props.popover) return;
  window.setTimeout(() => {
    if (countryListWasOpen.value || skipNextCountryBlur.value) return;
    emit('blur');
  }, 0);
}

function handleInlineEnter() {
  emit('enter');
}

watch(countryOptionsRef, () => {
  if (countryListWasOpen.value) refreshCountryList();
});

watch(panelRef, () => {
  if (popoverWasOpen.value) refresh();
});

onUnmounted(() => {
  detachOutsideListener();
  closePanelPosition();
  closeCountryList();
});

const maxNationalLength = computed(() => {
  const e164LocalLimit = Math.max(0, 15 - selectedCountry.value.dialCode.length);
  return Math.min(selectedCountry.value.maxLength || e164LocalLimit, e164LocalLimit);
});

function syncFromValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    nationalNumber.value = '';
    return;
  }
  const parsed = parsePhoneValue(value, props.defaultCountry);
  selectedCountry.value = parsed.country;
  nationalNumber.value = sanitizePhoneDigits(parsed.nationalNumber, maxNationalLength.value);
}

function emitValue() {
  emit('update:modelValue', formatPhoneValue(selectedCountry.value, nationalNumber.value));
}

function handleCountryChange(iso2) {
  skipNextCountryBlur.value = true;
  selectedCountry.value = getPhoneCountry(iso2);
  nationalNumber.value = sanitizePhoneDigits(nationalNumber.value, maxNationalLength.value);
  emitValue();
  countryListWasOpen.value = false;
  closeCountryList();
  nextTick(() => {
    inputRef.value?.focus?.();
    window.setTimeout(() => {
      skipNextCountryBlur.value = false;
    }, 50);
  });
}

function handleNumberInput(event) {
  nationalNumber.value = sanitizePhoneDigits(event?.target?.value ?? '', maxNationalLength.value);
  if (event?.target) {
    event.target.value = nationalNumber.value;
  }
  emitValue();
}

watch(
  () => props.modelValue,
  (value) => {
    syncFromValue(value);
  },
  { immediate: true }
);

watch(
  () => props.defaultCountry,
  (country) => {
    if (!props.modelValue) {
      selectedCountry.value = getPhoneCountry(country);
    }
  }
);

function focusTrigger(options) {
  const el = triggerRef.value?.$el ?? triggerRef.value;
  el?.focus?.(options);
}

function openPopover() {
  const el = triggerRef.value?.$el ?? triggerRef.value;
  el?.click?.();
}

defineExpose({
  focus: (options) => {
    if (props.popover) {
      focusTrigger(options);
      return;
    }
    inputRef.value?.focus?.(options);
  },
  open: () => {
    if (props.popover) {
      openPopover();
    }
  },
  select: () => {
    if (!props.popover) {
      inputRef.value?.select?.();
    }
  },
  refreshPosition: refresh,
});
</script>

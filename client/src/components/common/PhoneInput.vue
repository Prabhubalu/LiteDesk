<template>
  <div class="flex w-full min-w-0">
    <Listbox
      :model-value="selectedCountry.iso2"
      :disabled="disabled"
      @update:model-value="handleCountryChange"
    >
      <div class="relative flex-shrink-0">
        <ListboxButton
          :class="[
            'flex h-full min-h-[2.25rem] items-center gap-1 rounded-l-md border border-r-0 bg-gray-100 px-2 text-left text-sm text-gray-900 outline-none transition-colors dark:bg-gray-700 dark:text-white',
            disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-800',
            invalid ? 'border-red-500 dark:border-red-500' : 'border-gray-300/60 dark:border-gray-600'
          ]"
          :title="`${selectedCountry.name} +${selectedCountry.dialCode}`"
        >
          <span class="font-medium">{{ selectedCountry.iso2 }}</span>
          <span class="text-gray-500 dark:text-gray-400">+{{ selectedCountry.dialCode }}</span>
          <ChevronUpDownIcon class="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
        </ListboxButton>

        <Transition
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="absolute left-0 z-30 mt-1 max-h-72 w-72 overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-gray-700 dark:ring-white/10"
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
      </div>
    </Listbox>

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
        'rounded-l-none',
        invalid ? 'border-red-500 dark:border-red-500' : ''
      ]"
      @input="handleNumberInput"
      @keydown="preventNonDigitPhoneKeys"
      @blur="$emit('blur')"
      @keydown.enter="$emit('enter')"
      @keydown.esc="$emit('escape')"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, ref, watch } from 'vue';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/24/outline';
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
});

const emit = defineEmits(['update:modelValue', 'blur', 'enter', 'escape']);

const { t } = useI18n();

const inputRef = ref(null);
const selectedCountry = ref(getPhoneCountry(props.defaultCountry));
const nationalNumber = ref('');

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
  selectedCountry.value = getPhoneCountry(iso2);
  nationalNumber.value = sanitizePhoneDigits(nationalNumber.value, maxNationalLength.value);
  emitValue();
  inputRef.value?.focus?.();
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

defineExpose({
  focus: (options) => inputRef.value?.focus?.(options),
  select: () => inputRef.value?.select?.(),
});
</script>

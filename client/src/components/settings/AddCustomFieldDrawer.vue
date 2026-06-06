<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="handleClose">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300 sm:duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300 sm:duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <div class="pointer-events-auto h-full flex">
                <DialogPanel
                  class="flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl max-w-[95vw] w-[30rem] transition-[width] duration-200 ease-out"
                >
                  <form @submit.prevent="handleSave" class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700">
                    <!-- Header: matches CreateRecordDrawer / TaskEditDrawer -->
                    <div class="bg-indigo-700 dark:bg-indigo-800 px-4 py-6 sm:px-6 flex-shrink-0">
                      <div class="flex items-center justify-between">
                        <DialogTitle class="text-base font-semibold text-white">{{ t('settings.modFieldsAddCustomField') }}</DialogTitle>
                        <button
                          type="button"
                          class="relative rounded-md text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
                          @click="handleClose"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                      <p class="mt-1 text-sm text-indigo-300">{{ t('settings.settingsAddFieldSubtitle') }}</p>
                    </div>

                    <!-- Body: scrollable, matches record drawer -->
                    <div class="h-0 flex-1 overflow-y-auto">
                      <div class="px-4 sm:px-6 py-6 space-y-6">
                        <div class="space-y-1">
                          <label for="add-field-label" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsLabel') }}</label>
                          <input
                            id="add-field-label"
                            v-model="draft.label"
                            type="text"
                            :placeholder="t('settings.settingsAddFieldLabelPh')"
                            required
                            class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                          />
                        </div>
                        <div class="space-y-1">
                          <label for="add-field-key" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsKey') }}</label>
                          <input
                            id="add-field-key"
                            v-model="draft.key"
                            type="text"
                            :placeholder="t('settings.settingsAddFieldKeyPh')"
                            class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                          />
                          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.settingsAddFieldKeyHint') }}</p>
                        </div>
                        <div class="space-y-1">
                          <label for="add-field-type" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsType') }}</label>
                          <HeadlessSelect
                            id="add-field-type"
                            v-model="draft.dataType"
                            :options="fieldTypeOptions"
                          />
                        </div>
                        <div v-if="draft.dataType === 'Currency'" class="space-y-1">
                          <label for="add-field-currency" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsCurrencyFormat') }}</label>
                          <HeadlessSelect
                            id="add-field-currency"
                            v-model="draft.currencyCode"
                            :options="currencySelectOptions"
                          />
                          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {{ t('settings.settingsAddFieldCurrencyHint', { code: draft.currencyCode || 'USD' }) }}
                          </p>
                        </div>
                        <div
                          v-if="isPicklistFieldType"
                          class="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3"
                        >
                          <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                            {{ picklistOptionsSectionLabel }}
                          </label>
                          <div
                            v-if="!draft.options.length"
                            class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-lg p-3 text-center"
                          >
                            {{ t('settings.modFieldsNoOptionsDefined') }}
                          </div>
                          <ul v-else class="space-y-2">
                            <li
                              v-for="(option, optionIdx) in draft.options"
                              :key="`${option.value}-${optionIdx}`"
                              class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10"
                            >
                              <input
                                type="color"
                                :value="option.color"
                                class="h-7 w-9 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800"
                                :aria-label="t('settings.modFieldsColorForOption', { label: option.value })"
                                @input="updatePicklistOptionColor(optionIdx, $event.target.value)"
                              />
                              <span class="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white truncate">
                                {{ option.value }}
                              </span>
                              <span
                                class="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                :style="{ backgroundColor: option.color }"
                              >
                                {{ option.value }}
                              </span>
                              <button
                                type="button"
                                class="shrink-0 p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 rounded cursor-pointer"
                                :title="t('actions.remove')"
                                @click="removePicklistOption(optionIdx)"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </li>
                          </ul>
                          <div class="space-y-2">
                            <label for="add-field-option-value" class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                              {{ t('settings.modFieldsOptionValue') }}
                            </label>
                            <div class="flex items-center gap-2">
                              <input
                                id="add-field-option-value"
                                v-model="newOptionValue"
                                type="text"
                                :placeholder="t('settings.modFieldsEnterOptionValuePh')"
                                class="flex-1 min-w-0 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                                @keyup.enter.prevent="addPicklistOption"
                              />
                              <input
                                type="color"
                                v-model="newOptionColor"
                                class="h-9 w-11 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800"
                                :aria-label="t('settings.modFieldsColor')"
                              />
                              <button
                                type="button"
                                class="shrink-0 rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                :disabled="!newOptionValue.trim()"
                                @click="addPicklistOption"
                              >
                                {{ t('settings.modFieldsAddOption') }}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div class="flex items-center gap-6 pt-2">
                          <label class="inline-flex items-center gap-2 cursor-pointer">
                            <HeadlessCheckbox
                              v-model="draft.required"
                              checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span class="text-sm text-gray-900 dark:text-white">{{ t('settings.modFieldsRequiredInForm') }}</span>
                          </label>
                        </div>
                        <div
                          v-if="showAppParticipationScope && appScopeOptions.length"
                          class="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3"
                        >
                          <div>
                            <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsFieldScope') }}</label>
                            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {{ t('settings.modFieldsFieldScopeHelp') }}
                            </p>
                          </div>
                          <div class="flex flex-col gap-2">
                            <label class="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                v-model="draft.participationScope"
                                type="radio"
                                value="core"
                                class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                              />
                              <span class="text-sm text-gray-900 dark:text-white">{{ t('settings.modFieldsScopeCoreShared') }}</span>
                            </label>
                            <label class="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                v-model="draft.participationScope"
                                type="radio"
                                value="app"
                                class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                              />
                              <span class="text-sm text-gray-900 dark:text-white">{{ t('settings.modFieldsScopeAppSpecific') }}</span>
                            </label>
                          </div>
                          <div v-if="draft.participationScope === 'app'" class="space-y-1">
                            <label for="add-field-app-scope" class="block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.modFieldsApplication') }}</label>
                            <HeadlessSelect
                              id="add-field-app-scope"
                              v-model="draft.appContextToken"
                              :options="appScopeSelectOptions"
                            />
                          </div>
                        </div>
                        <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <label class="block text-sm/6 font-medium text-gray-900 dark:text-white mb-3">{{ t('settings.modFieldsDepVisibility') }}</label>
                          <div class="flex flex-col gap-2">
                            <label class="inline-flex items-center gap-2 cursor-pointer">
                              <HeadlessCheckbox
                                v-model="draft.visibility.list"
                                checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span class="text-sm text-gray-900 dark:text-white">{{ t('settings.settingsAddFieldShowInList') }}</span>
                            </label>
                            <label class="inline-flex items-center gap-2 cursor-pointer">
                              <HeadlessCheckbox
                                v-model="draft.visibility.detail"
                                checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span class="text-sm text-gray-900 dark:text-white">{{ t('settings.modFieldsShowInDetail') }}</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Footer: matches CreateRecordDrawer / TaskEditDrawer -->
                    <div class="flex shrink-0 flex items-center justify-between gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <span />
                      <div class="flex gap-3">
                        <button
                          type="button"
                          class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          @click="handleClose"
                        >
                          {{ t('actions.cancel') }}
                        </button>
                        <button
                          type="submit"
                          class="rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer"
                        >
                          {{ t('settings.settingsAddFieldAddField') }}
                        </button>
                      </div>
                    </div>
                  </form>
                </DialogPanel>
              </div>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY_CODE,
  getCurrencySymbolFromCode,
} from '@/utils/currencyOptions';

const { t } = useI18n();

const FIELD_TYPES = [
  'Text',
  'Text-Area',
  'Rich Text',
  'Integer',
  'Decimal',
  'Currency',
  'Date',
  'Date-Time',
  'Picklist',
  'Multi-Picklist',
  'Checkbox',
  'Radio Button',
  'Email',
  'Phone',
  'URL',
  'Image',
  'Auto-Number',
  'Lookup (Relationship)',
  'Formula',
  'Rollup Summary',
];

const PICKLIST_FIELD_TYPES = ['Picklist', 'Multi-Picklist', 'Radio Button'];
const DEFAULT_OPTION_COLOR = '#3B82F6';

const PICKLIST_OPTIONS_SECTION_I18N = {
  Picklist: 'modFieldsPicklistOptions',
  'Multi-Picklist': 'modFieldsPicklistOptionsMulti',
  'Radio Button': 'modFieldsPicklistOptionsRadio',
};

const FIELD_TYPE_I18N = {
  Text: 'settingsAddFieldTypeText',
  'Text-Area': 'settingsAddFieldTypeTextArea',
  'Rich Text': 'settingsAddFieldTypeRichText',
  Integer: 'settingsAddFieldTypeInteger',
  Decimal: 'settingsAddFieldTypeDecimal',
  Currency: 'settingsAddFieldTypeCurrency',
  Date: 'settingsAddFieldTypeDate',
  'Date-Time': 'settingsAddFieldTypeDateTime',
  Picklist: 'settingsAddFieldTypePicklist',
  'Multi-Picklist': 'settingsAddFieldTypeMultiPicklist',
  Checkbox: 'settingsAddFieldTypeCheckbox',
  'Radio Button': 'settingsAddFieldTypeRadioButton',
  Email: 'settingsAddFieldTypeEmail',
  Phone: 'settingsAddFieldTypePhone',
  URL: 'settingsAddFieldTypeUrl',
  Image: 'settingsAddFieldTypeImage',
  'Auto-Number': 'settingsAddFieldTypeAutoNumber',
  'Lookup (Relationship)': 'settingsAddFieldTypeLookup',
  Formula: 'settingsAddFieldTypeFormula',
  'Rollup Summary': 'settingsAddFieldTypeRollupSummary',
};

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  moduleName: { type: String, default: '' },
  nextOrder: { type: Number, default: 0 },
  /** When true and appScopeOptions non-empty, show Core vs App-specific scope (shared core modules). */
  showAppParticipationScope: { type: Boolean, default: false },
  /** { value: lowercase app token e.g. 'sales', label: 'Sales' } */
  appScopeOptions: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'save']);

const fieldTypeOptions = computed(() =>
  FIELD_TYPES.map((value) => ({
    value,
    label: t(`settings.${FIELD_TYPE_I18N[value]}`),
  }))
);
const currencySelectOptions = computed(() =>
  CURRENCY_OPTIONS.map((currency) => ({
    value: currency.code,
    label: `${currency.code} - ${currency.name}`,
  }))
);

const appScopeSelectOptions = computed(() =>
  (props.appScopeOptions || []).map((o) => ({ value: o.value, label: o.label || o.value }))
);

const createEmptyDraft = () => {
  const opts = appScopeSelectOptions.value;
  const firstApp = opts[0]?.value || 'sales';
  return {
    key: '',
    label: '',
    dataType: 'Text',
    required: false,
    options: [],
    defaultValue: null,
    index: false,
    visibility: { list: true, detail: true },
    order: props.nextOrder,
    owner: 'org',
    participationScope: 'core',
    appContextToken: firstApp,
    currencyCode: DEFAULT_CURRENCY_CODE,
  };
};

const draft = ref(createEmptyDraft());
const newOptionValue = ref('');
const newOptionColor = ref(DEFAULT_OPTION_COLOR);

const isPicklistFieldType = computed(() => PICKLIST_FIELD_TYPES.includes(draft.value.dataType));

const picklistOptionsSectionLabel = computed(() => {
  const key = PICKLIST_OPTIONS_SECTION_I18N[draft.value.dataType] || 'modFieldsPicklistOptions';
  return t(`settings.${key}`);
});

function resetPicklistOptionDraft() {
  newOptionValue.value = '';
  newOptionColor.value = DEFAULT_OPTION_COLOR;
}

function addPicklistOption() {
  const value = newOptionValue.value.trim();
  if (!value) return;
  const existingValues = (draft.value.options || []).map((opt) => String(opt?.value || '').trim());
  if (existingValues.includes(value)) return;
  draft.value.options = [
    ...(draft.value.options || []),
    { value, color: newOptionColor.value || DEFAULT_OPTION_COLOR },
  ];
  resetPicklistOptionDraft();
}

function removePicklistOption(index) {
  if (!Array.isArray(draft.value.options)) return;
  draft.value.options = draft.value.options.filter((_, idx) => idx !== index);
}

function updatePicklistOptionColor(index, color) {
  if (!Array.isArray(draft.value.options) || !draft.value.options[index]) return;
  draft.value.options[index] = { ...draft.value.options[index], color };
}

function labelToKey(label) {
  if (!label || typeof label !== 'string') return '';
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 80) || '';
}

watch(() => props.isOpen, (open) => {
  if (open) {
    draft.value = createEmptyDraft();
    draft.value.order = props.nextOrder;
    resetPicklistOptionDraft();
  }
});

watch(() => draft.value.dataType, (dataType, previousType) => {
  if (PICKLIST_FIELD_TYPES.includes(previousType) && !PICKLIST_FIELD_TYPES.includes(dataType)) {
    draft.value.options = [];
  }
  if (PICKLIST_FIELD_TYPES.includes(dataType)) {
    resetPicklistOptionDraft();
  }
});

watch(
  appScopeSelectOptions,
  (opts) => {
    if (!props.isOpen || !opts.length) return;
    if (!opts.some((o) => o.value === draft.value.appContextToken)) {
      draft.value.appContextToken = opts[0].value;
    }
  },
  { deep: true }
);

watch(() => draft.value.label, (label) => {
  if (props.isOpen && label) {
    draft.value.key = labelToKey(label);
  }
});

const handleClose = () => emit('close');

const handleSave = () => {
  if (!draft.value.label?.trim()) return;
  const key = draft.value.key?.trim() || labelToKey(draft.value.label);
  if (!key) return;
  const showScope = props.showAppParticipationScope && appScopeSelectOptions.value.length > 0;
  const participationScope = showScope ? draft.value.participationScope : 'core';
  const appToken =
    participationScope === 'app' && appScopeSelectOptions.value.length
      ? String(draft.value.appContextToken || appScopeSelectOptions.value[0].value).toLowerCase()
      : null;
  if (showScope && participationScope === 'app' && !appToken) return;

  const { participationScope: _ps, appContextToken: _at, currencyCode, ...rest } = draft.value;
  const options = isPicklistFieldType.value
    ? (draft.value.options || []).map((opt) => ({
        value: String(opt?.value || '').trim(),
        color: opt?.color || DEFAULT_OPTION_COLOR,
      })).filter((opt) => opt.value)
    : [];
  const nextField = {
    ...rest,
    key,
    label: draft.value.label.trim(),
    owner: 'org',
    options,
    context:
      showScope && participationScope === 'app' && appToken
        ? appToken
        : 'global',
  };
  if (draft.value.dataType === 'Currency') {
    const nextCurrencyCode = String(currencyCode || DEFAULT_CURRENCY_CODE).toUpperCase();
    nextField.numberSettings = {
      ...nextField.numberSettings,
      decimalPlaces: 2,
      currencyCode: nextCurrencyCode,
      currencySymbol: getCurrencySymbolFromCode(nextCurrencyCode),
    };
  }
  emit('save', {
    ...nextField,
  });
};
</script>

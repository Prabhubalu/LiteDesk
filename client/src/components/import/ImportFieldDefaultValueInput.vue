<template>
  <div v-if="!field" class="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">—</div>

  <HeadlessSelect
    v-else-if="isPicklistField"
    :model-value="modelValue ?? ''"
    :options="picklistOptions"
    allow-empty
    :empty-label="t('import.importDefaultValueNone')"
    teleport
    :disabled="disabled"
    button-class="!w-full !px-3 !py-2 !text-sm !bg-white dark:!bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-lg !shadow-none"
    options-class="z-[10050]"
    @update:model-value="emitValue"
  />

  <HeadlessSelect
    v-else-if="isUserLookupField"
    :model-value="modelValue ?? ''"
    :options="userLookupOptions"
    allow-empty
    :empty-label="t('import.importDefaultValueNone')"
    teleport
    :disabled="disabled || usersLoading"
    button-class="!w-full !px-3 !py-2 !text-sm !bg-white dark:!bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-lg !shadow-none"
    options-class="z-[10050]"
    @update:model-value="emitValue"
  />

  <HeadlessCheckbox
    v-else-if="field.dataType === 'Checkbox'"
    :model-value="modelValue === true || modelValue === 'true'"
    :disabled="disabled"
    checkbox-class="mt-2"
    @update:model-value="emitValue($event)"
  />

  <input
    v-else-if="isNumberField"
    :value="modelValue ?? ''"
    type="number"
    :step="numberStep"
    :disabled="disabled"
    :placeholder="t('import.importDefaultValuePlaceholder')"
    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
    @input="emitValue($event.target.value === '' ? '' : Number($event.target.value))"
  />

  <input
    v-else-if="field.dataType === 'Date'"
    :value="dateInputValue"
    type="date"
    :disabled="disabled"
    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
    @input="emitValue($event.target.value)"
  />

  <input
    v-else-if="field.dataType === 'Date-Time'"
    :value="dateTimeInputValue"
    type="datetime-local"
    :disabled="disabled"
    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
    @input="emitValue($event.target.value)"
  />

  <input
    v-else-if="field.dataType === 'Multi-Picklist'"
    :value="modelValue ?? ''"
    type="text"
    :disabled="disabled"
    :placeholder="t('import.importDefaultValueMultiPicklistPlaceholder')"
    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
    @input="emitValue($event.target.value)"
  />

  <div
    v-else-if="isUnsupportedLookupField"
    class="px-3 py-2 text-xs text-gray-400 dark:text-gray-500"
    :title="t('import.importDefaultValueUnsupportedHint')"
  >
    —
  </div>

  <input
    v-else
    :value="modelValue ?? ''"
    :type="textInputType"
    :disabled="disabled"
    :placeholder="t('import.importDefaultValuePlaceholder')"
    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
    @input="emitValue($event.target.value)"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { localizeSelectOptions } from '@/utils/configurableLabelResolver';
import { fetchUsersListCached } from '@/utils/recordLookupCache';

const USER_LOOKUP_KEYS = new Set([
  'assignedto',
  'assigned_to',
  'ownerid',
  'owner_id',
  'assignedto',
  'assignedto',
  'accountmanager',
  'account_manager',
  'lead_owner',
]);

const props = defineProps({
  field: {
    type: Object,
    default: null,
  },
  modelValue: {
    type: [String, Number, Boolean],
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);

const { t, te } = useI18n();

const NUMBER_TYPES = new Set(['Number', 'Currency', 'Decimal', 'Integer', 'Percent']);

function normalizeDataType(field) {
  return String(field?.dataType || '').trim().toLowerCase();
}

function isUserLookupImportField(field) {
  if (!field) return false;
  if (String(field.lookupSettings?.targetModule || '').toLowerCase() === 'users') return true;
  const key = String(field.key || '').toLowerCase();
  if (USER_LOOKUP_KEYS.has(key)) return true;
  const dataType = normalizeDataType(field);
  return dataType === 'user' || dataType === 'users';
}

const isPicklistField = computed(() => {
  const dataType = normalizeDataType(props.field);
  return dataType === 'picklist' || dataType === 'radio button';
});

const isUserLookupField = computed(() => isUserLookupImportField(props.field));

const isUnsupportedLookupField = computed(() => {
  const dataType = normalizeDataType(props.field);
  return dataType === 'lookup (relationship)' || dataType === 'auto-number';
});

const isNumberField = computed(() => NUMBER_TYPES.has(props.field?.dataType));

const usersLoading = ref(false);
const userLookupOptions = ref([]);

function getUserDisplayName(user) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const altName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || altName || user.name || user.username || user.email || String(user._id || '');
}

async function loadUserLookupOptions() {
  if (!isUserLookupField.value) {
    userLookupOptions.value = [];
    return;
  }
  usersLoading.value = true;
  try {
    const response = await fetchUsersListCached({ limit: 500 });
    userLookupOptions.value = response?.success && Array.isArray(response.data)
      ? response.data
        .filter((user) => user?._id)
        .map((user) => ({
          value: String(user._id),
          label: getUserDisplayName(user),
        }))
      : [];
  } catch {
    userLookupOptions.value = [];
  } finally {
    usersLoading.value = false;
  }
}

watch(() => props.field?.key, loadUserLookupOptions, { immediate: true });

const numberStep = computed(() => {
  if (props.field?.dataType === 'Integer') return '1';
  if (props.field?.dataType === 'Percent') return '0.01';
  return 'any';
});

const textInputType = computed(() => {
  const dataType = props.field?.dataType;
  if (dataType === 'Email') return 'email';
  if (dataType === 'Phone') return 'tel';
  if (dataType === 'URL') return 'url';
  return 'text';
});

const picklistOptions = computed(() => {
  const options = Array.isArray(props.field?.options) ? props.field.options : [];
  return localizeSelectOptions(options, t, te).map((option) => {
    const value = typeof option === 'object' && option !== null
      ? String(option.value ?? option.label ?? '')
      : String(option);
    const label = typeof option === 'object' && option !== null
      ? String(option.label ?? option.value ?? '')
      : String(option);
    return { value, label };
  });
});

const dateInputValue = computed(() => {
  if (!props.modelValue) return '';
  const raw = String(props.modelValue);
  return raw.includes('T') ? raw.split('T')[0] : raw;
});

const dateTimeInputValue = computed(() => {
  if (!props.modelValue) return '';
  const raw = String(props.modelValue);
  if (raw.includes('T') && !raw.endsWith('Z')) return raw.slice(0, 16);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
});

function emitValue(value) {
  emit('update:modelValue', value);
}
</script>

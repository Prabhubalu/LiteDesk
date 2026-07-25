<template>
  <div class="flex gap-2 w-full items-stretch">
    <HeadlessSelect
      :id="salutationId"
      :model-value="salutation || ''"
      :options="salutationSelectOptions"
      :disabled="disabled"
      :invalid="invalid"
      :placeholder="t('people.salutationPlaceholder')"
      allow-empty
      :empty-label="t('people.salutationPlaceholder')"
      button-class="!w-[6.5rem] shrink-0"
      wrapper-class="shrink-0"
      @update:model-value="onSalutationChange"
    />
    <input
      :id="firstNameId"
      :name="firstNameId"
      type="text"
      :value="firstName"
      :placeholder="firstNamePlaceholder"
      :required="required"
      :disabled="disabled"
      :class="[
        FORM_FIELD_CONTROL_CLASS,
        'min-w-0 flex-1',
        invalid ? FORM_FIELD_INVALID_CLASS : ''
      ]"
      @input="onFirstNameInput"
      @blur="$emit('blur')"
      @keydown.enter="$emit('blur')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { PEOPLE_SALUTATION_OPTIONS } from '@/platform/fields/peopleSalutationField';
import {
  FORM_FIELD_CONTROL_CLASS,
  FORM_FIELD_INVALID_CLASS,
} from '@/utils/formFieldControlClasses';

const props = defineProps({
  firstName: {
    type: String,
    default: '',
  },
  salutation: {
    type: String,
    default: '',
  },
  salutationOptions: {
    type: Array,
    default: () => [...PEOPLE_SALUTATION_OPTIONS],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  required: {
    type: Boolean,
    default: false,
  },
  invalid: {
    type: Boolean,
    default: false,
  },
  firstNameId: {
    type: String,
    default: 'first_name',
  },
  salutationId: {
    type: String,
    default: 'salutation',
  },
  firstNamePlaceholder: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:firstName', 'update:salutation', 'blur']);

const { t } = useI18n();

const salutationSelectOptions = computed(() => {
  const values = Array.isArray(props.salutationOptions) && props.salutationOptions.length > 0
    ? props.salutationOptions
    : [...PEOPLE_SALUTATION_OPTIONS];
  return values.map((value) => ({ value, label: value }));
});

function onSalutationChange(value) {
  emit('update:salutation', value == null || value === '' ? '' : String(value));
}

function onFirstNameInput(event) {
  emit('update:firstName', event?.target?.value ?? '');
}
</script>

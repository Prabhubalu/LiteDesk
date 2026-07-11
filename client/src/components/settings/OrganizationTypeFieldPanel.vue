<template>
  <div class="ml-7 pl-3 border-l-2 border-gray-200 dark:border-gray-600 space-y-2">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <span class="text-xs font-medium text-gray-600 dark:text-gray-400">
        {{ t('settings.orgTypesFieldsWhenSelected') }}
      </span>
      <button
        v-if="row.fields !== undefined"
        type="button"
        class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        @click="emit('reset-fields')"
      >
        {{ t('settings.orgTypesResetPlatformDefaults') }}
      </button>
    </div>

    <p v-if="fieldOptions.length === 0" class="text-xs text-gray-500 dark:text-gray-400">
      {{ t('settings.orgTypesNoScopedFields') }}
    </p>

    <p
      v-else-if="row.fields === undefined && effectiveFields.length > 0"
      class="text-xs text-gray-500 dark:text-gray-400"
    >
      {{ t('settings.orgTypesUsingPlatformDefaults') }}
      <span class="text-gray-400 dark:text-gray-500">{{ t('settings.orgTypesInheritedNotSaved') }}</span>
    </p>
    <p
      v-else-if="row.fields === undefined && effectiveFields.length === 0"
      class="text-xs text-gray-500 dark:text-gray-400"
    >
      {{ t('settings.orgTypesPlatformDefaultNoFields') }}
      <span class="text-gray-400 dark:text-gray-500">{{ t('settings.orgTypesInheritedNotSaved') }}</span>
    </p>
    <p
      v-else-if="row.fields !== undefined && row.fields.length > 0"
      class="text-xs text-gray-600 dark:text-gray-300"
    >
      {{ t('settings.orgTypesCustomFields') }}
    </p>
    <p
      v-else-if="row.fields !== undefined && row.fields.length === 0"
      class="text-xs text-amber-800 dark:text-amber-200/90"
    >
      {{ t('settings.orgTypesNoFieldsExplicit') }}
    </p>

    <div
      v-if="fieldOptions.length > 0"
      class="flex flex-wrap gap-x-3 gap-y-2 max-h-40 overflow-y-auto pr-1"
    >
      <label
        v-for="opt in fieldOptions"
        :key="opt.key"
        class="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none"
      >
        <input
          type="checkbox"
          class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
          :checked="isFieldSelected(opt.key)"
          @change="emit('toggle-field', opt.key, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ opt.label }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  getOrganizationFieldsForType,
  type OrganizationTypeFieldDef
} from '@/platform/fields/organizationFieldModel';

export type OrganizationTypeRow = OrganizationTypeFieldDef & {
  label?: string;
  enabled?: boolean;
  color?: string;
  description?: string;
};

const props = defineProps<{
  row: OrganizationTypeRow;
  fieldOptions: Array<{ key: string; label: string }>;
}>();

const emit = defineEmits<{
  'toggle-field': [fieldKey: string, checked: boolean];
  'reset-fields': [];
}>();

const { t } = useI18n();

const effectiveFields = computed(() => getOrganizationFieldsForType(props.row.value, null));

function isFieldSelected(fieldKey: string): boolean {
  const low = fieldKey.toLowerCase();
  const list =
    props.row.fields !== undefined
      ? props.row.fields
      : effectiveFields.value;
  return list.some((k) => String(k).toLowerCase() === low);
}
</script>

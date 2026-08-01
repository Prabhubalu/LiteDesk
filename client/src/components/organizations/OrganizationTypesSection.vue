<!--
  Organization type picker + one accordion block per selected type.
-->
<template>
  <section :class="sectionClass">
    <h3
      v-if="fullMode"
      class="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white"
    >
      {{ t('organizations.organizationQuickCreateDrawerTypesTitle') }}
    </h3>
    <template v-else>
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('organizations.organizationQuickCreateDrawerTypesTitle') }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('organizations.organizationQuickCreateDrawerSelectTypesHint') }}
        </p>
      </div>
    </template>
    <p
      v-if="fullMode"
      class="text-sm text-gray-500 dark:text-gray-400 -mt-1"
    >
      {{ t('organizations.organizationQuickCreateDrawerSelectTypesHint') }}
    </p>

    <div v-if="availableTypes.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('organizations.organizationQuickCreateDrawerNoTypes') }}
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        v-for="typeOption in availableTypes"
        :key="typeOption.value"
        type="button"
        class="relative flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        :class="isTypeSelected(typeOption.value)
          ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/25'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600'"
        :aria-pressed="isTypeSelected(typeOption.value)"
        @click="toggleType(typeOption.value)"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40"
        >
          <BuildingOffice2Icon class="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {{ typeOption.label }}
          </div>
          <div
            v-if="!isTypeSelected(typeOption.value)"
            class="text-xs text-gray-500 dark:text-gray-400"
          >
            {{ t('people.peopleQuickCreateDrawerTapToAdd') }}
          </div>
        </div>
        <CheckCircleIcon
          v-if="isTypeSelected(typeOption.value)"
          class="absolute right-2 top-2 h-5 w-5 text-indigo-600 dark:text-indigo-400"
          aria-hidden="true"
        />
      </button>
    </div>
    <p v-if="errors.types" class="text-sm text-red-600 dark:text-red-400">
      {{ errors.types }}
    </p>

    <div v-if="selectedTypeEntries.length > 0" class="mt-5 space-y-4">
      <div
        v-for="typeEntry in selectedTypeEntries"
        :key="typeEntry.value"
        class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40"
      >
        <div class="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <div
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40"
          >
            <BuildingOffice2Icon class="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          </div>
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            :aria-expanded="isTypeExpanded(typeEntry.value)"
            @click="toggleTypeAccordion(typeEntry.value)"
          >
            <span class="truncate text-sm font-medium text-gray-900 dark:text-white">
              {{ typeEntry.label }}
            </span>
            <ChevronDownIcon
              class="h-4 w-4 shrink-0 text-gray-500 transition-transform dark:text-gray-400"
              :class="{ 'rotate-180': isTypeExpanded(typeEntry.value) }"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class="ml-auto text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            @click="toggleType(typeEntry.value)"
          >
            {{ t('actions.remove') }}
          </button>
        </div>

        <div v-show="isTypeExpanded(typeEntry.value)" class="p-4">
          <p
            v-if="fieldsForType(typeEntry.value).length === 0"
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            {{ t('organizations.organizationQuickCreateDrawerNoTypeFields') }}
          </p>
          <DynamicForm
            v-else
            module-key="organizations"
            context="platform"
            :form-data="formData"
            :errors="errors"
            :show-all-fields="true"
            :quick-create-mode="false"
            :single-column="singleColumn"
            :fields-override="fieldsForType(typeEntry.value)"
            :module-override="moduleOverride"
            @update:form-data="onDependentFieldsUpdate"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, ref, watch } from 'vue';
import { BuildingOffice2Icon, CheckCircleIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
import DynamicForm from '@/components/common/DynamicForm.vue';
import { getOrganizationFieldsForType } from '@/platform/fields/organizationFieldModel';
import { organizationTypeDefsToPicklistOptions } from '@/utils/organizationTypeConfig';
import { useAuthStore } from '@/stores/authRegistry';

const props = defineProps({
  formData: {
    type: Object,
    required: true,
    default: () => ({}),
  },
  errors: {
    type: Object,
    default: () => ({}),
  },
  moduleOverride: {
    type: Object,
    default: null,
  },
  organizationTypeDefs: {
    type: Array,
    default: () => [],
  },
  singleColumn: {
    type: Boolean,
    default: true,
  },
  fullMode: {
    type: Boolean,
    default: false,
  },
  sectionClass: {
    type: [String, Array, Object],
    default: '',
  },
});

const emit = defineEmits(['update:formData']);

const { t } = useI18n();
const authStore = useAuthStore();

const expandedByType = ref({});

const availableTypes = computed(() =>
  organizationTypeDefsToPicklistOptions(props.organizationTypeDefs, {
    enabledApps: authStore.organization?.enabledApps,
  })
);

const selectedTypes = computed(() =>
  Array.isArray(props.formData?.types) ? props.formData.types : []
);

const selectedTypeEntries = computed(() =>
  selectedTypes.value.map((value) => {
    const match = availableTypes.value.find(
      (opt) => normalizeType(opt.value) === normalizeType(value)
    );
    return {
      value: match?.value ?? value,
      label: match?.label ?? value,
    };
  })
);

function normalizeType(value) {
  return String(value ?? '').trim().toLowerCase();
}

function fieldsForType(typeValue) {
  return getOrganizationFieldsForType(typeValue, props.organizationTypeDefs);
}

function isTypeSelected(typeValue) {
  const want = normalizeType(typeValue);
  return selectedTypes.value.some((current) => normalizeType(current) === want);
}

function isTypeExpanded(typeValue) {
  const key = normalizeType(typeValue);
  return expandedByType.value[key] !== false;
}

function toggleTypeAccordion(typeValue) {
  const key = normalizeType(typeValue);
  expandedByType.value = {
    ...expandedByType.value,
    [key]: !isTypeExpanded(typeValue),
  };
}

function toggleType(typeValue) {
  const types = [...selectedTypes.value];
  const want = normalizeType(typeValue);
  const index = types.findIndex((current) => normalizeType(current) === want);
  if (index >= 0) {
    types.splice(index, 1);
  } else {
    const match = availableTypes.value.find((opt) => normalizeType(opt.value) === want);
    types.push(match?.value ?? typeValue);
    expandedByType.value = {
      ...expandedByType.value,
      [want]: true,
    };
  }
  emit('update:formData', { ...props.formData, types });
}

function onDependentFieldsUpdate(next) {
  emit('update:formData', { ...props.formData, ...next });
}

watch(
  selectedTypes,
  (next, prev) => {
    const prevSet = new Set((prev || []).map((value) => normalizeType(value)));
    const patch = { ...expandedByType.value };
    let changed = false;
    for (const value of next) {
      const key = normalizeType(value);
      if (!prevSet.has(key) && patch[key] === undefined) {
        patch[key] = true;
        changed = true;
      }
    }
    if (changed) {
      expandedByType.value = patch;
    }
  },
  { deep: true }
);
</script>
